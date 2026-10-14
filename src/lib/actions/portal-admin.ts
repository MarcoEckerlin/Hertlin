"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  destroyAllSessions,
  requirePortalAdmin,
  requirePortalRootAdmin,
  type PortalContext,
} from "@/lib/auth";
import { createAuthToken } from "@/lib/auth-tokens";
import { emptyToUndefined, errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { portalUrl } from "@/lib/hosts";
import { sendInviteMail, sendPasswordResetMail } from "@/lib/notifications";
import { portalManageableUserWhere } from "@/lib/permissions";
import { rateLimit, rateLimitReached } from "@/lib/rate-limit";
import { cleanId, searchKey } from "@/components/portal/admin/data";
import {
  checkbox,
  email as emailSchema,
  optionalText,
  phone as phoneSchema,
  requiredText,
} from "@/lib/validation";

/**
 * Benutzer- und Unterkundenverwaltung im Kundenportal.
 * Der Mandant kommt immer aus dem Host (PortalContext), nie aus dem Formular.
 * Jede ID aus Formularen wird gegen den Verwaltungsbereich des Hauptansprechpartners geprüft.
 */

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function idFrom(formData: FormData, key = "id"): string | null {
  return cleanId(str(formData, key)?.trim());
}

/** Alle Portalseiten des Firmenkunden neu laden (Listen, Zahlen, Name in der Seitenleiste). */
function revalidatePortal(ctx: PortalContext) {
  revalidatePath(`/portal/${ctx.root.slug}`, "layout");
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Mehrfache Leerzeichen zusammenfassen, damit „Filiale  Ulm“ und „Filiale Ulm“ nicht nebeneinander stehen. */
function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const optionalEmail = z.preprocess(emptyToUndefined, emailSchema.optional());

/* ------------------------------------------------------------------ */
/* Unterkunden (nur Hauptansprechpartner des Firmenkunden)             */
/* ------------------------------------------------------------------ */

const subCustomerSchema = z.object({
  name: requiredText("einen Namen", 120).transform(tidy),
  street: optionalText(160),
  zip: z
    .string()
    .trim()
    .max(10, "Höchstens 10 Zeichen.")
    .regex(/^[0-9A-Za-z -]*$/, "Bitte eine gültige Postleitzahl angeben.")
    .optional()
    .transform((v) => (v ? v : undefined)),
  city: optionalText(120),
  phone: phoneSchema,
  email: optionalEmail,
});

function readSubCustomer(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    street: str(formData, "street"),
    zip: str(formData, "zip"),
    city: str(formData, "city"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
  };
}

/**
 * Prüft, ob der Name im Firmenkunden schon vergeben ist (ohne Groß/Klein).
 * Gibt die Fehlermeldung zurück oder null.
 */
async function subCustomerNameConflict(ctx: PortalContext, name: string, exceptId?: string): Promise<string | null> {
  const companies = await db.company.findMany({
    where: { OR: [{ id: ctx.root.id }, { parentId: ctx.root.id }] },
    select: { id: true, name: true, parentId: true },
  });
  const key = searchKey(name);
  const hit = companies.find((c) => c.id !== exceptId && searchKey(c.name) === key);
  if (!hit) return null;
  if (hit.parentId === null) {
    return "So heißt bereits Ihre Firma. Geben Sie der Unterkunde einen eigenen Namen, z. B. mit dem Ort.";
  }
  return `Es gibt schon eine Unterkunde „${hit.name}“. Wählen Sie bitte einen anderen Namen.`;
}

export async function createSubCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalRootAdmin();

  const parsed = subCustomerSchema.safeParse(readSubCustomer(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const conflict = await subCustomerNameConflict(ctx, parsed.data.name);
  if (conflict) return errorState("Bitte prüfen Sie den Namen.", formData, { name: conflict });

  const created = await db.company.create({
    data: {
      name: parsed.data.name,
      street: parsed.data.street ?? null,
      zip: parsed.data.zip ?? null,
      city: parsed.data.city ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      // Immer unter dem Firmenkunden dieser Subdomain, nie aus dem Formular
      parentId: ctx.root.id,
    },
    select: { id: true },
  });

  revalidatePortal(ctx);
  redirect(`/unterkunden/${created.id}?angelegt=1`);
}

export async function updateSubCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalRootAdmin();

  const id = idFrom(formData);
  const company = id
    ? await db.company.findFirst({ where: { id, parentId: ctx.root.id }, select: { id: true } })
    : null;
  if (!company) return errorState("Diese Unterkunde gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const parsed = subCustomerSchema.safeParse(readSubCustomer(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const conflict = await subCustomerNameConflict(ctx, parsed.data.name, company.id);
  if (conflict) return errorState("Bitte prüfen Sie den Namen.", formData, { name: conflict });

  await db.company.update({
    where: { id: company.id },
    data: {
      name: parsed.data.name,
      street: parsed.data.street ?? null,
      zip: parsed.data.zip ?? null,
      city: parsed.data.city ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
    },
  });

  revalidatePortal(ctx);
  return successState("Die Stammdaten sind gespeichert.");
}

/**
 * Unterkunde deaktivieren oder wieder aktivieren.
 * Deaktivieren sperrt die Anmeldung aller Benutzer der Unterkunde (siehe getCurrentUser und loginAction),
 * beendet ihre Sitzungen und lässt offene Einladungslinks verfallen. Tickets bleiben erhalten.
 */
export async function toggleSubCustomerActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalRootAdmin();

  const id = idFrom(formData);
  const company = id
    ? await db.company.findFirst({ where: { id, parentId: ctx.root.id }, select: { id: true, name: true, active: true } })
    : null;
  if (!company) return errorState("Diese Unterkunde gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const intent = str(formData, "intent");
  if (intent !== "deactivate" && intent !== "activate") {
    return errorState("Die Aktion ist unklar. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");
  }
  const makeActive = intent === "activate";

  // Doppelt abgeschickt oder in einem anderen Tab schon erledigt
  if (company.active === makeActive) {
    revalidatePortal(ctx);
    return successState(makeActive ? `${company.name} ist bereits aktiv.` : `${company.name} ist bereits deaktiviert.`);
  }

  if (!makeActive && str(formData, "confirm") !== "on") {
    return errorState("Bitte bestätigen Sie zuerst, dass sich die Benutzer danach nicht mehr anmelden können.", undefined, {
      confirm: "Bitte bestätigen.",
    });
  }

  await db.company.update({ where: { id: company.id }, data: { active: makeActive } });

  if (!makeActive) {
    const users = await db.user.findMany({ where: { companyId: company.id }, select: { id: true } });
    for (const user of users) await destroyAllSessions(user.id);
    await db.authToken.updateMany({
      where: { usedAt: null, user: { companyId: company.id } },
      data: { usedAt: new Date() },
    });
  }

  revalidatePortal(ctx);
  return successState(
    makeActive
      ? `${company.name} ist wieder aktiv. Die Benutzer können sich wie gewohnt anmelden.`
      : `${company.name} ist deaktiviert. Alle Benutzer dieser Unterkunde wurden abgemeldet.`,
  );
}

/* ------------------------------------------------------------------ */
/* Benutzer (Hauptansprechpartner)                                     */
/* ------------------------------------------------------------------ */

const roleSchema = z.enum(["CUSTOMER_ADMIN", "CUSTOMER_USER"], { error: "Bitte eine Rolle auswählen." });

const userBaseSchema = z.object({
  name: requiredText("den Namen", 120).transform(tidy),
  email: emailSchema,
  phone: phoneSchema,
  position: optionalText(120),
});

const createUserSchema = userBaseSchema.extend({ role: roleSchema });

const updateUserSchema = userBaseSchema.extend({
  role: roleSchema.optional(),
  active: checkbox,
});

const EMAIL_TAKEN = "Diese E-Mail-Adresse wird bereits verwendet.";
const EMAIL_UNAVAILABLE =
  "Diese Adresse können Sie hier nicht verwenden. Falls die Person bei uns schon einen Zugang hat, melden Sie sich bitte – wir klären das.";
const EMAIL_LOCKED =
  "Die Adresse eines eingerichteten Zugangs können Sie hier nicht ändern. Melden Sie sich bitte bei uns, wir stellen sie nach Rücksprache mit der Person um.";

/** Höchstens so viele Treffer auf fremde Adressen pro Stunde, damit sich nicht durchprobieren lässt, wer ein Konto hat. */
const FOREIGN_EMAIL_LIMIT = 10;

/**
 * Fehlermeldung für eine schon vergebene E-Mail-Adresse. Benutzer im eigenen Bereich werden mit Namen genannt,
 * für alle anderen Adressen gibt es eine neutrale Meldung.
 */
async function emailTakenMessage(ctx: PortalContext, email: string, exceptUserId?: string): Promise<string | null> {
  const foreignKey = `portal-user-foreign-email:${ctx.user.id}`;
  if (rateLimitReached(foreignKey, FOREIGN_EMAIL_LIMIT)) {
    return "Sie haben gerade mehrere Adressen eingegeben, die hier nicht verwendet werden können. Bitte warten Sie eine Stunde oder melden Sie sich bei uns.";
  }
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!existing || existing.id === exceptUserId) return null;
  const visible = await db.user.findFirst({
    where: { AND: [portalManageableUserWhere(ctx), { id: existing.id }] },
    select: { name: true, company: { select: { name: true } } },
  });
  if (visible) {
    return `${EMAIL_TAKEN} Sie gehört zum Zugang von ${visible.name}${visible.company ? ` (${visible.company.name})` : ""}.`;
  }
  rateLimit(foreignKey, FOREIGN_EMAIL_LIMIT, 60 * 60 * 1000);
  return EMAIL_UNAVAILABLE;
}

/** Zielfirma eines Benutzers: Firmenkunde oder Unterkunde im Verwaltungsbereich. */
async function findScopeCompany(ctx: PortalContext, companyId: string) {
  if (!ctx.scopeCompanyIds.includes(companyId)) return null;
  return db.company.findFirst({
    where: { id: companyId, OR: [{ id: ctx.root.id }, { parentId: ctx.root.id }] },
    select: { id: true, name: true, active: true, parentId: true },
  });
}

/** Firmenbezeichnung für die Einladungsmail: „Firma (Unterkunde)“. */
function inviteCompanyName(ctx: PortalContext, company: { name: string; parentId: string | null }): string {
  return company.parentId ? `${ctx.root.name} (${company.name})` : ctx.root.name;
}

/** Neues Einladungs-Token erzeugen, Mail verschicken und den Link zurückgeben. */
async function sendInvite(
  ctx: PortalContext,
  user: { id: string; name: string; email: string },
  company: { name: string; parentId: string | null },
): Promise<string> {
  const token = await createAuthToken(user.id, "INVITE");
  const link = portalUrl(ctx.root.slug, `/passwort/${token}`);
  try {
    await sendInviteMail({
      to: user.email,
      name: user.name,
      link,
      companyName: inviteCompanyName(ctx, company),
      invitedBy: ctx.user.name,
    });
  } catch (error) {
    // Der Link wird trotzdem angezeigt und kann von Hand weitergegeben werden
    console.error("[portal-admin] Einladung konnte nicht verschickt werden:", error instanceof Error ? error.message : error);
  }
  return link;
}

/** Offene Einladungs- und Passwortlinks eines Benutzers verfallen lassen. */
async function expireOpenTokens(userId: string) {
  await db.authToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
}

export async function createPortalUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalAdmin();

  const parsed = createUserSchema.safeParse({
    name: str(formData, "name") ?? "",
    email: str(formData, "email") ?? "",
    phone: str(formData, "phone"),
    position: str(formData, "position"),
    role: str(formData, "role"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const data = parsed.data;

  // Unterkunden-Hauptansprechpartner legen nur Benutzer der eigenen Unterkunde an
  const companyId = ctx.isRootAdmin ? (idFrom(formData, "companyId") ?? ctx.root.id) : ctx.company.id;
  const company = await findScopeCompany(ctx, companyId);
  if (!company) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
      companyId: "Bitte wählen Sie eine Firma aus der Liste.",
    });
  }
  if (!company.active) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
      companyId: `${company.name} ist deaktiviert. Aktivieren Sie die Unterkunde zuerst oder wählen Sie eine andere.`,
    });
  }

  const taken = await emailTakenMessage(ctx, data.email);
  if (taken) return errorState("Bitte prüfen Sie die markierten Felder.", formData, { email: taken });

  if (!rateLimit(`portal-user-create:${ctx.user.id}`, 100, 60 * 60 * 1000).ok) {
    return errorState("Sie haben in kurzer Zeit sehr viele Benutzer angelegt. Bitte warten Sie etwas und versuchen Sie es dann erneut.", formData);
  }

  let user: { id: string; name: string; email: string };
  try {
    user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        position: data.position ?? null,
        role: data.role,
        companyId: company.id,
        passwordHash: null,
        active: true,
      },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
        email: (await emailTakenMessage(ctx, data.email)) ?? EMAIL_TAKEN,
      });
    }
    throw error;
  }

  const link = await sendInvite(ctx, user, company);
  revalidatePortal(ctx);

  return successState(`${user.name} ist angelegt. Die Einladung ist an ${user.email} unterwegs.`, {
    inviteLink: link,
    userId: user.id,
    name: user.name,
    email: user.email,
    companyName: company.name,
  });
}

export async function updatePortalUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalAdmin();

  const id = idFrom(formData);
  const target = id
    ? await db.user.findFirst({
        where: { AND: [portalManageableUserWhere(ctx), { id }] },
        select: { id: true, name: true, email: true, role: true, active: true, companyId: true, passwordHash: true },
      })
    : null;
  if (!target || !target.companyId) {
    return errorState("Diesen Benutzer gibt es nicht oder Sie dürfen ihn nicht bearbeiten. Bitte laden Sie die Seite neu.");
  }
  const invited = target.passwordHash === null;
  const isSelf = target.id === ctx.user.id;

  const parsed = updateUserSchema.safeParse({
    name: str(formData, "name") ?? "",
    email: str(formData, "email") ?? "",
    phone: str(formData, "phone"),
    position: str(formData, "position"),
    role: str(formData, "role"),
    active: formData.get("active"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const data = parsed.data;

  // Eigenes Konto: Rolle, Status und Firma bleiben unverändert (die Felder sind im Formular gesperrt)
  const role = isSelf ? target.role : (data.role ?? target.role);
  const active = isSelf ? target.active : data.active;
  if (isSelf && data.role && data.role !== target.role) {
    return errorState("Ihre eigene Rolle können Sie nicht ändern. Bitten Sie dazu einen anderen Hauptansprechpartner.", formData);
  }

  // Firma: nur Hauptansprechpartner des Firmenkunden können Benutzer umhängen
  let companyId = target.companyId;
  let movedTo: string | null = null;
  const requestedCompanyId = ctx.isRootAdmin && !isSelf ? idFrom(formData, "companyId") : null;
  if (requestedCompanyId && requestedCompanyId !== target.companyId) {
    const company = await findScopeCompany(ctx, requestedCompanyId);
    if (!company) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
        companyId: "Bitte wählen Sie eine Firma aus der Liste.",
      });
    }
    if (!company.active) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
        companyId: `${company.name} ist deaktiviert. Dorthin können Sie niemanden verschieben.`,
      });
    }
    companyId = company.id;
    movedTo = company.name;
  }

  // Beim Firmenkunden muss mindestens ein aktiver Hauptansprechpartner bleiben
  const wasRootAdmin = target.role === "CUSTOMER_ADMIN" && target.active && target.companyId === ctx.root.id;
  const staysRootAdmin = role === "CUSTOMER_ADMIN" && active && companyId === ctx.root.id;
  if (wasRootAdmin && !staysRootAdmin) {
    const others = await db.user.count({
      where: { companyId: ctx.root.id, role: "CUSTOMER_ADMIN", active: true, id: { not: target.id } },
    });
    if (others === 0) {
      return errorState(
        `${target.name} ist der einzige aktive Hauptansprechpartner von ${ctx.root.name}. Ernennen Sie zuerst eine andere Person zum Hauptansprechpartner.`,
        formData,
      );
    }
  }

  const emailChanged = data.email !== target.email;
  // Bei eingerichteten Zugängen anderer Personen bleibt die Anmeldeadresse fest. Sonst ließe sie sich auf ein
  // eigenes Postfach umstellen und das Konto über „Link senden“ oder „Passwort vergessen“ übernehmen.
  if (emailChanged && !invited && !isSelf) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, { email: EMAIL_LOCKED });
  }
  if (emailChanged) {
    const taken = await emailTakenMessage(ctx, data.email, target.id);
    if (taken) return errorState("Bitte prüfen Sie die markierten Felder.", formData, { email: taken });
  }

  try {
    await db.user.update({
      where: { id: target.id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        position: data.position ?? null,
        role,
        companyId,
        active,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
        email: (await emailTakenMessage(ctx, data.email, target.id)) ?? EMAIL_TAKEN,
      });
    }
    throw error;
  }

  const messages = [isSelf ? "Ihre Angaben sind gespeichert." : `Die Angaben von ${data.name} sind gespeichert.`];
  let inviteLink: string | undefined;

  if (movedTo) {
    messages.push(`Neue Tickets laufen ab jetzt unter ${movedTo}, bisherige bleiben, wo sie sind.`);
  }

  if (target.active && !active) {
    // Gesperrt: sofort abmelden, offene Links verfallen lassen
    await destroyAllSessions(target.id);
    await expireOpenTokens(target.id);
    messages.push(`${data.name} kann sich ab sofort nicht mehr anmelden.`);
  } else if (!target.active && active) {
    messages.push(
      invited
        ? `Der Zugang ist wieder aktiv. ${data.name} hat noch kein Passwort – senden Sie die Einladung bei Bedarf erneut.`
        : `${data.name} kann sich wieder anmelden.`,
    );
  }

  if (emailChanged) {
    // Links an die alte Adresse sollen nicht mehr funktionieren
    await expireOpenTokens(target.id);
    if (invited && active) {
      const company = await db.company.findUnique({ where: { id: companyId }, select: { name: true, parentId: true, active: true } });
      if (company?.active) {
        inviteLink = await sendInvite(ctx, { id: target.id, name: data.name, email: data.email }, company);
        messages.push(`Die Einladung haben wir an die neue Adresse ${data.email} geschickt.`);
      }
    } else if (!invited) {
      messages.push(`Ab sofort gilt ${data.email} für die Anmeldung.`);
    }
  }

  revalidatePortal(ctx);
  return successState(messages.join(" "), inviteLink ? { inviteLink } : undefined);
}

/**
 * Einladung erneut senden (Passwort noch nicht festgelegt) oder einen Link zum Zurücksetzen
 * des Passworts verschicken (Zugang schon eingerichtet).
 * Den Link zeigen wir nur bei offenen Einladungen an. Für eingerichtete Zugänge geht er nur per Mail
 * an die Person selbst, damit niemand anderes darüber ein fremdes Konto übernehmen kann.
 */
export async function resendInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalAdmin();

  const id = idFrom(formData);
  const target = id
    ? await db.user.findFirst({
        where: { AND: [portalManageableUserWhere(ctx), { id }] },
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          passwordHash: true,
          company: { select: { name: true, parentId: true, active: true } },
        },
      })
    : null;
  if (!target || !target.company) {
    return errorState("Diesen Benutzer gibt es nicht oder Sie dürfen ihn nicht bearbeiten. Bitte laden Sie die Seite neu.");
  }
  if (target.id === ctx.user.id) {
    return errorState("Ihr eigenes Passwort ändern Sie unter „Profil“.");
  }
  if (!target.active) {
    return errorState(`Der Zugang von ${target.name} ist deaktiviert. Aktivieren Sie ihn zuerst, dann können Sie einen Link senden.`);
  }
  if (!target.company.active) {
    return errorState(`${target.company.name} ist deaktiviert. Aktivieren Sie die Unterkunde zuerst.`);
  }

  const perAdmin = rateLimit(`portal-invite:${ctx.user.id}`, 30, 60 * 60 * 1000);
  const perUser = rateLimit(`portal-invite-user:${target.id}`, 5, 60 * 60 * 1000);
  if (!perAdmin.ok || !perUser.ok) {
    return errorState("Es wurden gerade schon mehrere Links verschickt. Bitte warten Sie eine Weile, bevor Sie es erneut versuchen.");
  }

  if (target.passwordHash === null) {
    const link = await sendInvite(ctx, target, target.company);
    return successState(
      `Wir haben die Einladung erneut an ${target.email} geschickt. Ältere Einladungslinks funktionieren nicht mehr.`,
      { inviteLink: link },
    );
  }

  const token = await createAuthToken(target.id, "RESET");
  try {
    await sendPasswordResetMail({ to: target.email, name: target.name, link: portalUrl(ctx.root.slug, `/passwort/${token}`) });
  } catch (error) {
    console.error("[portal-admin] Passwort-Link konnte nicht verschickt werden:", error instanceof Error ? error.message : error);
  }
  return successState(
    `Wir haben ${target.name} einen Link an ${target.email} geschickt, um ein neues Passwort festzulegen. Der Link ist eine Stunde gültig. Bis dahin gilt das bisherige Passwort weiter.`,
  );
}

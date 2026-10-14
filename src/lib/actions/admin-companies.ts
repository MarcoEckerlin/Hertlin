"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { destroyAllSessions, requireAdmin } from "@/lib/auth";
import { createAuthToken } from "@/lib/auth-tokens";
import { CUSTOMER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { emptyToUndefined, errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { isValidSlug, portalHost, portalUrl, RESERVED_SLUGS } from "@/lib/hosts";
import { sendInviteMail, sendPasswordResetMail } from "@/lib/notifications";
import { checkbox, email as emailSchema, optionalText, phone as phoneSchema, requiredText, slugField } from "@/lib/validation";
import { publish } from "@/realtime/bus";

/**
 * Kundenverwaltung in der Verwaltung: Firmenkunden, Unterkunden und Kundenbenutzer.
 * Alle Aktionen nur für Administratoren. IDs aus Formularen werden jedes Mal gegen die
 * Datenbank geprüft (z. B. ob eine Firma wirklich zum angegebenen Firmenkunden gehört).
 */

/* ------------------------------------------------------------------ */
/* Hilfsfunktionen                                                     */
/* ------------------------------------------------------------------ */

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function idFrom(formData: FormData, key = "id"): string | null {
  const v = str(formData, key)?.trim();
  return v && /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Mehrfache Leerzeichen zusammenfassen. */
function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Vergleichsform für Namen: ohne Groß/Klein, Akzente und doppelte Leerzeichen. */
function nameKey(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").replace(/ß/g, "ss").replace(/\s+/g, " ").trim().toLocaleLowerCase("de");
}

function revalidateCustomers() {
  revalidatePath("/admin", "layout");
}

const optionalEmail = z.preprocess(emptyToUndefined, emailSchema.optional());

const zipSchema = z
  .string()
  .trim()
  .max(10, "Höchstens 10 Zeichen.")
  .regex(/^[0-9A-Za-z -]*$/, "Bitte eine gültige Postleitzahl angeben.")
  .optional()
  .transform((v) => (v ? v : undefined));

const customerNumberSchema = z
  .string()
  .trim()
  .max(40, "Höchstens 40 Zeichen.")
  .regex(/^[0-9A-Za-z./_ -]*$/, "Nur Buchstaben, Ziffern, Leerzeichen und . / - _ verwenden.")
  .optional()
  .transform((v) => (v ? v : undefined));

const companySchema = z.object({
  name: requiredText("den Namen", 160).transform(tidy),
  customerNumber: customerNumberSchema,
  street: optionalText(160),
  zip: zipSchema,
  city: optionalText(120),
  phone: phoneSchema,
  email: optionalEmail,
  internalNote: optionalText(4000),
});

function readCompany(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    customerNumber: str(formData, "customerNumber"),
    street: str(formData, "street"),
    zip: str(formData, "zip"),
    city: str(formData, "city"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    internalNote: str(formData, "internalNote"),
  };
}

type CompanyData = z.infer<typeof companySchema>;

function companyData(data: CompanyData) {
  return {
    name: data.name,
    customerNumber: data.customerNumber ?? null,
    street: data.street ?? null,
    zip: data.zip ?? null,
    city: data.city ?? null,
    phone: data.phone ?? null,
    email: data.email ?? null,
    internalNote: data.internalNote ?? null,
  };
}

/** Fehlermeldung, wenn die Kundennummer schon an eine andere Firma vergeben ist. */
async function customerNumberConflict(customerNumber: string | undefined, exceptId?: string): Promise<string | null> {
  if (!customerNumber) return null;
  const hit = await db.company.findUnique({ where: { customerNumber }, select: { id: true, name: true } });
  if (!hit || hit.id === exceptId) return null;
  return `Diese Kundennummer hat bereits „${hit.name}“.`;
}

/** Prüft ein Subdomain-Kürzel. Gibt die Fehlermeldung zurück oder null. */
async function slugProblem(slug: string, exceptId?: string): Promise<string | null> {
  if (RESERVED_SLUGS.has(slug)) return `„${slug}“ ist für eigene Dienste reserviert. Bitte ein anderes Kürzel wählen.`;
  if (!isValidSlug(slug)) return "Nur Kleinbuchstaben, Ziffern und Bindestriche (nicht am Anfang oder Ende).";
  const hit = await db.company.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (hit && hit.id !== exceptId) return `Das Kürzel ist bereits an „${hit.name}“ vergeben.`;
  return null;
}

/** Name einer Unterkunde muss innerhalb des Firmenkunden eindeutig sein. */
async function subNameConflict(rootId: string, name: string, exceptId?: string): Promise<string | null> {
  const companies = await db.company.findMany({
    where: { OR: [{ id: rootId }, { parentId: rootId }] },
    select: { id: true, name: true, parentId: true },
  });
  const key = nameKey(name);
  const hit = companies.find((c) => c.id !== exceptId && nameKey(c.name) === key);
  if (!hit) return null;
  if (hit.parentId === null) return "So heißt bereits der Firmenkunde. Ergänzen Sie z. B. den Standort.";
  return `Es gibt schon eine Unterkunde „${hit.name}“.`;
}

/** E-Mail-Adressen sind über alle Konten hinweg eindeutig. */
async function emailTaken(email: string, exceptUserId?: string): Promise<string | null> {
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, role: true, company: { select: { name: true } } },
  });
  if (!existing || existing.id === exceptUserId) return null;
  if (existing.role === "ADMIN" || existing.role === "TECHNICIAN") return "Diese Adresse gehört zu einem Hertlin-Konto.";
  return `Diese Adresse wird bereits verwendet${existing.company ? ` (bei ${existing.company.name})` : ""}.`;
}

/** Firmen-IDs eines Firmenkunden (Wurzel + Unterkunden). */
async function companyTreeIds(rootId: string): Promise<string[]> {
  const children = await db.company.findMany({ where: { parentId: rootId }, select: { id: true } });
  return [rootId, ...children.map((c) => c.id)];
}

/** Meldet alle Benutzer der Firmen ab und lässt offene Einladungs-/Passwortlinks verfallen. */
async function lockOutCompanyUsers(companyIds: string[]): Promise<number> {
  const users = await db.user.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } });
  for (const user of users) await destroyAllSessions(user.id);
  await db.authToken.updateMany({
    where: { usedAt: null, user: { companyId: { in: companyIds } } },
    data: { usedAt: new Date() },
  });
  return users.length;
}

/** Einladung erzeugen, per E-Mail senden und den Link zurückgeben. */
async function inviteCustomerUser(user: { id: string; name: string; email: string }, slug: string, companyName: string) {
  const token = await createAuthToken(user.id, "INVITE");
  const link = portalUrl(slug, `/passwort/${token}`);
  await sendInviteMail({ to: user.email, name: user.name, link, companyName });
  return link;
}

/* ------------------------------------------------------------------ */
/* Firmenkunde anlegen                                                 */
/* ------------------------------------------------------------------ */

const contactSchema = z.object({
  contactName: requiredText("den Namen des Ansprechpartners", 120).transform(tidy),
  contactEmail: emailSchema,
  contactPhone: phoneSchema,
  contactPosition: optionalText(120),
});

export async function createCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = companySchema.extend({ slug: slugField }).safeParse({
    ...readCompany(formData),
    slug: str(formData, "slug") ?? "",
  });

  const contactRaw = {
    contactName: str(formData, "contactName") ?? "",
    contactEmail: str(formData, "contactEmail") ?? "",
    contactPhone: str(formData, "contactPhone"),
    contactPosition: str(formData, "contactPosition"),
  };
  const wantsContact = [
    contactRaw.contactName,
    contactRaw.contactEmail,
    contactRaw.contactPhone ?? "",
    contactRaw.contactPosition ?? "",
  ].some((v) => v.trim() !== "");
  const contact = wantsContact ? contactSchema.safeParse(contactRaw) : null;

  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) Object.assign(fieldErrors, fromZodError(parsed.error).fieldErrors);
  if (contact && !contact.success) Object.assign(fieldErrors, fromZodError(contact.error).fieldErrors);
  if (!parsed.success || (contact && !contact.success)) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors);
  }

  const data = parsed.data;
  const contactData = contact?.success ? contact.data : null;

  const [slugError, numberError, mailError] = await Promise.all([
    slugProblem(data.slug),
    customerNumberConflict(data.customerNumber),
    contactData ? emailTaken(contactData.contactEmail) : Promise.resolve(null),
  ]);
  if (slugError) fieldErrors.slug = slugError;
  if (numberError) fieldErrors.customerNumber = numberError;
  if (mailError) fieldErrors.contactEmail = mailError;
  if (Object.keys(fieldErrors).length > 0) return errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors);

  // Anfrage, aus der der Kunde entsteht (nur, wenn sie noch keinem Kunden zugeordnet ist)
  const inquiryRaw = str(formData, "inquiryId")?.trim() ?? "";
  const inquiryId = /^\d{1,9}$/.test(inquiryRaw) ? Number(inquiryRaw) : null;

  let created: {
    company: { id: string; name: string; slug: string };
    user: { id: string; name: string; email: string } | null;
    linkedInquiryId: number | null;
  };
  try {
    created = await db.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { ...companyData(data), slug: data.slug },
        select: { id: true, name: true, slug: true },
      });
      const user = contactData
        ? await tx.user.create({
            data: {
              name: contactData.contactName,
              email: contactData.contactEmail,
              phone: contactData.contactPhone ?? null,
              position: contactData.contactPosition ?? null,
              role: "CUSTOMER_ADMIN",
              companyId: company.id,
            },
            select: { id: true, name: true, email: true },
          })
        : null;
      let linkedInquiryId: number | null = null;
      if (inquiryId) {
        const linked = await tx.inquiry.updateMany({
          where: { id: inquiryId, companyId: null },
          data: { companyId: company.id, status: "WON" },
        });
        if (linked.count > 0) linkedInquiryId = inquiryId;
      }
      return { company: { id: company.id, name: company.name, slug: company.slug ?? data.slug }, user, linkedInquiryId };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState(
        "Kürzel, Kundennummer oder E-Mail-Adresse wurden gerade anderweitig vergeben. Bitte prüfen Sie die Angaben.",
        formData,
      );
    }
    throw error;
  }

  // Anfrage ist jetzt dem neuen Kunden zugeordnet: offene Ansichten der Anfrage live aktualisieren
  if (created.linkedInquiryId) publish({ type: "inquiry.updated", inquiryId: created.linkedInquiryId });
  revalidateCustomers();

  if (!created.user) redirect(`/admin/kunden/${created.company.id}?angelegt=1`);

  const link = await inviteCustomerUser(created.user, created.company.slug, created.company.name);
  return successState(`${created.company.name} ist angelegt. Die Einladung an ${created.user.email} ist verschickt.`, {
    companyId: created.company.id,
    companyName: created.company.name,
    inviteLink: link,
    contactName: created.user.name,
    portal: portalHost(created.company.slug),
  });
}

/* ------------------------------------------------------------------ */
/* Stammdaten, Subdomain, aktiv/deaktiviert                            */
/* ------------------------------------------------------------------ */

const SAVED = "Die Stammdaten sind gespeichert.";
const COMPANY_GONE = "Diese Firma gibt es nicht mehr. Bitte laden Sie die Seite neu.";

export async function updateCompanyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = idFrom(formData);
  const company = id ? await db.company.findUnique({ where: { id }, select: { id: true, parentId: true } }) : null;
  if (!company) return errorState(COMPANY_GONE);

  const parsed = companySchema.safeParse(readCompany(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const fieldErrors: Record<string, string> = {};
  const [numberError, nameError] = await Promise.all([
    customerNumberConflict(parsed.data.customerNumber, company.id),
    company.parentId ? subNameConflict(company.parentId, parsed.data.name, company.id) : Promise.resolve(null),
  ]);
  if (numberError) fieldErrors.customerNumber = numberError;
  if (nameError) fieldErrors.name = nameError;
  if (Object.keys(fieldErrors).length > 0) return errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors);

  try {
    await db.company.update({ where: { id: company.id }, data: companyData(parsed.data) });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die Kundennummer.", formData, {
        customerNumber: "Diese Kundennummer ist schon vergeben.",
      });
    }
    throw error;
  }

  revalidateCustomers();
  return successState(SAVED);
}

/** Subdomain eines Firmenkunden ändern. Die alte Adresse funktioniert danach nicht mehr. */
export async function changeCompanySlugAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = idFrom(formData);
  const company = id ? await db.company.findFirst({ where: { id, parentId: null }, select: { id: true, slug: true } }) : null;
  if (!company) return errorState(COMPANY_GONE);

  const parsed = z.object({ slug: slugField }).safeParse({ slug: str(formData, "slug") ?? "" });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const slug = parsed.data.slug;

  if (slug === company.slug) {
    return errorState("Das ist bereits die aktuelle Adresse.", formData, { slug: "Bitte ein neues Kürzel eingeben." });
  }
  const problem = await slugProblem(slug, company.id);
  if (problem) return errorState("Bitte prüfen Sie das Kürzel.", formData, { slug: problem });

  if (str(formData, "confirm") !== "on") {
    return errorState("Bitte bestätigen Sie die Änderung.", formData, {
      confirm: "Bitte bestätigen, dass die alte Adresse danach nicht mehr funktioniert.",
    });
  }

  try {
    await db.company.update({ where: { id: company.id }, data: { slug } });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie das Kürzel.", formData, { slug: "Das Kürzel wurde gerade vergeben." });
    }
    throw error;
  }

  // Sitzungen gelten nur für den alten Host – aufräumen, damit sich alle unter der neuen Adresse anmelden
  const ids = await companyTreeIds(company.id);
  await db.session.deleteMany({ where: { user: { companyId: { in: ids } } } });
  const pendingInvites = await db.user.count({ where: { companyId: { in: ids }, active: true, passwordHash: null } });

  revalidateCustomers();
  return successState(
    `Das Kundenportal ist jetzt unter ${portalHost(slug)} erreichbar.` +
      (pendingInvites > 0
        ? ` ${pendingInvites === 1 ? "Eine offene Einladung zeigt" : `${pendingInvites} offene Einladungen zeigen`} noch auf die alte Adresse – bitte erneut senden.`
        : ""),
  );
}

/**
 * Firma deaktivieren oder wieder aktivieren.
 * Deaktivieren eines Firmenkunden sperrt das Portal und alle Benutzer inkl. Unterkunden;
 * bei einer Unterkunde nur deren Benutzer. Tickets und Kosten bleiben erhalten.
 */
export async function setCompanyActiveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = idFrom(formData);
  const company = id
    ? await db.company.findUnique({ where: { id }, select: { id: true, name: true, active: true, parentId: true } })
    : null;
  if (!company) return errorState(COMPANY_GONE);

  const intent = str(formData, "intent");
  if (intent !== "activate" && intent !== "deactivate") {
    return errorState("Die Aktion ist unklar. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");
  }
  const makeActive = intent === "activate";

  if (company.active === makeActive) {
    revalidateCustomers();
    return successState(makeActive ? `${company.name} ist bereits aktiv.` : `${company.name} ist bereits deaktiviert.`);
  }

  if (!makeActive && str(formData, "confirm") !== "on") {
    return errorState("Bitte bestätigen Sie die Sperre.", undefined, { confirm: "Bitte bestätigen." });
  }

  await db.company.update({ where: { id: company.id }, data: { active: makeActive } });

  let lockedOut = 0;
  if (!makeActive) {
    const ids = company.parentId ? [company.id] : await companyTreeIds(company.id);
    lockedOut = await lockOutCompanyUsers(ids);
  }

  revalidateCustomers();
  if (makeActive) {
    return successState(
      company.parentId
        ? `${company.name} ist wieder aktiv. Die Benutzer können sich wieder anmelden.`
        : `${company.name} ist wieder aktiv. Das Kundenportal ist erreichbar.`,
    );
  }
  return successState(
    `${company.name} ist deaktiviert.` +
      (lockedOut > 0 ? ` ${lockedOut === 1 ? "Ein Benutzer wurde" : `${lockedOut} Benutzer wurden`} abgemeldet.` : ""),
  );
}

/* ------------------------------------------------------------------ */
/* Unterkunden                                                         */
/* ------------------------------------------------------------------ */

export async function createSubCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const rootId = idFrom(formData, "parentId");
  const root = rootId ? await db.company.findFirst({ where: { id: rootId, parentId: null }, select: { id: true } }) : null;
  if (!root) return errorState("Den Firmenkunden gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const parsed = companySchema.safeParse(readCompany(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const fieldErrors: Record<string, string> = {};
  const [numberError, nameError] = await Promise.all([
    customerNumberConflict(parsed.data.customerNumber),
    subNameConflict(root.id, parsed.data.name),
  ]);
  if (numberError) fieldErrors.customerNumber = numberError;
  if (nameError) fieldErrors.name = nameError;
  if (Object.keys(fieldErrors).length > 0) return errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors);

  let createdId: string;
  try {
    const created = await db.company.create({
      // Unterkunden haben keine eigene Subdomain
      data: { ...companyData(parsed.data), parentId: root.id, slug: null },
      select: { id: true },
    });
    createdId = created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die Kundennummer.", formData, {
        customerNumber: "Diese Kundennummer ist schon vergeben.",
      });
    }
    throw error;
  }

  revalidateCustomers();
  redirect(`/admin/kunden/${createdId}?angelegt=1`);
}

/* ------------------------------------------------------------------ */
/* Kundenbenutzer                                                      */
/* ------------------------------------------------------------------ */

const roleSchema = z.enum(["CUSTOMER_ADMIN", "CUSTOMER_USER"], { error: "Bitte eine Rolle auswählen." });

const userSchema = z.object({
  name: requiredText("den Namen", 120).transform(tidy),
  email: emailSchema,
  phone: phoneSchema,
  position: optionalText(120),
  role: roleSchema,
});

function readUser(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    email: str(formData, "email") ?? "",
    phone: str(formData, "phone"),
    position: str(formData, "position"),
    role: str(formData, "role"),
  };
}

/** Firmenkunde und Zielfirma prüfen: Die Firma muss der Firmenkunde selbst oder eine seiner Unterkunden sein. */
async function companyInRoot(rootId: string | null, companyId: string | null) {
  if (!rootId || !companyId) return null;
  const root = await db.company.findFirst({
    where: { id: rootId, parentId: null },
    select: { id: true, name: true, slug: true, active: true },
  });
  if (!root) return null;
  const company = await db.company.findFirst({
    where: { id: companyId, OR: [{ id: root.id }, { parentId: root.id }] },
    select: { id: true, name: true, active: true, parentId: true },
  });
  return company ? { root, company } : null;
}

export async function createCompanyUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const scope = await companyInRoot(idFrom(formData, "rootId"), idFrom(formData, "companyId"));
  if (!scope) {
    return errorState("Bitte wählen Sie die Firma aus der Liste.", formData, { companyId: "Bitte eine Firma auswählen." });
  }

  const parsed = userSchema.safeParse(readUser(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const mailError = await emailTaken(parsed.data.email);
  if (mailError) return errorState("Bitte prüfen Sie die E-Mail-Adresse.", formData, { email: mailError });

  if (!scope.root.slug) return errorState("Für diesen Firmenkunden ist keine Portal-Adresse hinterlegt.", formData);
  if (!scope.root.active || !scope.company.active) {
    return errorState(
      `${!scope.root.active ? scope.root.name : scope.company.name} ist deaktiviert. Aktivieren Sie die Firma zuerst, sonst kann sich niemand anmelden.`,
      formData,
    );
  }

  let user: { id: string; name: string; email: string };
  try {
    user = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        position: parsed.data.position ?? null,
        role: parsed.data.role,
        companyId: scope.company.id,
      },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die E-Mail-Adresse.", formData, { email: "Diese Adresse wird bereits verwendet." });
    }
    throw error;
  }

  const link = await inviteCustomerUser(user, scope.root.slug, scope.root.name);
  revalidateCustomers();
  return successState(`${user.name} ist angelegt. Die Einladung an ${user.email} ist verschickt.`, {
    userId: user.id,
    inviteLink: link,
    name: user.name,
  });
}

/** Kundenbenutzer im Bereich des Firmenkunden laden (nur Kundenrollen). */
async function customerUserInRoot(userId: string | null, rootId: string | null) {
  if (!userId || !rootId) return null;
  const ids = await companyTreeIds(rootId);
  return db.user.findFirst({
    where: { id: userId, companyId: { in: ids }, role: { in: [...CUSTOMER_ROLES] } },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      passwordHash: true,
      company: { select: { id: true, active: true, parentId: true } },
    },
  });
}

export async function updateCompanyUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const rootId = idFrom(formData, "rootId");
  const existing = await customerUserInRoot(idFrom(formData), rootId);
  if (!existing) return errorState("Diesen Benutzer gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const scope = await companyInRoot(rootId, idFrom(formData, "companyId"));
  if (!scope) {
    return errorState("Bitte wählen Sie die Firma aus der Liste.", formData, { companyId: "Bitte eine Firma auswählen." });
  }

  const parsed = userSchema.extend({ active: checkbox }).safeParse({ ...readUser(formData), active: formData.get("active") });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const data = parsed.data;

  const emailChanged = data.email !== existing.email;
  if (emailChanged) {
    const mailError = await emailTaken(data.email, existing.id);
    if (mailError) return errorState("Bitte prüfen Sie die E-Mail-Adresse.", formData, { email: mailError });
  }

  try {
    await db.user.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        position: data.position ?? null,
        role: data.role,
        companyId: scope.company.id,
        active: data.active,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die E-Mail-Adresse.", formData, { email: "Diese Adresse wird bereits verwendet." });
    }
    throw error;
  }

  const deactivated = existing.active && !data.active;
  if (deactivated) {
    await destroyAllSessions(existing.id);
    await db.authToken.updateMany({ where: { userId: existing.id, usedAt: null }, data: { usedAt: new Date() } });
  }

  // Offene Einladung an die neue Adresse schicken; der alte Link verfällt dabei
  let inviteLink: string | undefined;
  const invitePending = existing.passwordHash === null;
  if (emailChanged && invitePending && data.active && scope.root.slug && scope.root.active && scope.company.active) {
    inviteLink = await inviteCustomerUser(
      { id: existing.id, name: data.name, email: data.email },
      scope.root.slug,
      scope.root.name,
    );
  }

  revalidateCustomers();
  if (deactivated) return successState(`Gespeichert. ${data.name} ist gesperrt und wurde abgemeldet.`);
  if (inviteLink) {
    return successState(`Gespeichert. Die Einladung ging neu an ${data.email}.`, { inviteLink, name: data.name });
  }
  return successState("Gespeichert.");
}

/**
 * Zugang erneut zusenden: offene Einladung → neue Einladung (7 Tage),
 * Benutzer mit Passwort → Link zum Zurücksetzen (1 Stunde).
 */
export async function resendCompanyAccessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const rootId = idFrom(formData, "rootId");
  const user = await customerUserInRoot(idFrom(formData), rootId);
  if (!user) return errorState("Diesen Benutzer gibt es nicht mehr. Bitte laden Sie die Seite neu.");
  const root = rootId
    ? await db.company.findFirst({ where: { id: rootId, parentId: null }, select: { name: true, slug: true, active: true } })
    : null;
  if (!root?.slug) return errorState("Für diesen Firmenkunden ist keine Portal-Adresse hinterlegt.");

  if (!user.active) return errorState("Der Zugang ist deaktiviert. Aktivieren Sie ihn zuerst.");
  if (!root.active || !user.company?.active) {
    return errorState("Die Firma ist deaktiviert. Aktivieren Sie sie zuerst, sonst kann sich niemand anmelden.");
  }

  if (user.passwordHash === null) {
    const link = await inviteCustomerUser(user, root.slug, root.name);
    return successState(`Neue Einladung an ${user.email} verschickt. Ältere Einladungslinks gelten nicht mehr.`, {
      inviteLink: link,
      purpose: "invite",
      name: user.name,
    });
  }

  const token = await createAuthToken(user.id, "RESET");
  const link = portalUrl(root.slug, `/passwort/${token}`);
  await sendPasswordResetMail({ to: user.email, name: user.name, link });
  return successState(`Link zum Zurücksetzen des Passworts an ${user.email} verschickt.`, {
    inviteLink: link,
    purpose: "reset",
    name: user.name,
  });
}

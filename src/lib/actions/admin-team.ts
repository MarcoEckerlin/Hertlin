"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { destroyAllSessions, requireAdmin } from "@/lib/auth";
import { createAuthToken } from "@/lib/auth-tokens";
import { STAFF_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { mainUrl } from "@/lib/hosts";
import { sendInviteMail, sendPasswordResetMail } from "@/lib/notifications";
import { checkbox, email as emailSchema, optionalText, phone as phoneSchema, requiredText } from "@/lib/validation";

/**
 * Hertlin-Team verwalten (nur Administratoren).
 * Regeln: Niemand deaktiviert oder degradiert sich selbst, und es bleibt immer
 * mindestens ein aktiver Administrator mit festgelegtem Passwort.
 */

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function idFrom(formData: FormData): string | null {
  const v = str(formData, "id")?.trim();
  return v && /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : null;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const roleSchema = z.enum(["ADMIN", "TECHNICIAN"], { error: "Bitte eine Rolle auswählen." });

const staffSchema = z.object({
  name: requiredText("den Namen", 120).transform(tidy),
  email: emailSchema,
  phone: phoneSchema,
  position: optionalText(120),
  role: roleSchema,
});

function readStaff(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    email: str(formData, "email") ?? "",
    phone: str(formData, "phone"),
    position: str(formData, "position"),
    role: str(formData, "role"),
  };
}

async function emailTaken(email: string, exceptUserId?: string): Promise<string | null> {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!existing || existing.id === exceptUserId) return null;
  if (existing.role === "ADMIN" || existing.role === "TECHNICIAN") return "Diese Adresse hat bereits ein Teammitglied.";
  return "Diese Adresse gehört zu einem Kundenkonto. Bitte eine andere Adresse verwenden.";
}

async function sendStaffInvite(user: { id: string; name: string; email: string }, invitedBy: string): Promise<string> {
  const token = await createAuthToken(user.id, "INVITE");
  const link = mainUrl(`/admin/passwort/${token}`);
  await sendInviteMail({ to: user.email, name: user.name, link, invitedBy, isStaff: true });
  return link;
}

function revalidateTeam() {
  revalidatePath("/admin/team", "layout");
}

class LastAdminError extends Error {}

const LAST_ADMIN =
  "Es muss mindestens ein aktiver Administrator mit eigenem Passwort bleiben. Ernennen Sie zuerst jemand anderen zum Administrator.";

/* ------------------------------------------------------------------ */

export async function createStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = staffSchema.safeParse(readStaff(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const data = parsed.data;

  const mailError = await emailTaken(data.email);
  if (mailError) return errorState("Bitte prüfen Sie die E-Mail-Adresse.", formData, { email: mailError });

  let user: { id: string; name: string; email: string };
  try {
    user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        position: data.position ?? null,
        role: data.role,
        companyId: null,
      },
      select: { id: true, name: true, email: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die E-Mail-Adresse.", formData, { email: "Diese Adresse wird bereits verwendet." });
    }
    throw error;
  }

  const link = await sendStaffInvite(user, admin.name);
  revalidateTeam();
  return successState(`${user.name} ist angelegt. Die Einladung an ${user.email} ist verschickt.`, {
    userId: user.id,
    inviteLink: link,
    name: user.name,
  });
}

export async function updateStaffAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const id = idFrom(formData);
  const existing = id
    ? await db.user.findFirst({
        where: { id, role: { in: [...STAFF_ROLES] } },
        select: { id: true, name: true, email: true, role: true, active: true, passwordHash: true },
      })
    : null;
  if (!existing) return errorState("Dieses Teammitglied gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const isSelf = existing.id === admin.id;
  const parsed = staffSchema
    .extend({ active: checkbox })
    .safeParse({
      ...readStaff(formData),
      // Eigene Rolle und eigener Zugang sind im Formular gesperrt und werden nicht übertragen
      role: isSelf ? existing.role : str(formData, "role"),
      active: isSelf ? "on" : formData.get("active"),
    });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const data = parsed.data;

  if (isSelf && (data.role !== "ADMIN" || !data.active)) {
    return errorState("Ihre eigene Rolle und Ihren eigenen Zugang können Sie nicht ändern.", formData);
  }

  const emailChanged = data.email !== existing.email;
  if (emailChanged) {
    const mailError = await emailTaken(data.email, existing.id);
    if (mailError) return errorState("Bitte prüfen Sie die E-Mail-Adresse.", formData, { email: mailError });
  }

  const losesAdmin = existing.role === "ADMIN" && existing.active && (data.role !== "ADMIN" || !data.active);

  try {
    await db.$transaction(async (tx) => {
      if (losesAdmin) {
        const others = await tx.user.count({
          where: { id: { not: existing.id }, role: "ADMIN", active: true, passwordHash: { not: null } },
        });
        if (others === 0) throw new LastAdminError();
      }
      await tx.user.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone ?? null,
          position: data.position ?? null,
          role: data.role,
          active: data.active,
          companyId: null,
        },
      });
    });
  } catch (error) {
    if (error instanceof LastAdminError) return errorState(LAST_ADMIN, formData);
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

  let inviteLink: string | undefined;
  if (emailChanged && existing.passwordHash === null && data.active) {
    inviteLink = await sendStaffInvite({ id: existing.id, name: data.name, email: data.email }, admin.name);
  }

  revalidateTeam();
  if (deactivated) return successState(`Gespeichert. ${data.name} ist gesperrt und wurde abgemeldet.`);
  if (inviteLink) return successState(`Gespeichert. Die Einladung ging neu an ${data.email}.`, { inviteLink, name: data.name });
  return successState("Gespeichert.");
}

/**
 * Zugang erneut zusenden: offene Einladung → neue Einladung (7 Tage),
 * mit Passwort → Link zum Zurücksetzen (1 Stunde).
 */
export async function resendStaffAccessAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const id = idFrom(formData);
  const user = id
    ? await db.user.findFirst({
        where: { id, role: { in: [...STAFF_ROLES] } },
        select: { id: true, name: true, email: true, active: true, passwordHash: true },
      })
    : null;
  if (!user) return errorState("Dieses Teammitglied gibt es nicht mehr. Bitte laden Sie die Seite neu.");
  if (!user.active) return errorState("Der Zugang ist deaktiviert. Aktivieren Sie ihn zuerst.");

  if (user.passwordHash === null) {
    const link = await sendStaffInvite(user, admin.name);
    return successState(`Neue Einladung an ${user.email} verschickt. Ältere Einladungslinks gelten nicht mehr.`, {
      inviteLink: link,
      purpose: "invite",
      name: user.name,
    });
  }

  const token = await createAuthToken(user.id, "RESET");
  const link = mainUrl(`/admin/passwort/${token}`);
  await sendPasswordResetMail({ to: user.email, name: user.name, link });
  return successState(`Link zum Zurücksetzen des Passworts an ${user.email} verschickt.`, {
    inviteLink: link,
    purpose: "reset",
    name: user.name,
  });
}

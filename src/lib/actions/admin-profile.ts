"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroyAllSessions, requireStaff } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { optionalText, password as passwordSchema, phone, requiredText } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Eigenes Profil in der Verwaltung: Kontaktdaten und Passwort.
 * Die E-Mail-Adresse ist der Anmeldename; sie ändert ein Administrator unter „Team“.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const profileSchema = z.object({
  name: requiredText("Ihren Namen", 120),
  phone,
  position: optionalText(120),
});

export async function updateStaffProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();

  const parsed = profileSchema.safeParse({
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    position: text(formData, "position"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  try {
    await db.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name, phone: parsed.data.phone ?? null, position: parsed.data.position ?? null },
    });
  } catch (error) {
    console.error("[verwaltung] Profil konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState("Ihre Angaben konnten gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  // Name steht auch in der Seitenleiste
  revalidatePath("/admin", "layout");
  return successState("Ihre Angaben sind gespeichert.");
}

const passwordChangeSchema = z
  .object({
    currentPassword: z
      .string({ error: "Bitte geben Sie Ihr aktuelles Passwort ein." })
      .min(1, "Bitte geben Sie Ihr aktuelles Passwort ein.")
      .max(200, "Das Passwort ist zu lang."),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    error: "Die beiden Passwörter stimmen nicht überein.",
  })
  .refine((d) => d.password !== d.currentPassword, {
    path: ["password"],
    error: "Das neue Passwort muss sich vom bisherigen unterscheiden.",
  });

export async function changeStaffPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();

  const parsed = passwordChangeSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    password: text(formData, "password"),
    passwordConfirm: text(formData, "passwordConfirm"),
  });
  // Passwörter nie zurück ins Formular geben
  if (!parsed.success) return fromZodError(parsed.error);

  // Schutz vor dem Durchprobieren des aktuellen Passworts in einer offenen Sitzung
  if (!rateLimit(`admin:password-change:${user.id}`, 5, 15 * 60 * 1000).ok) {
    return errorState("Zu viele Versuche. Bitte warten Sie 15 Minuten und versuchen Sie es dann noch einmal.");
  }

  const account = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.currentPassword, account?.passwordHash))) {
    return errorState("Das Passwort wurde nicht geändert.", undefined, {
      currentPassword: "Das aktuelle Passwort stimmt nicht.",
    });
  }

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // Ein noch offener Link „Passwort vergessen“ soll danach nicht mehr funktionieren
      db.authToken.updateMany({ where: { userId: user.id, purpose: "RESET", usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    // Andere Geräte abmelden, diese Sitzung bleibt bestehen
    await destroyAllSessions(user.id, true);
  } catch (error) {
    console.error("[verwaltung] Passwort konnte nicht geändert werden:", error instanceof Error ? error.message : error);
    return errorState("Das Passwort konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.");
  }

  return successState("Ihr Passwort ist geändert. Auf anderen Geräten müssen Sie sich neu anmelden.");
}

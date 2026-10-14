"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { destroyAllSessions, requireStaff } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { optionalText, password as passwordSchema, phone, requiredText } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { isLangCode, languageLabel } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";

/**
 * Eigenes Profil in der Verwaltung: Kontaktdaten, Sprache für Kundennachrichten und Passwort.
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

/** Sprache, in die Nachrichten von Kunden und Interessenten für diesen Mitarbeiter übersetzt werden. */
export async function updateStaffLanguageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();

  if (!translationEnabled()) {
    return errorState("Die automatische Übersetzung ist zurzeit nicht eingerichtet. Ein Administrator kann sie aktivieren.");
  }
  const language = text(formData, "language");
  if (!isLangCode(language)) {
    return errorState("Bitte prüfen Sie die Auswahl.", formData, { language: "Bitte eine Sprache aus der Liste wählen." });
  }

  try {
    await db.user.update({ where: { id: user.id }, data: { language } });
  } catch (error) {
    console.error("[verwaltung] Sprache konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState("Die Einstellung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  // Tickets und Anfragen zeigen Kundennachrichten ab jetzt in der neuen Sprache
  revalidatePath("/admin", "layout");
  return successState(`Gespeichert. Nachrichten in anderen Sprachen sehen Sie ab jetzt auf ${languageLabel(language)}.`);
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
      // Noch offene Links („Passwort vergessen“, Einladung) sollen danach nicht mehr funktionieren
      db.authToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
    // Andere Geräte abmelden, diese Sitzung bleibt bestehen
    await destroyAllSessions(user.id, true);
  } catch (error) {
    console.error("[verwaltung] Passwort konnte nicht geändert werden:", error instanceof Error ? error.message : error);
    return errorState("Das Passwort konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.");
  }

  return successState("Ihr Passwort ist geändert. Auf anderen Geräten müssen Sie sich neu anmelden.");
}

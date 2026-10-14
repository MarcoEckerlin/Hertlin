import { z } from "zod";

/** Wiederverwendbare Zod-Bausteine mit deutschen Fehlermeldungen. */

export const trimmed = (max = 200) => z.string().trim().max(max, `Höchstens ${max} Zeichen.`);

export const requiredText = (label: string, max = 200) =>
  z.string({ error: `Bitte ${label} angeben.` }).trim().min(1, `Bitte ${label} angeben.`).max(max, `Höchstens ${max} Zeichen.`);

export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const email = z
  .string({ error: "E-Mail-Adresse fehlt." })
  .trim()
  .toLowerCase()
  .min(1, "Bitte E-Mail-Adresse angeben.")
  .max(200, "Die E-Mail-Adresse ist zu lang.")
  .pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben."));

export const phone = z
  .string()
  .trim()
  .max(40, "Die Telefonnummer ist zu lang.")
  .regex(/^[0-9+()/\-\s.]*$/, "Bitte nur Ziffern, Leerzeichen und + ( ) / - verwenden.")
  .optional()
  .transform((v) => (v ? v : undefined));

export const password = z
  .string()
  .min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.")
  .max(200, "Das Passwort ist zu lang.");

export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true" || v === "1");

export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Mindestens 2 Zeichen.")
  .max(40, "Höchstens 40 Zeichen.")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche (nicht am Anfang oder Ende).");

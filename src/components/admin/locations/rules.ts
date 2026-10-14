import { z } from "zod";
import type { SiteSettings } from "@/lib/settings";
import { openingHourLines } from "@/components/site/locations";
import { checkbox, phone as phoneSchema, requiredText } from "@/lib/validation";

/**
 * Regeln für Hertlin-Standorte (Verwaltung unter /admin/standorte).
 * Reine Funktionen ohne Serverabhängigkeiten – genutzt von den Server Actions, den Formularen und den Tests.
 *
 * Hauptsitz: Unter den aktiven Standorten ist immer genau einer der Hauptsitz. Den Hauptsitz wechselt man,
 * indem man einen anderen Standort dazu macht; der bisherige wird dabei automatisch ein normaler Standort.
 */

export const MAX_OPENING_HOUR_LINES = 10;
export const MAX_OPENING_HOUR_LENGTH = 80;

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(200, "Die E-Mail-Adresse ist zu lang.")
  .refine((v) => v === "" || z.email().safeParse(v).success, "Bitte eine gültige E-Mail-Adresse angeben.")
  .transform((v) => (v ? v : undefined));

const openingHoursField = z
  .string()
  .max(2000, "Bitte kürzer fassen.")
  .transform((text) => openingHourLines(text))
  .superRefine((lines, ctx) => {
    if (lines.length > MAX_OPENING_HOUR_LINES) {
      ctx.addIssue({ code: "custom", message: `Höchstens ${MAX_OPENING_HOUR_LINES} Zeilen.` });
    }
    const tooLong = lines.findIndex((line) => line.length > MAX_OPENING_HOUR_LENGTH);
    if (tooLong >= 0) {
      ctx.addIssue({
        code: "custom",
        message: `Zeile ${tooLong + 1} ist zu lang (höchstens ${MAX_OPENING_HOUR_LENGTH} Zeichen je Zeile).`,
      });
    }
  })
  .transform((lines) => (lines.length > 0 ? lines.join("\n") : undefined));

export const locationSchema = z.object({
  name: requiredText("einen Namen", 120).transform(tidy),
  street: requiredText("Straße und Hausnummer", 160).transform(tidy),
  zip: z
    .string()
    .trim()
    .min(1, "Bitte die PLZ angeben.")
    .max(10, "Höchstens 10 Zeichen.")
    .regex(/^[0-9A-Za-z][0-9A-Za-z -]{2,9}$/, "Bitte eine gültige PLZ angeben."),
  city: requiredText("den Ort", 80).transform(tidy),
  phone: phoneSchema,
  email: optionalEmail,
  openingHours: openingHoursField,
  note: z
    .string()
    .trim()
    .max(300, "Höchstens 300 Zeichen.")
    .transform((v) => (v ? v.replace(/[ \t]+/g, " ") : undefined)),
  isMain: checkbox,
  showOnWebsite: checkbox,
  active: checkbox,
});

export type LocationInput = z.infer<typeof locationSchema>;

/** Formularwerte als Text (für Vorbelegung und Wiederanzeige). */
export type LocationDraft = {
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  openingHours: string;
  note: string;
};

export const EMPTY_LOCATION_DRAFT: LocationDraft = {
  name: "",
  street: "",
  zip: "",
  city: "",
  phone: "",
  email: "",
  openingHours: "",
  note: "",
};

/** Wert aus den Firmendaten ohne Platzhalter wie „TODO Ort“. */
function settingValue(value: string): string {
  const v = value.trim();
  return v.toUpperCase().startsWith("TODO") ? "" : v;
}

/** Vorbelegung „Hauptsitz aus den Firmendaten übernehmen“: Anschrift, Telefon, E-Mail und Servicezeiten. */
export function locationDraftFromSettings(
  s: Pick<SiteSettings, "name" | "street" | "zip" | "city" | "phone" | "email" | "openingHours">,
): LocationDraft {
  const city = settingValue(s.city);
  const name = settingValue(s.name);
  return {
    name: name && city ? `${name} ${city}` : name,
    street: settingValue(s.street),
    zip: settingValue(s.zip),
    city,
    phone: settingValue(s.phone),
    email: settingValue(s.email),
    openingHours: s.openingHours
      .map((o) => [settingValue(o.days), settingValue(o.hours)].filter(Boolean).join(": "))
      .filter(Boolean)
      .slice(0, MAX_OPENING_HOUR_LINES)
      .join("\n"),
    note: "",
  };
}

/* ------------------------------------------------------------------ */
/* Hauptsitz und Reihenfolge                                           */
/* ------------------------------------------------------------------ */

export type OrderedLocation = { id: string; name: string; isMain: boolean; active: boolean; sortOrder: number };

/** Reihenfolge wie auf der Website: Hauptsitz zuerst, dann nach Position und Name. */
export function compareLocations(a: OrderedLocation, b: OrderedLocation): number {
  if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, "de");
}

/**
 * Welcher Standort ist nach einer Änderung der Hauptsitz?
 * preferId: der gerade zum Hauptsitz gemachte Standort (zählt nur, wenn er aktiv ist).
 * Gibt es aktive Standorte, ist es immer einer davon; ohne aktive Standorte bleibt der bisherige (oder keiner).
 */
export function resolveMainId(locations: OrderedLocation[], preferId?: string | null): string | null {
  const sorted = [...locations].sort(compareLocations);
  const active = sorted.filter((l) => l.active);
  if (preferId && active.some((l) => l.id === preferId)) return preferId;
  // Ist ein aktiver Standort Hauptsitz, steht er vorn – sonst der erste aktive nach Position
  if (active.length > 0) return active[0].id;
  return sorted.find((l) => l.isMain)?.id ?? null;
}

/**
 * Neue Reihenfolge nach „nach oben“/„nach unten“. Der Hauptsitz steht immer vorn und wird nicht verschoben.
 * Ergebnis: IDs in neuer Reihenfolge, oder null, wenn sich nichts ändert.
 */
export function moveLocation(locations: OrderedLocation[], id: string, direction: "up" | "down"): string[] | null {
  const sorted = [...locations].sort(compareLocations);
  const index = sorted.findIndex((l) => l.id === id);
  if (index < 0 || sorted[index].isMain) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= sorted.length || sorted[target].isMain) return null;
  const ids = sorted.map((l) => l.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}

/* ------------------------------------------------------------------ */
/* Zuordnungen                                                         */
/* ------------------------------------------------------------------ */

export type LocationAssignments = { companies: number; staff: number; customers: number; tickets: number };

export function hasAssignments(a: LocationAssignments): boolean {
  return a.companies + a.staff + a.customers + a.tickets > 0;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** „2 Kunden, 1 Mitarbeiter und 14 Tickets“ */
export function assignmentSummary(a: LocationAssignments): string {
  const parts = [
    a.companies > 0 ? plural(a.companies, "Kunde", "Kunden") : null,
    a.staff > 0 ? plural(a.staff, "Mitarbeiter", "Mitarbeiter") : null,
    a.customers > 0 ? plural(a.customers, "Kundenbenutzer", "Kundenbenutzer") : null,
    a.tickets > 0 ? plural(a.tickets, "Ticket", "Tickets") : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return "nichts";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}`;
}

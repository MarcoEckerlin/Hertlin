import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Hertlin-Standorte. Verwaltung unter /admin/standorte (nur Administratoren).
 * Firmenkunden, Mitarbeiter und Tickets können einem Standort zugeordnet sein (optional).
 */

export type LocationOption = { value: string; label: string };

const ORDER = [{ isMain: "desc" as const }, { sortOrder: "asc" as const }, { name: "asc" as const }];

/** Aktive Standorte (Hauptsitz zuerst). */
export const listActiveLocations = cache(async () => db.location.findMany({ where: { active: true }, orderBy: ORDER }));

/** Standorte, die auf der Website erscheinen. */
export const listWebsiteLocations = cache(async () =>
  db.location.findMany({ where: { active: true, showOnWebsite: true }, orderBy: ORDER }),
);

/** Auswahlliste für Formulare, z. B. „Hertlin Ulm (Ulm)“. */
export async function locationOptions(): Promise<LocationOption[]> {
  const locations = await listActiveLocations();
  return locations.map((l) => ({ value: l.id, label: l.name.includes(l.city) ? l.name : `${l.name} (${l.city})` }));
}

/**
 * Wert aus einem Formularfeld prüfen: "" → null (kein Standort), sonst nur IDs aktiver Standorte.
 * Ergebnis undefined = ungültige Angabe (Formularfehler anzeigen).
 */
export async function parseLocationId(value: unknown): Promise<string | null | undefined> {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(value)) return undefined;
  const location = await db.location.findFirst({ where: { id: value, active: true }, select: { id: true } });
  return location ? location.id : undefined;
}

/**
 * Vorgabe für den Standort eines neuen Tickets:
 * Firma → deren Standort, bei einer Unterkunde ohne eigenen Standort der des Firmenkunden;
 * Privatkunde (companyId null) → Hauptsitz. Nur aktive Standorte, sonst null.
 */
export async function defaultTicketLocationId(companyId: string | null): Promise<string | null> {
  if (!companyId) {
    const main = await db.location.findFirst({
      where: { isMain: true, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    return main?.id ?? null;
  }
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      location: { select: { id: true, active: true } },
      parent: { select: { location: { select: { id: true, active: true } } } },
    },
  });
  if (!company) return null;
  if (company.location?.active) return company.location.id;
  if (company.parent?.location?.active) return company.parent.location.id;
  return null;
}

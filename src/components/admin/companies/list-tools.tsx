/**
 * Kleine Helfer für die Listen der Verwaltung (Kunden, Anfragen, Anrufe, Team, Website, Standorte).
 * Filter-Reiter: SegmentedTabs aus @/components/ui/segmented-tabs; Suche: ListSearchForm aus ./list-filters.
 */

/**
 * Ganze Tabellenzeile klickbar („Stretched Link“): an den Haupt-Link der Zeile hängen, die Zeile bekommt `relative`.
 * Weitere Links und Knöpfe in der Zeile brauchen `relative z-10`, damit sie darüber liegen.
 */
export const rowLinkClass = "after:absolute after:inset-0";

/** Innere Links und Knöpfe einer klickbaren Zeile */
export const aboveRowLinkClass = "relative z-10";

export function firstParam(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

/** Plausible ID aus URL oder Query (cuid). Alles andere gilt als nicht vorhanden. */
export function cleanId(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : null;
}

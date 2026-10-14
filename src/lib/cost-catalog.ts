import { COST_KINDS, COST_KIND_LABELS, type CostKind } from "@/lib/constants";
import { formatQuantity, parseMoney, parseQuantity } from "@/lib/format";

/**
 * Kostenkatalog („Standardpositionen“) und Regeln für Leistungen und Material im Ticket.
 * Reine Logik ohne Datenbank: läuft in den Server Actions und im Formular im Browser.
 *
 * Wer darf was?
 * - Administratoren und Techniker erfassen Positionen (Arbeitszeit, Anfahrt, Material, Pauschalen).
 * - Preise und Summen sehen und setzen nur Administratoren. Techniker-Positionen bekommen den Katalogpreis,
 *   ohne Katalogpreis sind sie „Preis fehlt“ (needsPrice), bis die Verwaltung ihn einträgt.
 * - Techniker ändern nur eigene, noch nicht abgerechnete Positionen. Administratoren ändern alles,
 *   was nicht auf einer Rechnung steht.
 */

export const PRESET_NAME_MAX = 120;
export const COST_NOTE_MAX = 150;
export const COST_DESCRIPTION_MAX = 300;
/** 99.999,99 */
export const MAX_QUANTITY = 9_999_999;
/** 1.000.000,00 € */
export const MAX_UNIT_PRICE = 100_000_000;

/* ------------------------------------------------------------------ */
/* Bezeichnungen                                                       */
/* ------------------------------------------------------------------ */

/** Leerzeichen zusammenfassen und außen entfernen: „ Anfahrt   Ulm “ → „Anfahrt Ulm“ */
export function cleanName(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Schlüssel gegen Dubletten im Katalog: „ Anfahrt   STADTGEBIET “ → „anfahrt stadtgebiet“ */
export function presetNameKey(name: string): string {
  return cleanName(name).toLocaleLowerCase("de-DE");
}

/** Katalogbezeichnung plus Notiz: „Arbeitszeit Technik – Trommel getauscht“ */
export function composeCostDescription(name: string, note?: string | null): string {
  const base = cleanName(name);
  const extra = cleanName(note ?? "");
  return extra ? `${base} – ${extra}` : base;
}

/** Art aus der Datenbank absichern (unbekannte Werte werden zu „Pauschale“). */
export function toCostKind(value: string): CostKind {
  return (COST_KINDS as readonly string[]).includes(value) ? (value as CostKind) : "FLAT";
}

/* ------------------------------------------------------------------ */
/* Eingaben (deutsche Schreibweise)                                    */
/* ------------------------------------------------------------------ */

export type ParsedField = { ok: true; value: number | null } | { ok: false; error: string };

/** Menge wie „1,25“ in Hundertstel. Leer ist ein Fehler. */
export function parseQuantityField(raw: string): ParsedField {
  if (!raw.trim()) return { ok: false, error: "Bitte eine Menge angeben." };
  const value = parseQuantity(raw);
  if (value === null) return { ok: false, error: "Bitte eine Zahl mit höchstens zwei Nachkommastellen eingeben, z. B. 1,25." };
  if (value <= 0) return { ok: false, error: "Die Menge muss größer als 0 sein." };
  if (value > MAX_QUANTITY) return { ok: false, error: "Die Menge ist zu groß." };
  return { ok: true, value };
}

/** Preis wie „89,90“ in Cent. Leer ergibt null (kein Preis), wenn optional. */
export function parsePriceField(raw: string, opts: { required: boolean }): ParsedField {
  if (!raw.trim()) {
    return opts.required ? { ok: false, error: "Bitte einen Einzelpreis angeben (0 für kostenlos)." } : { ok: true, value: null };
  }
  const value = parseMoney(raw);
  if (value === null) return { ok: false, error: "Bitte einen Betrag wie 95 oder 89,90 eingeben." };
  if (value > MAX_UNIT_PRICE) return { ok: false, error: "Der Betrag ist zu hoch." };
  return { ok: true, value };
}

/** Menge für ein Eingabefeld: 125 → „1,25“ (ohne Tausenderpunkte, damit sie wieder eingelesen werden kann) */
export function quantityToInput(hundredths: number): string {
  return (hundredths / 100).toString().replace(".", ",");
}

/** „1,5 Std.“ */
export function formatQuantityWithUnit(hundredths: number, unit: string): string {
  return `${formatQuantity(hundredths)} ${unit}`;
}

/* ------------------------------------------------------------------ */
/* Preis einer Position                                                */
/* ------------------------------------------------------------------ */

export type PriceResolution = {
  unitPriceCents: number;
  /** Preis fehlt noch – ein Administrator trägt ihn nach */
  needsPrice: boolean;
  source: "input" | "catalog" | "missing";
};

/** Katalogpreis, sofern es einen gibt und die Einheit passt (ein Preis je Std. gilt nicht je Min.). */
export function catalogPriceFor(preset: { unit: string; unitPriceCents: number | null } | null, unit: string): number | null {
  if (!preset || preset.unitPriceCents === null) return null;
  return preset.unit === unit ? preset.unitPriceCents : null;
}

/**
 * Einzelpreis einer neu erfassten Position.
 * - Administrator (canSetPrice): Es gilt, was im Feld steht. Das Formular füllt den Katalogpreis vor;
 *   ein leeres Feld heißt „Preis steht noch nicht fest“.
 * - Techniker: Eingaben werden ignoriert. Katalogpreis, wenn vorhanden und die Einheit passt, sonst „Preis fehlt“.
 */
export function resolveUnitPrice(opts: {
  canSetPrice: boolean;
  inputCents: number | null;
  preset: { unit: string; unitPriceCents: number | null } | null;
  unit: string;
}): PriceResolution {
  if (opts.canSetPrice) {
    if (opts.inputCents !== null) return { unitPriceCents: opts.inputCents, needsPrice: false, source: "input" };
    return { unitPriceCents: 0, needsPrice: true, source: "missing" };
  }
  const catalog = catalogPriceFor(opts.preset, opts.unit);
  if (catalog !== null) return { unitPriceCents: catalog, needsPrice: false, source: "catalog" };
  return { unitPriceCents: 0, needsPrice: true, source: "missing" };
}

/* ------------------------------------------------------------------ */
/* Rechte an einer Position                                            */
/* ------------------------------------------------------------------ */

export type CostBlock = "role" | "invoice" | "billed" | "foreign";

/**
 * Darf diese Person die Position ändern oder löschen? null = ja, sonst der Grund.
 * Positionen auf einer Rechnung sind für alle gesperrt (Storno über die Rechnung).
 */
export function costEditBlock(
  viewer: { id: string; role: string },
  entry: { createdById: string | null; billed: boolean; invoiceId: string | null },
): CostBlock | null {
  if (viewer.role !== "ADMIN" && viewer.role !== "TECHNICIAN") return "role";
  if (entry.invoiceId) return "invoice";
  if (viewer.role === "ADMIN") return null;
  if (entry.billed) return "billed";
  if (entry.createdById !== viewer.id) return "foreign";
  return null;
}

/** Erklärung für gesperrte Positionen. */
export function costBlockMessage(block: CostBlock, invoiceNumber?: string | null): string {
  switch (block) {
    case "invoice":
      return invoiceNumber
        ? `Die Position steht auf Rechnung ${invoiceNumber} und lässt sich nicht mehr ändern.`
        : "Die Position steht auf einer Rechnung und lässt sich nicht mehr ändern.";
    case "billed":
      return "Die Position ist bereits abgerechnet. Änderungen nur über die Verwaltung.";
    case "foreign":
      return "Diese Position hat jemand anderes erfasst. Ändern können sie diese Person und die Verwaltung.";
    case "role":
      return "Dafür fehlt Ihnen die Berechtigung.";
  }
}

/* ------------------------------------------------------------------ */
/* Auswahl im Ticket                                                   */
/* ------------------------------------------------------------------ */

type SortablePreset = {
  kind: string;
  name: string;
  usageCount: number;
  /** ISO-Zeitpunkt oder null */
  lastUsedAt: string | null;
  sortOrder: number;
};

/** Häufig benutzte zuerst, dann zuletzt benutzte, dann Reihenfolge und Name. */
export function comparePresetsForPicker(a: SortablePreset, b: SortablePreset): number {
  if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
  const la = a.lastUsedAt ?? "";
  const lb = b.lastUsedAt ?? "";
  if (la !== lb) return la < lb ? 1 : -1;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, "de");
}

/** Nach Art gruppiert (Arbeitszeit, Anfahrt, Material, Pauschale), innerhalb häufig benutzte zuerst. */
export function groupPresetsForPicker<T extends SortablePreset>(presets: T[]): { kind: CostKind; label: string; presets: T[] }[] {
  return COST_KINDS.map((kind) => ({
    kind,
    label: COST_KIND_LABELS[kind],
    presets: presets.filter((p) => toCostKind(p.kind) === kind).sort(comparePresetsForPicker),
  })).filter((group) => group.presets.length > 0);
}

/** Suche im Katalog: alle Wörter müssen in Bezeichnung oder Art vorkommen (Groß-/Kleinschreibung egal). */
export function presetMatchesQuery(preset: { name: string; kind: string }, query: string): boolean {
  const words = presetNameKey(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = presetNameKey(`${preset.name} ${COST_KIND_LABELS[toCostKind(preset.kind)]}`);
  return words.every((word) => haystack.includes(word));
}

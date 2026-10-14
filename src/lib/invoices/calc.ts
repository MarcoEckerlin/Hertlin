/**
 * Reine Rechenlogik für Rechnungen (ohne Datenbank): Nummern, Beträge, Steuer, Platzhalter, IBAN, Kalendertage.
 * Alle Beträge in Cent, Steuersätze in Basispunkten (1900 = 19 %).
 */

/* ------------------------------------------------------------------ */
/* Rechnungsnummer                                                     */
/* ------------------------------------------------------------------ */

/** Präfix der Rechnungsnummer: 1–8 Großbuchstaben oder Ziffern, z. B. „RE“. */
export const INVOICE_PREFIX_PATTERN = /^[A-Z0-9]{1,8}$/;

/** „RE“, 2026, 7 → „RE-2026-0007“ (ab 10.000 einfach fünfstellig). */
export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, "0")}`;
}

/** Nächste laufende Nummer im Jahr: höchste bisher vergebene + 1 (beginnt bei 1). */
export function nextSequence(currentMax: number | null | undefined): number {
  return (currentMax ?? 0) + 1;
}

/* ------------------------------------------------------------------ */
/* Beträge und Steuer                                                  */
/* ------------------------------------------------------------------ */

/**
 * Ganzzahlige Division mit kaufmännischer Rundung (ab ,5 vom Nullpunkt weg).
 * Rechnet nur mit ganzen Zahlen, damit keine Gleitkomma-Fehler entstehen (z. B. 1,005 €).
 */
export function divideRounded(numerator: number, denominator: number): number {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
    throw new Error("divideRounded erwartet ganze Zahlen und einen Nenner ungleich 0");
  }
  const negative = numerator < 0 !== denominator < 0;
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  const quotient = Math.floor(n / d);
  const rest = n - quotient * d;
  const rounded = rest * 2 >= d ? quotient + 1 : quotient;
  return negative ? -rounded : rounded;
}

/** Umsatzsteuer auf die Nettosumme, kaufmännisch auf ganze Cent gerundet. */
export function taxOf(netCents: number, taxRateBasisPoints: number): number {
  return divideRounded(netCents * taxRateBasisPoints, 10_000);
}

export type InvoiceAmounts = {
  netCents: number;
  taxRateBasisPoints: number;
  taxCents: number;
  grossCents: number;
  smallBusiness: boolean;
};

/**
 * Summen einer Rechnung aus den Positionsbeträgen. Die Steuer wird einmal auf die Nettosumme berechnet
 * (nicht je Position). Kleinunternehmer (§ 19 UStG): keine Umsatzsteuer, Satz 0.
 */
export function invoiceAmounts(
  lineTotalsCents: number[],
  options: { taxRateBasisPoints: number; smallBusiness: boolean },
): InvoiceAmounts {
  const netCents = lineTotalsCents.reduce((sum, cents) => sum + cents, 0);
  const rate = options.smallBusiness ? 0 : options.taxRateBasisPoints;
  const taxCents = rate === 0 ? 0 : taxOf(netCents, rate);
  return { netCents, taxRateBasisPoints: rate, taxCents, grossCents: netCents + taxCents, smallBusiness: options.smallBusiness };
}

/** Beträge einer Stornorechnung: exakt die negierten Beträge der Originalrechnung (Summe beider = 0). */
export function cancellationAmounts(original: InvoiceAmounts): InvoiceAmounts {
  return {
    netCents: -original.netCents,
    taxRateBasisPoints: original.taxRateBasisPoints,
    taxCents: -original.taxCents,
    grossCents: -original.grossCents,
    smallBusiness: original.smallBusiness,
  };
}

/** Pflichthinweis für Kleinunternehmer auf Rechnungen */
export const SMALL_BUSINESS_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.";

const percent = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 1900 → „19 %“, 1950 → „19,5 %“ */
export function formatTaxRate(basisPoints: number): string {
  return `${percent.format(basisPoints / 100)} %`;
}

/** „19“, „19,5“, „7 %“ → Basispunkte (0–100 %). Ungültig: null */
export function parseTaxRate(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(/%$/, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return bp >= 0 && bp <= 10_000 ? bp : null;
}

/** Basispunkte für das Eingabefeld: 1900 → „19“, 1950 → „19,5“ */
export function taxRateToInput(basisPoints: number): string {
  return percent.format(basisPoints / 100).replace(/\./g, "");
}

/* ------------------------------------------------------------------ */
/* Platzhalter in Texten                                               */
/* ------------------------------------------------------------------ */

/** Platzhalter in Zahlungshinweis, E-Mail-Betreff und -Text. */
export const INVOICE_PLACEHOLDERS = {
  nummer: "Rechnungsnummer, z. B. RE-2026-0001",
  datum: "Rechnungsdatum",
  faellig: "Fälligkeitsdatum",
  betrag: "Rechnungsbetrag (brutto)",
  empfaenger: "Name des Rechnungsempfängers",
  firma: "Ihr Firmenname laut Firmendaten",
  art: "„Rechnung“ oder „Stornorechnung“",
} as const;

export type InvoicePlaceholder = keyof typeof INVOICE_PLACEHOLDERS;
export type PlaceholderValues = Record<InvoicePlaceholder, string>;

const PLACEHOLDER = /\{([a-zA-Zäöüß_]+)\}/g;

/** Ersetzt {nummer}, {faellig} … Unbekannte Platzhalter bleiben stehen. */
export function fillPlaceholders(template: string, values: Partial<Record<string, string>>): string {
  return template.replace(PLACEHOLDER, (match, key: string) => values[key] ?? match);
}

/** Platzhalter im Text, die es nicht gibt (z. B. Tippfehler wie {fällig}). */
export function unknownPlaceholders(template: string, allowed: readonly string[] = Object.keys(INVOICE_PLACEHOLDERS)): string[] {
  const unknown = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER)) if (!allowed.includes(match[1])) unknown.add(`{${match[1]}}`);
  return [...unknown];
}

/* ------------------------------------------------------------------ */
/* Bankverbindung                                                      */
/* ------------------------------------------------------------------ */

/** Leerzeichen raus, Großbuchstaben: „de89 3704 0044 …“ → „DE893704…“ */
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

/** Prüfziffer nach ISO 13616 (Modulo 97). Deutsche IBAN müssen 22 Stellen haben. */
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** In Vierergruppen: „DE89 3704 0044 0532 0130 00“ */
export function formatIban(input: string): string {
  return normalizeIban(input).replace(/(.{4})/g, "$1 ").trim();
}

/** BIC: 8 oder 11 Zeichen, z. B. COBADEFFXXX */
export function isValidBic(input: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(input.replace(/\s+/g, "").toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Kalendertage (Rechnungs-, Leistungs- und Fälligkeitsdatum)          */
/* ------------------------------------------------------------------ */

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;

/** „2026-10-14“ gültig? (prüft auch, ob es den Tag gibt) */
export function isDateInput(value: string): boolean {
  const m = value.match(DATE_INPUT);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * Kalendertag als Zeitpunkt 12:00 UTC. So zeigt jede Formatierung in deutscher Zeit (UTC+1/+2) denselben Tag,
 * unabhängig von Sommer- und Winterzeit.
 */
export function dateFromInput(value: string): Date {
  const m = value.match(DATE_INPUT);
  if (!m) throw new Error(`Ungültiges Datum: ${value}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

/** „2026-10-14“ + 14 Tage → „2026-10-28“ */
export function addDaysToInput(value: string, days: number): string {
  const date = dateFromInput(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Jahr aus „2026-10-14“ */
export function yearOfInput(value: string): number {
  return Number(value.slice(0, 4));
}

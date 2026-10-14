const TZ = "Europe/Berlin";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const number2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatMoney(cents: number): string {
  return euro.format(cents / 100);
}

/** 125 -> "1,25" */
export function formatQuantity(hundredths: number): string {
  return number2.format(hundredths / 100);
}

/** "1,25" | "1.25" | "1" -> 125. Ungültig: null */
export function parseQuantity(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** "85" | "85,50" | "1.234,50" -> Cent. Ungültig: null */
export function parseMoney(input: string): number | null {
  let s = input.trim().replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Cent-Wert für Formularfelder: 8550 -> "85,50" */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function lineTotalCents(quantityHundredths: number, unitPriceCents: number): number {
  return Math.round((quantityHundredths * unitPriceCents) / 100);
}

export function formatTicketNumber(id: number): string {
  return `T-${String(id).padStart(5, "0")}`;
}

export function formatInquiryNumber(id: number): string {
  return `A-${String(id).padStart(5, "0")}`;
}

/** "T-00042" oder "42" -> 42 */
export function parseTicketNumber(input: string): number | null {
  const m = input.trim().match(/^(?:T-?)?0*(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: TZ }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "–";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(
    new Date(date),
  );
}

/** Datum für <input type="date">: YYYY-MM-DD in deutscher Zeitzone */
export function toDateInput(date: Date | string = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(date),
  );
  return parts;
}

/** "vor 5 Minuten", "vor 3 Tagen" … */
export function formatRelative(date: Date | string, now: Date = new Date()): string {
  const diff = Math.round((new Date(date).getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return "gerade eben";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(date);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${number2.format(bytes / 1024)} KB`;
  return `${number2.format(bytes / (1024 * 1024))} MB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

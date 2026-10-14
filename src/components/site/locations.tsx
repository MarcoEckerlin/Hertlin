import { cn } from "@/lib/cn";

/**
 * Hertlin-Standorte auf der Website (Modul „Standorte“ und Fußzeile).
 * Daten kommen aus listWebsiteLocations() (src/lib/locations.ts); hier nur Darstellung und Hilfen.
 * Bewusst ohne eingebettete Karte (Datenschutz, CSP) – stattdessen ein Link „Route planen“ zu OpenStreetMap.
 */

export type SiteLocation = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string | null;
  email: string | null;
  /** Freitext, eine Zeile pro Eintrag */
  openingHours: string | null;
  note: string | null;
  isMain: boolean;
};

function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Öffnungszeiten aus dem Textfeld: Zeilen säubern, leere Zeilen entfernen. */
export function openingHourLines(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map(tidy)
    .filter((line) => line.length > 0);
}

/** „Mo–Fr: 8:00 – 17:00 Uhr“ → Tage und Zeiten. Ohne „Tage: “ am Anfang bleibt die Zeile ganz. */
export function splitOpeningHour(line: string): { days: string; hours: string } {
  const match = /^([^:]{1,40}):\s+(.+)$/.exec(line);
  return match ? { days: match[1].trim(), hours: match[2].trim() } : { days: "", hours: line };
}

/** „Hauptstraße 21, 12345 Musterstadt“ */
export function locationAddress(l: Pick<SiteLocation, "street" | "zip" | "city">): string {
  const place = [l.zip, l.city].map((v) => v.trim()).filter(Boolean).join(" ");
  return [l.street.trim(), place].filter(Boolean).join(", ");
}

/** Routenplaner von OpenStreetMap mit der Anschrift als Ziel. */
export function routeUrl(l: Pick<SiteLocation, "street" | "zip" | "city">): string {
  return `https://www.openstreetmap.org/directions?to=${encodeURIComponent(locationAddress(l))}`;
}

/** Anrufbare Adresse aus einer frei eingegebenen Nummer (z. B. „0731 / 12 34-50“), sonst null. */
export function locationTelHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.trim().replace(/(?!^\+)[^\d]/g, "");
  return /^\+?\d{3,20}$/.test(digits) ? `tel:${digits}` : null;
}

/** Telefonnummer als Link (bei ungültiger Nummer nur als Text). */
export function LocationPhone({ phone, className }: { phone: string; className?: string }) {
  const href = locationTelHref(phone);
  if (!href) return <span className={className}>{phone}</span>;
  return (
    <a href={href} className={cn("hover:underline hover:underline-offset-4", className)}>
      {phone}
    </a>
  );
}

/** Öffnungszeiten als Liste: Tage links, Zeiten rechts; Zeilen ohne Tage über die ganze Breite. */
export function LocationOpeningHours({ text, className }: { text: string | null; className?: string }) {
  const lines = openingHourLines(text);
  if (lines.length === 0) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {lines.map((line, i) => {
        const { days, hours } = splitOpeningHour(line);
        return (
          <li key={`${i}-${line}`} className="flex flex-wrap justify-between gap-x-4">
            {days ? (
              <>
                <span className="text-ink-soft">{days}</span>
                <span className="font-semibold text-ink">{hours}</span>
              </>
            ) : (
              <span className="text-ink">{hours}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

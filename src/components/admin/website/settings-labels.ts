import type { SiteSettings } from "@/lib/settings";

/** Textfelder der Firmendaten – nur die können noch „TODO“ enthalten (siehe unfinishedSettings). */
type TextSettingKey = { [K in keyof SiteSettings]: SiteSettings[K] extends string ? K : never }[keyof SiteSettings];

/** Deutsche Bezeichnungen der Firmendaten (für Hinweise auf unvollständige Angaben). Vollständig, sonst meckert tsc. */
export const SETTINGS_LABELS: Record<TextSettingKey, string> = {
  name: "Kurzname",
  legalName: "Firmierung",
  tagline: "Kurzbeschreibung",
  owner: "Inhaber bzw. Geschäftsführer",
  street: "Straße und Hausnummer",
  zip: "PLZ",
  city: "Ort",
  region: "Einsatzgebiet",
  phone: "Telefonnummer",
  phoneHref: "Telefonnummer für Anruf-Links",
  email: "E-Mail-Adresse",
  supportEmail: "E-Mail-Adresse für den Support",
  vatId: "USt-IdNr.",
  register: "Registereintrag",
  remoteSupportUrl: "Link zur Fernwartung",
  hostingProvider: "Hosting-Anbieter",
};

export function settingsLabelList(keys: string[]): string {
  return keys.map((k) => (SETTINGS_LABELS as Record<string, string>)[k] ?? k).join(", ");
}

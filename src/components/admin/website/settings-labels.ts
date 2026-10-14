/** Deutsche Bezeichnungen der Firmendaten (für Hinweise auf unvollständige Angaben). */
export const SETTINGS_LABELS: Record<string, string> = {
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
};

export function settingsLabelList(keys: string[]): string {
  return keys.map((k) => SETTINGS_LABELS[k] ?? k).join(", ");
}

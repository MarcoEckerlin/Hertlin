/**
 * Zentrale Firmenangaben. Alles, was auf der Website, in E-Mails und im
 * Impressum erscheint, wird hier gepflegt.
 *
 * WICHTIG: Werte mit "TODO" vor dem Livegang durch die echten Angaben ersetzen.
 */
export const site = {
  name: "Hertlin",
  legalName: "Hertlin IT-Service", // TODO: exakte Firmierung laut Handelsregister/Gewerbeanmeldung
  tagline: "IT-Service für Unternehmen und Privatkunden",
  owner: "TODO Vorname Nachname",
  street: "TODO Straße Hausnummer",
  zip: "TODO PLZ",
  city: "TODO Ort",
  region: "TODO Region (z. B. Raum Stuttgart)",
  phone: "TODO 0000 000000",
  phoneHref: "+490000000000",
  email: "info@hertlin.de",
  supportEmail: "support@hertlin.de",
  vatId: "TODO USt-IdNr.",
  register: "", // z. B. "Amtsgericht Musterstadt, HRB 12345" – leer lassen, falls nicht eingetragen
  openingHours: [
    { days: "Montag bis Donnerstag", hours: "8:00 – 17:00 Uhr" },
    { days: "Freitag", hours: "8:00 – 14:00 Uhr" },
  ],
  /** Reaktionszeiten für Firmenkunden mit Betreuungsvertrag, innerhalb der Servicezeiten */
  responseTimes: [
    { priority: "CRITICAL", label: "Kritisch – der Betrieb steht", time: "innerhalb von 1 Stunde" },
    { priority: "HIGH", label: "Hoch – mehrere Arbeitsplätze betroffen", time: "innerhalb von 4 Stunden" },
    { priority: "NORMAL", label: "Normal – einzelner Arbeitsplatz", time: "am nächsten Werktag" },
    { priority: "LOW", label: "Niedrig – Frage oder Wunsch", time: "innerhalb von 3 Werktagen" },
  ],
  /** Für die Datenschutzerklärung */
  hostingProvider: "TODO Name und Anschrift des Hosting-Anbieters",
  logRetentionDays: 14,
  /** Link zum Fernwartungs-Programm (z. B. TeamViewer QuickSupport oder AnyDesk) */
  remoteSupportUrl: "https://get.teamviewer.com/", // TODO: eigenen QuickSupport-Link eintragen
} as const;

export type Site = typeof site;

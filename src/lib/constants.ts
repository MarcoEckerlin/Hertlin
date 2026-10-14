/**
 * Feste Werte und deutsche Bezeichnungen für Status, Prioritäten, Rollen usw.
 * In der Datenbank stehen die Schlüssel (z. B. "IN_PROGRESS"), angezeigt werden die Labels.
 */

export const ROLES = ["ADMIN", "TECHNICIAN", "CUSTOMER_ADMIN", "CUSTOMER_USER"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: readonly Role[] = ["ADMIN", "TECHNICIAN"];
export const CUSTOMER_ROLES: readonly Role[] = ["CUSTOMER_ADMIN", "CUSTOMER_USER"];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  TECHNICIAN: "Techniker",
  CUSTOMER_ADMIN: "Hauptansprechpartner",
  CUSTOMER_USER: "Mitarbeiter",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Voller Zugriff inklusive Kosten, Kundenverwaltung und Team.",
  TECHNICIAN: "Bearbeitet Tickets und Anfragen. Sieht keine Kosten.",
  CUSTOMER_ADMIN: "Sieht alle Tickets des Kunden und verwaltet Benutzer und Unterkunden.",
  CUSTOMER_USER: "Erstellt eigene Tickets und sieht nur diese.",
};

export const TICKET_STATUSES = ["NEW", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const OPEN_STATUSES: readonly TicketStatus[] = ["NEW", "IN_PROGRESS", "WAITING_CUSTOMER"];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "Neu",
  IN_PROGRESS: "In Bearbeitung",
  WAITING_CUSTOMER: "Rückfrage an Sie",
  RESOLVED: "Gelöst",
  CLOSED: "Geschlossen",
};

/** Bezeichnung aus Sicht der Hertlin-Mitarbeiter */
export const STATUS_LABELS_STAFF: Record<TicketStatus, string> = {
  ...STATUS_LABELS,
  WAITING_CUSTOMER: "Wartet auf Kunde",
};

export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
  CRITICAL: "Kritisch",
};

export const PRIORITY_HINTS: Record<TicketPriority, string> = {
  LOW: "Frage, Wunsch oder etwas, das warten kann",
  NORMAL: "Ein Arbeitsplatz oder eine Person ist eingeschränkt",
  HIGH: "Mehrere Personen oder ein wichtiges System betroffen",
  CRITICAL: "Der Betrieb steht, niemand kann arbeiten",
};

export const TICKET_TYPES = ["STOERUNG", "ANFRAGE"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TYPE_LABELS: Record<TicketType, string> = {
  STOERUNG: "Störung",
  ANFRAGE: "Anfrage",
};

export const TYPE_HINTS: Record<TicketType, string> = {
  STOERUNG: "Etwas funktioniert nicht oder nicht mehr richtig.",
  ANFRAGE: "Angebot, Bestellung, neuer Benutzer, Beratung oder eine Änderung.",
};

export const TICKET_CATEGORIES = [
  "ARBEITSPLATZ",
  "DRUCKER",
  "NETZWERK",
  "EMAIL",
  "SERVER",
  "SICHERHEIT",
  "TELEFONIE",
  "SOFTWARE",
  "HARDWARE",
  "BENUTZER",
  "SONSTIGES",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ARBEITSPLATZ: "PC, Notebook, Arbeitsplatz",
  DRUCKER: "Drucker und Scanner",
  NETZWERK: "Netzwerk, WLAN, Internet",
  EMAIL: "E-Mail und Microsoft 365",
  SERVER: "Server, Backup, NAS",
  SICHERHEIT: "Virenverdacht, Sicherheit",
  TELEFONIE: "Telefonie",
  SOFTWARE: "Software und Branchenprogramme",
  HARDWARE: "Neue Hardware, Bestellung",
  BENUTZER: "Benutzer anlegen oder sperren",
  SONSTIGES: "Sonstiges",
};

export const TICKET_SOURCES = ["PORTAL", "PRIVATE_FORM", "STAFF"] as const;
export type TicketSource = (typeof TICKET_SOURCES)[number];

export const SOURCE_LABELS: Record<TicketSource, string> = {
  PORTAL: "Kundenportal",
  PRIVATE_FORM: "Formular Privatkunden",
  STAFF: "Von Hertlin erfasst",
};

export const COST_KINDS = ["LABOR", "TRAVEL", "MATERIAL", "FLAT"] as const;
export type CostKind = (typeof COST_KINDS)[number];

export const COST_KIND_LABELS: Record<CostKind, string> = {
  LABOR: "Arbeitszeit",
  TRAVEL: "Anfahrt",
  MATERIAL: "Material",
  FLAT: "Pauschale",
};

/** Vorschlagswerte beim Erfassen (können pro Eintrag überschrieben werden) */
export const COST_KIND_DEFAULT_UNIT: Record<CostKind, string> = {
  LABOR: "Std.",
  TRAVEL: "Pauschale",
  MATERIAL: "Stk.",
  FLAT: "Pauschale",
};

export const COST_UNITS = ["Std.", "Min.", "Stk.", "km", "Pauschale"] as const;

export const CUSTOMER_TYPES = ["PRIVATE", "BUSINESS"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  PRIVATE: "Privatkunde",
  BUSINESS: "Unternehmen",
};

export const INQUIRY_STATUSES = ["NEW", "CONTACTED", "OFFER_SENT", "WON", "LOST"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: "Neu",
  CONTACTED: "Kontaktiert",
  OFFER_SENT: "Angebot verschickt",
  WON: "Auftrag erhalten",
  LOST: "Kein Auftrag",
};

export const INQUIRY_TOPICS = [
  "BETREUUNG",
  "EINRICHTUNG",
  "NETZWERK",
  "MICROSOFT365",
  "BACKUP",
  "SICHERHEIT",
  "HARDWARE",
  "PRIVAT_HILFE",
  "SONSTIGES",
] as const;
export type InquiryTopic = (typeof INQUIRY_TOPICS)[number];

export const INQUIRY_TOPIC_LABELS: Record<InquiryTopic, string> = {
  BETREUUNG: "Laufende IT-Betreuung für meine Firma",
  EINRICHTUNG: "Neue Arbeitsplätze oder Büro einrichten",
  NETZWERK: "Netzwerk, WLAN oder Internetanschluss",
  MICROSOFT365: "Microsoft 365, E-Mail, Umzug in die Cloud",
  BACKUP: "Datensicherung und Server",
  SICHERHEIT: "IT-Sicherheit, Firewall, Virenschutz",
  HARDWARE: "Hardware kaufen und einrichten lassen",
  PRIVAT_HILFE: "Hilfe für zu Hause (PC, Drucker, WLAN)",
  SONSTIGES: "Etwas anderes",
};

export const WORKPLACE_RANGES = ["1-5", "6-15", "16-30", "31-60", "60+"] as const;

export const WORKPLACE_LABELS: Record<(typeof WORKPLACE_RANGES)[number], string> = {
  "1-5": "1 bis 5",
  "6-15": "6 bis 15",
  "16-30": "16 bis 30",
  "31-60": "31 bis 60",
  "60+": "mehr als 60",
};

export const CONTACT_PREFERENCES = ["PHONE", "EMAIL"] as const;
export const CONTACT_PREFERENCE_LABELS: Record<(typeof CONTACT_PREFERENCES)[number], string> = {
  PHONE: "Telefonisch",
  EMAIL: "Per E-Mail",
};

export function labelOf<T extends string>(labels: Record<T, string>, key: string | null | undefined): string {
  if (!key) return "–";
  return (labels as Record<string, string>)[key] ?? key;
}

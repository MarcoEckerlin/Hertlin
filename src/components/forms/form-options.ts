import {
  INQUIRY_TOPICS,
  INQUIRY_TOPIC_LABELS,
  type CustomerType,
  type InquiryTopic,
  type TicketCategory,
} from "@/lib/constants";

/**
 * Auswahllisten für die öffentlichen Formulare.
 * Gemeinsam genutzt von den Formularen (Client) und den Server Actions (Prüfung).
 */

/* ---------- Anfrage von Neukunden (/kontakt) ---------- */

/** Themen, die für Privatpersonen sinnvoll sind (Reihenfolge = Anzeige). */
export const PRIVATE_INQUIRY_TOPICS = [
  "PRIVAT_HILFE",
  "HARDWARE",
  "NETZWERK",
  "BACKUP",
  "SICHERHEIT",
  "SONSTIGES",
] as const satisfies readonly InquiryTopic[];

/** Themen für Unternehmen: alles außer der Hilfe für zu Hause. */
export const BUSINESS_INQUIRY_TOPICS: readonly InquiryTopic[] = INQUIRY_TOPICS.filter((t) => t !== "PRIVAT_HILFE");

/** Für Privatpersonen verständlichere Bezeichnungen. Gespeichert wird immer der Schlüssel. */
const PRIVATE_TOPIC_LABELS: Partial<Record<InquiryTopic, string>> = {
  PRIVAT_HILFE: "Hilfe bei PC, Drucker oder WLAN",
  HARDWARE: "Neues Gerät kaufen und einrichten lassen",
  NETZWERK: "WLAN im ganzen Haus, Router, Internetanschluss",
  BACKUP: "Datensicherung, z. B. für Fotos und Dokumente",
  SICHERHEIT: "Virenschutz und sichere Passwörter",
  SONSTIGES: "Etwas anderes",
};

export function inquiryTopicsFor(type: CustomerType): readonly InquiryTopic[] {
  return type === "PRIVATE" ? PRIVATE_INQUIRY_TOPICS : BUSINESS_INQUIRY_TOPICS;
}

export function inquiryTopicLabel(topic: InquiryTopic, type: CustomerType): string {
  return (type === "PRIVATE" ? PRIVATE_TOPIC_LABELS[topic] : undefined) ?? INQUIRY_TOPIC_LABELS[topic];
}

export function isInquiryTopic(value: string | undefined | null): value is InquiryTopic {
  return !!value && (INQUIRY_TOPICS as readonly string[]).includes(value);
}

/* ---------- Hilfe-Formular für Privatkunden ---------- */

/** Bereiche, die Privatkunden auswählen können. */
export const PRIVATE_TICKET_CATEGORIES = [
  "ARBEITSPLATZ",
  "DRUCKER",
  "NETZWERK",
  "EMAIL",
  "SICHERHEIT",
  "SOFTWARE",
  "HARDWARE",
  "SONSTIGES",
] as const satisfies readonly TicketCategory[];

export type PrivateTicketCategory = (typeof PRIVATE_TICKET_CATEGORIES)[number];

/** Bezeichnungen aus Sicht von Privatkunden (in der Verwaltung gelten die normalen Kategorien). */
export const PRIVATE_CATEGORY_LABELS: Record<PrivateTicketCategory, string> = {
  ARBEITSPLATZ: "Computer oder Notebook",
  DRUCKER: "Drucker oder Scanner",
  NETZWERK: "WLAN, Router oder Internet",
  EMAIL: "E-Mail-Postfach",
  SICHERHEIT: "Virus, Betrug oder gehacktes Konto",
  SOFTWARE: "Programme, Apps oder Updates",
  HARDWARE: "Neues Gerät kaufen oder einrichten",
  SONSTIGES: "Etwas anderes oder weiß nicht genau",
};

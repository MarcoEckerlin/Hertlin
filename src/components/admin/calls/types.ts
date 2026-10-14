/** Gemeinsame Typen und Werte für die Anruf-Formulare (Server und Browser). */

/** Auswahlwert „Privatkunde (ohne Kundenkonto)“ im Formular „Ticket aus Anruf“ */
export const PRIVATE_CUSTOMER = "privat";

export type CustomerGroup = {
  rootId: string;
  rootName: string;
  /** Firmenkunde selbst (zuerst) und seine Unterkunden */
  companies: { id: string; name: string; isRoot: boolean; users: { id: string; name: string }[] }[];
};

export type TicketFormDefaults = {
  customer: string;
  contactUserId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

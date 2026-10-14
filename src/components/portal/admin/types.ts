/**
 * Gemeinsame Typen der Benutzer- und Unterkundenverwaltung im Kundenportal.
 * Bewusst ohne Server-Abhängigkeiten, damit auch Client-Formulare sie nutzen können.
 */

export type PortalRole = "CUSTOMER_ADMIN" | "CUSTOMER_USER";

/** Zugangsstatus eines Benutzers: „Deaktiviert“ hat Vorrang vor „Einladung offen“. */
export type UserAccessStatus = "ACTIVE" | "INVITED" | "INACTIVE";

/** Firma oder Unterkunde, die ein Hauptansprechpartner auswählen darf. */
export type CompanyOption = {
  id: string;
  name: string;
  /** true = der Firmenkunde selbst, false = Unterkunde */
  isRoot: boolean;
  active: boolean;
};

export type SubCustomerFormValues = {
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
};

export type PortalUserFormValues = {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  role: PortalRole;
  companyId: string;
  active: boolean;
};

export function accessStatus(user: { active: boolean }, invited: boolean): UserAccessStatus {
  if (!user.active) return "INACTIVE";
  return invited ? "INVITED" : "ACTIVE";
}

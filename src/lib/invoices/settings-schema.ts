import { z } from "zod";
import { INVOICE_PREFIX_PATTERN, isValidIban } from "@/lib/invoices/calc";

/**
 * Rechnungseinstellungen (Verwaltung > Rechnungen > Einstellungen), gespeichert als JSON in SiteSetting "billing".
 * Absenderangaben (Firmierung, Anschrift, USt-IdNr. …) kommen aus den Firmendaten (SiteSetting "company").
 * Diese Datei enthält nur Schema, Vorgaben und Prüfungen – ohne Datenbank, damit sie überall nutzbar ist.
 */

export const billingSettingsSchema = z.object({
  /** Steuernummer vom Finanzamt, z. B. 12/345/67890 */
  taxNumber: z.string().max(40),
  /** Kleinunternehmer nach § 19 UStG: keine Umsatzsteuer */
  smallBusiness: z.boolean(),
  /** 1900 = 19 % */
  taxRateBasisPoints: z.number().int().min(0).max(10_000),
  paymentTermDays: z.number().int().min(0).max(365),
  numberPrefix: z.string().regex(INVOICE_PREFIX_PATTERN),
  bankAccountHolder: z.string().max(120),
  iban: z.string().max(42),
  bic: z.string().max(11),
  bankName: z.string().max(120),
  introText: z.string().max(1000),
  paymentNote: z.string().max(1000),
  emailSubject: z.string().max(200),
  emailText: z.string().max(4000),
  /** Optional: Kopie jeder Rechnungs-E-Mail (BCC) an eine eigene Adresse, z. B. buchhaltung@… */
  bccEmail: z.string().max(200),
});

export type BillingSettings = z.infer<typeof billingSettingsSchema>;

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  taxNumber: "",
  smallBusiness: false,
  taxRateBasisPoints: 1900,
  paymentTermDays: 14,
  numberPrefix: "RE",
  bankAccountHolder: "",
  iban: "",
  bic: "",
  bankName: "",
  introText: "Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen die folgenden Leistungen:",
  paymentNote:
    "Bitte überweisen Sie {betrag} bis zum {faellig} auf das unten genannte Konto. Geben Sie dabei bitte die Rechnungsnummer {nummer} an.",
  emailSubject: "{art} {nummer} von {firma}",
  emailText: [
    "Guten Tag,",
    "",
    "im Anhang finden Sie unsere {art} {nummer} vom {datum} über {betrag}.",
    "Bitte überweisen Sie den Betrag bis zum {faellig}.",
    "",
    "Bei Fragen zur Rechnung antworten Sie einfach auf diese E-Mail.",
    "",
    "Viele Grüße",
    "{firma}",
  ].join("\n"),
  bccEmail: "",
};

/** Vorlage für die E-Mail zu einer Stornorechnung (im Sendeformular änderbar). */
export const CANCELLATION_EMAIL_TEXT = [
  "Guten Tag,",
  "",
  "im Anhang finden Sie die Stornorechnung {nummer}. Sie hebt unsere Rechnung {original} vom {originaldatum} auf.",
  "",
  "Bei Fragen antworten Sie einfach auf diese E-Mail.",
  "",
  "Viele Grüße",
  "{firma}",
].join("\n");

/** Absenderangaben aus den Firmendaten, die auf jeder Rechnung stehen. */
export type IssuerSiteData = {
  name: string;
  legalName: string;
  owner: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  vatId: string;
  register: string;
};

export type BillingProblem = {
  /** Was fehlt, als ganzer Satz */
  message: string;
  /** Wo man es behebt */
  href: string;
  linkLabel: string;
};

/** Leer oder noch ein Platzhalter aus der Vorlage („TODO …“) */
export function isMissing(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  return v === "" || v.toUpperCase().startsWith("TODO");
}

const SITE_FIELDS: { key: keyof IssuerSiteData; label: string }[] = [
  { key: "legalName", label: "Firmierung" },
  { key: "owner", label: "Inhaber bzw. Geschäftsführer" },
  { key: "street", label: "Straße und Hausnummer" },
  { key: "zip", label: "PLZ" },
  { key: "city", label: "Ort" },
  { key: "phone", label: "Telefonnummer" },
  { key: "email", label: "E-Mail-Adresse" },
];

const FIRMENDATEN = { href: "/admin/website/firmendaten", linkLabel: "Firmendaten bearbeiten" };
const EINSTELLUNGEN = { href: "/admin/rechnungen/einstellungen", linkLabel: "Rechnungseinstellungen" };

/**
 * Pflichtangaben für Rechnungen (§ 14 UStG): vollständige Anschrift des Absenders, Steuernummer oder USt-IdNr.
 * und eine Bankverbindung für die Zahlung. Solange etwas fehlt, kann keine Rechnung erstellt werden.
 */
export function billingProblems(billing: BillingSettings, site: IssuerSiteData): BillingProblem[] {
  const problems: BillingProblem[] = [];

  const missingSite = SITE_FIELDS.filter((f) => isMissing(site[f.key])).map((f) => f.label);
  if (missingSite.length > 0) {
    problems.push({
      message: `In den Firmendaten fehlen noch: ${missingSite.join(", ")}.`,
      ...FIRMENDATEN,
    });
  }

  if (isMissing(billing.taxNumber) && isMissing(site.vatId)) {
    problems.push({
      message: "Auf jeder Rechnung muss Ihre Steuernummer oder Ihre USt-IdNr. stehen. Bitte mindestens eine davon eintragen.",
      ...EINSTELLUNGEN,
    });
  }

  if (isMissing(billing.iban)) {
    problems.push({ message: "Es ist noch keine Bankverbindung (IBAN) hinterlegt.", ...EINSTELLUNGEN });
  } else if (!isValidIban(billing.iban)) {
    problems.push({ message: "Die hinterlegte IBAN ist ungültig.", ...EINSTELLUNGEN });
  }

  if (isMissing(billing.bankAccountHolder) && isMissing(site.legalName)) {
    problems.push({ message: "Bitte den Kontoinhaber der Bankverbindung angeben.", ...EINSTELLUNGEN });
  }

  return problems;
}

/** USt-IdNr. aus den Firmendaten, sofern schon echt eingetragen */
export function issuerVatId(site: IssuerSiteData): string | null {
  return isMissing(site.vatId) ? null : site.vatId.trim();
}

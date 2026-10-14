import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  costAccountHref,
  costAccountParams,
  privateAccountEmail,
  privateEmailVariants,
  type CostAccount,
} from "@/lib/costs";
import { formatTicketNumber } from "@/lib/format";

/**
 * Rechnungsempfänger („Konto“ für Rechnungen):
 * - Firmenkunde mit allen Unterkunden, die keine eigene Rechnung bekommen
 * - Unterkunde mit eigener Rechnung (invoiceSeparately)
 * - Privatkunde, zusammengefasst über die E-Mail-Adresse (Anschrift aus dem Ticket)
 * - einzelnes Privatkunden-Ticket ohne E-Mail-Adresse
 * Kennung in Formularen und Adressen wie bei den Kostenkonten: konto | email | ticket.
 */

export type RecipientKey = CostAccount;

export type BillingRecipient = {
  key: RecipientKey;
  /** Formular- bzw. Query-Felder (konto | email | ticket) */
  params: Record<string, string>;
  kind: "company" | "sub" | "private" | "ticket";
  /** Anzeigename in der Verwaltung */
  label: string;
  /** Kurze Erklärung, welche Tickets dazugehören */
  description: string;
  companyId: string | null;
  /** Firmenkunde (Wurzel), zu dem der Empfänger gehört */
  rootCompanyId: string | null;
  privateEmail: string | null;
  customerNumber: string | null;
  ticketWhere: Prisma.TicketWhereInput;
  /** Gespeicherte Rechnungsdaten */
  name: string;
  addressLines: string[];
  email: string | null;
  /** Woher die E-Mail-Adresse stammt (für den Hinweis in der Vorschau) */
  emailSource: "billing" | "company" | "contact" | null;
  vatId: string | null;
  /** Positionen dieses Empfängers in der Kostenübersicht */
  costHref: string;
  /** Rechnungsdaten bearbeiten (nur Firmen) */
  editHref: string | null;
  /** Firmenkunde: Unterkunden, die über ihn abgerechnet werden bzw. eine eigene Rechnung bekommen */
  includedSubs: string[];
  separateSubs: string[];
};

const companySelect = {
  id: true,
  name: true,
  parentId: true,
  customerNumber: true,
  street: true,
  zip: true,
  city: true,
  email: true,
  billingEmail: true,
  billingName: true,
  billingStreet: true,
  billingZip: true,
  billingCity: true,
  vatId: true,
  invoiceSeparately: true,
} satisfies Prisma.CompanySelect;

type CompanyRow = Prisma.CompanyGetPayload<{ select: typeof companySelect }>;

/** Rechnungsanschrift: abweichende Rechnungsanschrift, sonst die Firmenanschrift. */
export function billingAddressLines(c: Pick<CompanyRow, "street" | "zip" | "city" | "billingStreet" | "billingZip" | "billingCity">) {
  const billing = [c.billingStreet, c.billingZip, c.billingCity].some((v) => v?.trim());
  const street = billing ? c.billingStreet : c.street;
  const zip = billing ? c.billingZip : c.zip;
  const city = billing ? c.billingCity : c.city;
  return [street?.trim(), [zip?.trim(), city?.trim()].filter(Boolean).join(" ")].filter((l): l is string => !!l);
}

/**
 * Vollständige Anschrift für eine Rechnung (§ 14 Abs. 4 UStG): mindestens Straße und eine Zeile mit PLZ und Ort.
 * Erwartet die Zeilen, wie sie auf der Rechnung stehen (ohne den Namen).
 */
export function isCompleteAddress(address: string | string[]): boolean {
  const lines = (Array.isArray(address) ? address : address.split("\n")).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  return lines.some((l) => /\b\d{4,5}\s+\S/.test(l)) && lines.some((l) => !/^\d{4,5}\s/.test(l));
}

/** Freitext-Anschrift eines Privatkunden („Lindenstraße 8, 12345 Musterstadt“) in Zeilen. */
export function splitAddress(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\n|,\s*(?=\d{4,5}\s)/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

async function resolveCompany(companyId: string, depth = 0): Promise<BillingRecipient | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      ...companySelect,
      parent: { select: companySelect },
      children: { orderBy: { name: "asc" }, select: { id: true, name: true, invoiceSeparately: true } },
    },
  });
  if (!company) return null;

  // Unterkunde ohne eigene Rechnung: Empfänger ist der Firmenkunde
  if (company.parent && !company.invoiceSeparately) {
    return depth === 0 ? resolveCompany(company.parent.id, 1) : null;
  }

  const key: RecipientKey = { kind: "company", companyId: company.id };
  const base = {
    key,
    params: costAccountParams(key),
    companyId: company.id,
    privateEmail: null,
    editHref: `/admin/kunden/${company.id}/bearbeiten#rechnungsdaten`,
  };

  if (company.parent) {
    const parent = company.parent;
    const email = company.billingEmail || company.email || null;
    return {
      ...base,
      kind: "sub",
      label: company.name,
      description: `Unterkunde von ${parent.name} mit eigener Rechnung`,
      rootCompanyId: parent.id,
      customerNumber: company.customerNumber ?? parent.customerNumber ?? null,
      ticketWhere: { companyId: company.id },
      name: company.billingName?.trim() || `${parent.name}, ${company.name}`,
      addressLines: billingAddressLines(company),
      email,
      emailSource: company.billingEmail ? "billing" : company.email ? "company" : null,
      vatId: company.vatId ?? parent.vatId ?? null,
      costHref: costAccountHref({ kind: "company", companyId: parent.id }),
      includedSubs: [],
      separateSubs: [],
    };
  }

  const included = company.children.filter((c) => !c.invoiceSeparately);
  const separate = company.children.filter((c) => c.invoiceSeparately);
  const email = company.billingEmail || company.email || null;
  return {
    ...base,
    kind: "company",
    label: company.name,
    description: [
      included.length === 0
        ? "Firmenkunde"
        : included.length <= 3
          ? `Firmenkunde inklusive ${included.map((c) => `„${c.name}“`).join(", ")}`
          : `Firmenkunde inklusive ${plural(included.length, "Unterkunde", "Unterkunden")}`,
      separate.length > 0 ? `eigene Rechnung: ${separate.map((c) => c.name).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    rootCompanyId: company.id,
    customerNumber: company.customerNumber ?? null,
    ticketWhere: { companyId: { in: [company.id, ...included.map((c) => c.id)] } },
    name: company.billingName?.trim() || company.name,
    addressLines: billingAddressLines(company),
    email,
    emailSource: company.billingEmail ? "billing" : company.email ? "company" : null,
    vatId: company.vatId ?? null,
    costHref: costAccountHref(key),
    includedSubs: included.map((c) => c.name),
    separateSubs: separate.map((c) => c.name),
  };
}

/** Prüft, ob es den Empfänger gibt, und liefert die gespeicherten Rechnungsdaten. */
export async function resolveRecipient(key: RecipientKey): Promise<BillingRecipient | null> {
  if (key.kind === "company") return resolveCompany(key.companyId);

  if (key.kind === "private") {
    const variants = await privateEmailVariants(key.email);
    if (variants.length === 0) return null;
    const ticketWhere: Prisma.TicketWhereInput = { companyId: null, contactEmail: { in: variants } };
    const [named, withAddress] = await Promise.all([
      db.ticket.findFirst({
        where: { ...ticketWhere, contactName: { not: null } },
        orderBy: { id: "desc" },
        select: { contactName: true },
      }),
      db.ticket.findFirst({
        where: { ...ticketWhere, contactAddress: { not: null } },
        orderBy: { id: "desc" },
        select: { contactAddress: true },
      }),
    ]);
    const name = named?.contactName?.trim() || key.email;
    return {
      key,
      params: costAccountParams(key),
      kind: "private",
      label: name,
      description: "Privatkunde, alle Tickets mit dieser E-Mail-Adresse",
      companyId: null,
      rootCompanyId: null,
      privateEmail: key.email,
      customerNumber: null,
      ticketWhere,
      name,
      addressLines: splitAddress(withAddress?.contactAddress),
      email: key.email,
      emailSource: "contact",
      vatId: null,
      costHref: costAccountHref(key),
      editHref: null,
      includedSubs: [],
      separateSubs: [],
    };
  }

  const ticket = await db.ticket.findFirst({
    where: { id: key.ticketId, companyId: null },
    select: { id: true, contactName: true, contactEmail: true, contactAddress: true },
  });
  if (!ticket) return null;
  // Ticket hat inzwischen eine E-Mail-Adresse: Konto des Privatkunden verwenden
  const email = privateAccountEmail(ticket.contactEmail);
  if (email) return resolveRecipient({ kind: "private", email });
  const name = ticket.contactName?.trim() || `Privatkunde zu ${formatTicketNumber(ticket.id)}`;
  return {
    key,
    params: costAccountParams(key),
    kind: "ticket",
    label: name,
    description: `Privatkunde ohne E-Mail-Adresse, nur Ticket ${formatTicketNumber(ticket.id)}`,
    companyId: null,
    rootCompanyId: null,
    privateEmail: null,
    customerNumber: null,
    ticketWhere: { id: ticket.id, companyId: null },
    name,
    addressLines: splitAddress(ticket.contactAddress),
    email: null,
    emailSource: null,
    vatId: null,
    costHref: costAccountHref(key),
    editHref: null,
    includedSubs: [],
    separateSubs: [],
  };
}

/** Gleicher Empfänger? (z. B. ob eine Adresse auf die kanonische Kennung umgeleitet werden muss) */
export function sameRecipientKey(a: RecipientKey, b: RecipientKey): boolean {
  return JSON.stringify(costAccountParams(a)) === JSON.stringify(costAccountParams(b));
}

/* ------------------------------------------------------------------ */
/* Offene Positionen eines Empfängers                                  */
/* ------------------------------------------------------------------ */

export const openEntrySelect = {
  id: true,
  kind: true,
  description: true,
  quantityHundredths: true,
  unit: true,
  unitPriceCents: true,
  totalCents: true,
  performedAt: true,
  needsPrice: true,
  billed: true,
  invoiceId: true,
  createdAt: true,
  ticket: { select: { id: true, subject: true, company: { select: { id: true, name: true, parentId: true } } } },
} satisfies Prisma.CostEntrySelect;

export type OpenEntry = Prisma.CostEntryGetPayload<{ select: typeof openEntrySelect }>;

/** Noch nicht abgerechnete Positionen (ohne Rechnung) – chronologisch. Mit ids nur diese. */
export async function openEntriesFor(recipient: BillingRecipient, ids?: string[]): Promise<OpenEntry[]> {
  return db.costEntry.findMany({
    where: {
      ticket: recipient.ticketWhere,
      billed: false,
      invoiceId: null,
      ...(ids ? { id: { in: ids } } : {}),
    },
    orderBy: [{ performedAt: "asc" }, { ticketId: "asc" }, { createdAt: "asc" }],
    select: openEntrySelect,
  });
}

/** Verweis einer Rechnungsposition: „Ticket T-00042“ bzw. mit Unterkunde, wenn sie mit abgerechnet wird. */
export function entryReference(entry: Pick<OpenEntry, "ticket">, recipient: Pick<BillingRecipient, "kind">): string {
  const ticket = `Ticket ${formatTicketNumber(entry.ticket.id)}`;
  const sub = recipient.kind === "company" && entry.ticket.company?.parentId ? entry.ticket.company.name : null;
  return sub ? `${ticket} (${sub})` : ticket;
}

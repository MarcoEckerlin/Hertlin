import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getInvoiceIssuer, type InvoiceIssuer } from "@/lib/billing-settings";
import { formatDate, formatMoney, toDateInput } from "@/lib/format";
import {
  addDaysToInput,
  dateFromInput,
  fillPlaceholders,
  formatInvoiceNumber,
  invoiceAmounts,
  nextSequence,
  normalizeIban,
  yearOfInput,
  type PlaceholderValues,
} from "@/lib/invoices/calc";
import { renderInvoicePdf, type InvoicePdfData, type InvoicePdfIssuer } from "@/lib/invoices/pdf";
import { entryReference, isCompleteAddress, openEntrySelect, type BillingRecipient } from "@/lib/invoices/recipients";
import { CANCELLATION_EMAIL_TEXT, isMissing, issuerVatId } from "@/lib/invoices/settings-schema";
import { invoicePdfPath, readInvoicePdf, removeInvoicePdf, writeInvoicePdf } from "@/lib/invoices/storage";
import { sendMailWithResult } from "@/lib/mail";

/**
 * Rechnungen erstellen, stornieren und versenden. Nur nach requireAdmin() aufrufen.
 * Eine Rechnung wird nie gelöscht und nach dem Erstellen nicht mehr verändert (nur Versand, Zahlung, Storno).
 */

export type ServiceResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Fachlicher Fehler mit Meldung für die Oberfläche – bricht die Transaktion ab. */
class InvoiceError extends Error {}

type Tx = Prisma.TransactionClient;

const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
const MAX_ATTEMPTS = 4;

/** Gleichzeitig vergebene Nummer (Unique-Verletzung) oder gesperrte Datenbank: erneut versuchen. */
function isRetryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2002" || error.code === "P2034";
  return error instanceof Error && /database is locked|SQLITE_BUSY/i.test(error.message);
}

/* ------------------------------------------------------------------ */
/* Nummernvergabe                                                      */
/* ------------------------------------------------------------------ */

/**
 * Nächste fortlaufende Nummer im Jahr (je Jahr ab 1, unabhängig vom Präfix). Innerhalb der Transaktion aufrufen,
 * in der auch die Rechnung angelegt wird; @@unique([year, sequence]) verhindert doppelte Nummern.
 */
export async function allocateInvoiceNumber(
  tx: Pick<Tx, "invoice">,
  prefix: string,
  year: number,
): Promise<{ sequence: number; number: string }> {
  const max = await tx.invoice.aggregate({ where: { year }, _max: { sequence: true } });
  const sequence = nextSequence(max._max.sequence);
  return { sequence, number: formatInvoiceNumber(prefix, year, sequence) };
}

/* ------------------------------------------------------------------ */
/* PDF-Daten                                                           */
/* ------------------------------------------------------------------ */

export const invoicePdfInclude = {
  lines: { orderBy: { position: "asc" } },
  cancelsInvoice: { select: { number: true, issueDate: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceForPdf = Prisma.InvoiceGetPayload<{ include: typeof invoicePdfInclude }>;

/** Absenderangaben für das PDF aus Firmendaten und Rechnungseinstellungen. */
export function pdfIssuer({ site, billing }: Pick<InvoiceIssuer, "site" | "billing">): InvoicePdfIssuer {
  const iban = normalizeIban(billing.iban);
  const keep = (value: string) => (isMissing(value) ? "" : value.trim());
  return {
    legalName: keep(site.legalName) || site.name,
    owner: keep(site.owner),
    street: keep(site.street),
    zip: keep(site.zip),
    city: keep(site.city),
    phone: keep(site.phone),
    email: keep(site.email),
    vatId: issuerVatId(site),
    taxNumber: keep(billing.taxNumber) || null,
    register: keep(site.register) || null,
    bank: iban
      ? {
          holder: keep(billing.bankAccountHolder) || keep(site.legalName) || site.name,
          iban,
          bic: keep(billing.bic).toUpperCase() || null,
          bankName: keep(billing.bankName) || null,
        }
      : null,
  };
}

export function pdfDataOf(invoice: InvoiceForPdf, issuer: InvoicePdfIssuer, customerNumber: string | null): InvoicePdfData {
  return {
    kind: invoice.kind === "CANCELLATION" ? "CANCELLATION" : "INVOICE",
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    servicePeriodStart: invoice.servicePeriodStart,
    servicePeriodEnd: invoice.servicePeriodEnd,
    customerNumber,
    recipientName: invoice.recipientName,
    recipientAddress: invoice.recipientAddress,
    recipientVatId: invoice.recipientVatId,
    cancels: invoice.cancelsInvoice ? { number: invoice.cancelsInvoice.number, issueDate: invoice.cancelsInvoice.issueDate } : null,
    introText: invoice.introText,
    footerText: invoice.footerText,
    lines: invoice.lines.map((l) => ({
      position: l.position,
      description: l.description,
      reference: l.reference,
      performedAt: l.performedAt,
      quantityHundredths: l.quantityHundredths,
      unit: l.unit,
      unitPriceCents: l.unitPriceCents,
      totalCents: l.totalCents,
    })),
    netCents: invoice.netCents,
    taxRateBasisPoints: invoice.taxRateBasisPoints,
    taxCents: invoice.taxCents,
    grossCents: invoice.grossCents,
    smallBusiness: invoice.smallBusiness,
    issuer,
  };
}

/** Erzeugt das PDF und legt es ab. Gibt Pfad und SHA-256 zurück. */
async function renderAndStore(
  invoice: InvoiceForPdf,
  issuer: InvoicePdfIssuer,
  customerNumber: string | null,
): Promise<{ relative: string; sha256: string }> {
  const pdf = await renderInvoicePdf(pdfDataOf(invoice, issuer, customerNumber));
  const relative = invoicePdfPath(invoice.year, invoice.number);
  await writeInvoicePdf(relative, pdf);
  return { relative, sha256: createHash("sha256").update(pdf).digest("hex") };
}

/** Gespeicherte Absenderangaben einer Rechnung lesen (null bei fehlender oder beschädigter Momentaufnahme). */
function parseIssuerSnapshot(value: string | null): InvoicePdfIssuer | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as InvoicePdfIssuer;
    return parsed && typeof parsed.legalName === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Kundennummer des Rechnungsempfängers (Unterkunde ohne eigene Nummer: die des Firmenkunden). */
export async function customerNumberFor(companyId: string | null): Promise<string | null> {
  if (!companyId) return null;
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { customerNumber: true, parent: { select: { customerNumber: true } } },
  });
  return company?.customerNumber ?? company?.parent?.customerNumber ?? null;
}

/**
 * PDF einer Rechnung lesen. Fehlt die Datei (z. B. nach einem Umzug ohne Speicherordner), wird sie aus den
 * gespeicherten Rechnungsdaten und der Absender-Momentaufnahme neu erzeugt – nie aus den aktuellen Firmendaten.
 * Gibt es keine Momentaufnahme, liefert die Funktion null: Dann muss die Datei aus der Sicherung zurück.
 */
export async function ensureInvoicePdf(invoiceId: string): Promise<{ pdf: Buffer; regenerated: boolean } | null> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: invoicePdfInclude });
  if (!invoice) return null;
  const stored = await readInvoicePdf(invoice.pdfPath);
  if (stored) return { pdf: stored, regenerated: false };

  const issuer = parseIssuerSnapshot(invoice.issuerSnapshot);
  if (!issuer) {
    console.error(`[rechnungen] PDF zu ${invoice.number} fehlt und kann nicht neu erzeugt werden (keine Absender-Momentaufnahme).`);
    return null;
  }
  console.warn(`[rechnungen] PDF zu ${invoice.number} fehlte und wurde aus den gespeicherten Rechnungsdaten neu erzeugt.`);
  const { relative } = await renderAndStore(invoice, issuer, invoice.customerNumber);
  await db.invoice.update({ where: { id: invoice.id }, data: { pdfPath: relative } });
  const pdf = await readInvoicePdf(relative);
  return pdf ? { pdf, regenerated: true } : null;
}

/* ------------------------------------------------------------------ */
/* Platzhalter                                                         */
/* ------------------------------------------------------------------ */

export function placeholderValues(
  invoice: { kind: string; number: string; issueDate: Date; dueDate: Date; grossCents: number; recipientName: string },
  siteName: string,
): PlaceholderValues {
  return {
    nummer: invoice.number,
    datum: formatDate(invoice.issueDate),
    faellig: formatDate(invoice.dueDate),
    betrag: formatMoney(invoice.grossCents),
    empfaenger: invoice.recipientName,
    firma: siteName,
    art: invoice.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung",
  };
}

/** Vorbelegung für „Per E-Mail senden“ (Betreff und Text aus den Einstellungen, Platzhalter ersetzt). */
export async function emailDraftFor(invoice: InvoiceForPdf): Promise<{ subject: string; text: string }> {
  const { billing, site } = await getInvoiceIssuer();
  const values = placeholderValues(invoice, site.name);
  if (invoice.kind === "CANCELLATION") {
    const extra = {
      original: invoice.cancelsInvoice?.number ?? "",
      originaldatum: invoice.cancelsInvoice ? formatDate(invoice.cancelsInvoice.issueDate) : "",
    };
    return {
      subject: fillPlaceholders(billing.emailSubject, values),
      text: fillPlaceholders(CANCELLATION_EMAIL_TEXT, { ...values, ...extra }),
    };
  }
  return { subject: fillPlaceholders(billing.emailSubject, values), text: fillPlaceholders(billing.emailText, values) };
}

/* ------------------------------------------------------------------ */
/* Rechnung erstellen                                                  */
/* ------------------------------------------------------------------ */

export type CreateInvoiceInput = {
  recipient: BillingRecipient;
  entryIds: string[];
  recipientName: string;
  /** Zeilen mit \n getrennt */
  recipientAddress: string;
  recipientEmail: string | null;
  /** YYYY-MM-DD; leer = aus den Leistungsdaten */
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  introText: string | null;
  createdById: string;
};

function positions(count: number): string {
  return count === 1 ? "1 Position" : `${count} Positionen`;
}

function quoteList(items: string[], max = 3): string {
  const shown = items.slice(0, max).map((d) => `„${d}“`);
  return items.length > max ? `${shown.join(", ")} und ${items.length - max} weitere` : shown.join(", ");
}

/**
 * Legt die Rechnung in einer Transaktion an: fortlaufende Nummer, Positionen als Kopie, Kostenpositionen als
 * abgerechnet markiert, PDF einmal erzeugt und gespeichert. Schlägt etwas fehl, bleibt alles unverändert.
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<ServiceResult<{ invoiceId: string; number: string }>> {
  const ids = [...new Set(input.entryIds)];
  if (ids.length === 0) return { ok: false, error: "Bitte wählen Sie mindestens eine Position aus." };

  const issuer = await getInvoiceIssuer();
  if (issuer.problems.length > 0) {
    return { ok: false, error: `Rechnungen sind noch nicht möglich: ${issuer.problems.map((p) => p.message).join(" ")}` };
  }
  const { billing, site } = issuer;
  const recipient = input.recipient;
  if (!isCompleteAddress(input.recipientAddress)) {
    return {
      ok: false,
      error: recipient.editHref
        ? "Die Rechnungsanschrift ist unvollständig. Bitte beim Kunden unter „Rechnungsdaten“ Straße, PLZ und Ort eintragen."
        : "Bitte die vollständige Anschrift angeben: Straße und Hausnummer sowie PLZ und Ort.",
    };
  }
  const customerNumber = recipient.customerNumber;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let written: string | null = null;
    try {
      const created = await db.$transaction(async (tx) => {
        const entries = await tx.costEntry.findMany({
          where: { id: { in: ids }, ticket: recipient.ticketWhere },
          orderBy: [{ performedAt: "asc" }, { ticketId: "asc" }, { createdAt: "asc" }],
          select: openEntrySelect,
        });
        if (entries.length !== ids.length) {
          throw new InvoiceError(
            "Einige Positionen gehören nicht (mehr) zu diesem Empfänger oder wurden gelöscht. Bitte laden Sie die Seite neu.",
          );
        }
        const billed = entries.filter((e) => e.billed || e.invoiceId);
        if (billed.length > 0) {
          throw new InvoiceError(
            `${positions(billed.length)} ${billed.length === 1 ? "ist" : "sind"} bereits abgerechnet: ${quoteList(billed.map((e) => e.description))}. Bitte die Auswahl anpassen.`,
          );
        }
        const noPrice = entries.filter((e) => e.needsPrice);
        if (noPrice.length > 0) {
          throw new InvoiceError(
            `Für ${positions(noPrice.length)} fehlt noch der Preis: ${quoteList(noPrice.map((e) => e.description))}. Bitte tragen Sie ihn im Ticket ein.`,
          );
        }

        const now = new Date();
        const today = toDateInput(now);
        const year = yearOfInput(today);
        const amounts = invoiceAmounts(
          entries.map((e) => e.totalCents),
          { taxRateBasisPoints: billing.taxRateBasisPoints, smallBusiness: billing.smallBusiness },
        );
        const dueDate = dateFromInput(addDaysToInput(today, billing.paymentTermDays));
        const firstDay = toDateInput(entries[0].performedAt);
        const lastDay = toDateInput(entries.reduce((max, e) => (e.performedAt > max ? e.performedAt : max), entries[0].performedAt));
        const periodStart = input.servicePeriodStart ?? firstDay;
        const periodEnd = input.servicePeriodEnd ?? lastDay;

        const { sequence, number } = await allocateInvoiceNumber(tx, billing.numberPrefix, year);
        const values = placeholderValues(
          { kind: "INVOICE", number, issueDate: now, dueDate, grossCents: amounts.grossCents, recipientName: input.recipientName },
          site.name,
        );

        const invoice = await tx.invoice.create({
          data: {
            number,
            year,
            sequence,
            kind: "INVOICE",
            status: "OPEN",
            companyId: recipient.companyId,
            privateEmail: recipient.privateEmail,
            recipientName: input.recipientName,
            recipientAddress: input.recipientAddress,
            recipientEmail: input.recipientEmail,
            recipientVatId: recipient.vatId,
            issueDate: now,
            servicePeriodStart: dateFromInput(periodStart),
            servicePeriodEnd: dateFromInput(periodEnd),
            dueDate,
            ...amounts,
            introText: input.introText?.trim() || null,
            footerText: fillPlaceholders(billing.paymentNote, values).trim() || null,
            createdById: input.createdById,
            lines: {
              create: entries.map((e, index) => ({
                position: index + 1,
                description: e.description,
                reference: entryReference(e, recipient),
                performedAt: e.performedAt,
                quantityHundredths: e.quantityHundredths,
                unit: e.unit,
                unitPriceCents: e.unitPriceCents,
                totalCents: e.totalCents,
                costEntryId: e.id,
              })),
            },
          },
          include: invoicePdfInclude,
        });

        const marked = await tx.costEntry.updateMany({
          where: { id: { in: ids }, billed: false, invoiceId: null, needsPrice: false },
          data: { billed: true, billedAt: now, invoiceId: invoice.id },
        });
        if (marked.count !== ids.length) {
          throw new InvoiceError("Die Positionen wurden gerade von jemand anderem geändert. Bitte laden Sie die Seite neu.");
        }

        const issuerData = pdfIssuer(issuer);
        const stored = await renderAndStore(invoice, issuerData, customerNumber);
        written = stored.relative;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { pdfPath: stored.relative, pdfSha256: stored.sha256, issuerSnapshot: JSON.stringify(issuerData), customerNumber },
        });
        return { invoiceId: invoice.id, number };
      }, TX_OPTIONS);
      return { ok: true, ...created };
    } catch (error) {
      if (written) await removeInvoicePdf(written);
      if (error instanceof InvoiceError) return { ok: false, error: error.message };
      if (isRetryable(error) && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
  return { ok: false, error: "Die Rechnungsnummer konnte nicht vergeben werden. Bitte versuchen Sie es noch einmal." };
}

/* ------------------------------------------------------------------ */
/* Stornieren                                                          */
/* ------------------------------------------------------------------ */

/**
 * Storniert eine Rechnung: Stornorechnung mit eigener Nummer und negativen Beträgen, Verweis auf das Original.
 * Das Original wird „storniert“, seine Kostenpositionen sind wieder offen und können neu abgerechnet werden.
 */
export async function cancelInvoice(input: {
  invoiceId: string;
  createdById: string;
}): Promise<ServiceResult<{ invoiceId: string; number: string; originalNumber: string; released: number }>> {
  const issuer = await getInvoiceIssuer();
  if (issuer.problems.length > 0) {
    return { ok: false, error: `Eine Stornorechnung ist noch nicht möglich: ${issuer.problems.map((p) => p.message).join(" ")}` };
  }
  // Außerhalb der Transaktion lesen (SQLite: nur eine schreibende Verbindung)
  const head = await db.invoice.findUnique({ where: { id: input.invoiceId }, select: { companyId: true, customerNumber: true } });
  if (!head) return { ok: false, error: "Diese Rechnung gibt es nicht. Bitte laden Sie die Seite neu." };
  // Kundennummer wie auf der Originalrechnung
  const customerNumber = head.customerNumber ?? (await customerNumberFor(head.companyId));

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let written: string | null = null;
    try {
      const created = await db.$transaction(async (tx) => {
        const original = await tx.invoice.findUnique({
          where: { id: input.invoiceId },
          include: { lines: { orderBy: { position: "asc" } }, cancelledBy: { select: { number: true } } },
        });
        if (!original) throw new InvoiceError("Diese Rechnung gibt es nicht. Bitte laden Sie die Seite neu.");
        if (original.kind !== "INVOICE") throw new InvoiceError("Eine Stornorechnung kann nicht storniert werden.");
        if (original.status === "CANCELLED" || original.cancelledBy) {
          throw new InvoiceError(
            `Diese Rechnung ist bereits storniert${original.cancelledBy ? ` (${original.cancelledBy.number})` : ""}.`,
          );
        }

        const now = new Date();
        const today = toDateInput(now);
        const year = yearOfInput(today);
        const { sequence, number } = await allocateInvoiceNumber(tx, issuer.billing.numberPrefix, year);

        const cancellation = await tx.invoice.create({
          data: {
            number,
            year,
            sequence,
            kind: "CANCELLATION",
            status: "OPEN",
            cancelsInvoiceId: original.id,
            companyId: original.companyId,
            privateEmail: original.privateEmail,
            recipientName: original.recipientName,
            recipientAddress: original.recipientAddress,
            recipientEmail: original.recipientEmail,
            recipientVatId: original.recipientVatId,
            issueDate: now,
            servicePeriodStart: original.servicePeriodStart,
            servicePeriodEnd: original.servicePeriodEnd,
            dueDate: dateFromInput(today),
            netCents: -original.netCents,
            taxRateBasisPoints: original.taxRateBasisPoints,
            taxCents: -original.taxCents,
            grossCents: -original.grossCents,
            smallBusiness: original.smallBusiness,
            introText: null,
            footerText: null,
            createdById: input.createdById,
            lines: {
              create: original.lines.map((l) => ({
                position: l.position,
                description: l.description,
                reference: l.reference,
                performedAt: l.performedAt,
                quantityHundredths: l.quantityHundredths,
                unit: l.unit,
                unitPriceCents: -l.unitPriceCents,
                totalCents: -l.totalCents,
                costEntryId: l.costEntryId,
              })),
            },
          },
          include: invoicePdfInclude,
        });

        // Nur ändern, wenn das Original noch nicht storniert ist (gleichzeitiges Stornieren)
        const updated = await tx.invoice.updateMany({
          where: { id: original.id, status: { not: "CANCELLED" } },
          data: { status: "CANCELLED", cancelledAt: now },
        });
        if (updated.count !== 1) throw new InvoiceError("Diese Rechnung wurde gerade storniert. Bitte laden Sie die Seite neu.");

        const released = await tx.costEntry.updateMany({
          where: { invoiceId: original.id },
          data: { billed: false, billedAt: null, invoiceId: null },
        });

        const issuerData = pdfIssuer(issuer);
        const stored = await renderAndStore(cancellation, issuerData, customerNumber);
        written = stored.relative;
        await tx.invoice.update({
          where: { id: cancellation.id },
          data: { pdfPath: stored.relative, pdfSha256: stored.sha256, issuerSnapshot: JSON.stringify(issuerData), customerNumber },
        });
        return { invoiceId: cancellation.id, number, originalNumber: original.number, released: released.count };
      }, TX_OPTIONS);
      return { ok: true, ...created };
    } catch (error) {
      if (written) await removeInvoicePdf(written);
      if (error instanceof InvoiceError) return { ok: false, error: error.message };
      if (isRetryable(error) && attempt < MAX_ATTEMPTS) continue;
      throw error;
    }
  }
  return { ok: false, error: "Die Nummer der Stornorechnung konnte nicht vergeben werden. Bitte versuchen Sie es noch einmal." };
}

/* ------------------------------------------------------------------ */
/* Versand                                                             */
/* ------------------------------------------------------------------ */

/** Schickt die Rechnung mit PDF im Anhang. Bei Erfolg: Status „versendet“, Versanddatum und Empfänger. */
export async function sendInvoice(input: {
  invoiceId: string;
  to: string;
  subject: string;
  text: string;
}): Promise<ServiceResult<{ sentTo: string; number: string }>> {
  const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId }, select: { id: true, number: true, kind: true } });
  if (!invoice) return { ok: false, error: "Diese Rechnung gibt es nicht. Bitte laden Sie die Seite neu." };

  const file = await ensureInvoicePdf(invoice.id);
  if (!file) return { ok: false, error: "Das PDF der Rechnung konnte nicht geladen werden." };

  const { billing } = await getInvoiceIssuer();
  const bcc = billing.bccEmail.trim();
  const result = await sendMailWithResult({
    to: input.to,
    bcc: bcc && bcc.toLowerCase() !== input.to.toLowerCase() ? bcc : undefined,
    subject: input.subject,
    text: input.text,
    attachments: [
      {
        filename: `${invoice.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung"}-${invoice.number}.pdf`,
        content: file.pdf,
        contentType: "application/pdf",
      },
    ],
  });
  if (!result.ok) {
    return { ok: false, error: `Die E-Mail konnte nicht verschickt werden (${result.error}). Die Rechnung bleibt unverändert.` };
  }
  if (result.via === "log") {
    // Ohne Mailserver steht die Mail nur im Mail-Protokoll – der Kunde hat nichts bekommen
    return {
      ok: false,
      error:
        "Es ist kein Mailserver eingerichtet (SMTP). Die E-Mail steht nur im Mail-Protokoll, beim Kunden ist nichts angekommen. " +
        "Laden Sie das PDF herunter, schicken Sie es selbst und markieren Sie die Rechnung danach als versendet.",
    };
  }

  const now = new Date();
  await db.$transaction([
    db.invoice.update({ where: { id: invoice.id }, data: { sentAt: now, sentTo: input.to } }),
    // Nur „noch nicht versendet“ wird zu „versendet“; bezahlt oder storniert bleibt
    db.invoice.updateMany({ where: { id: invoice.id, status: "OPEN" }, data: { status: "SENT" } }),
  ]);
  return { ok: true, sentTo: input.to, number: invoice.number };
}

/**
 * Rechnung als versendet markieren, wenn sie auf anderem Weg verschickt wurde (Post, eigenes E-Mail-Programm,
 * oder ohne eingerichteten Mailserver). Nur „noch nicht versendet“ wird zu „versendet“.
 */
export async function markInvoiceSent(input: { invoiceId: string; note: string }): Promise<ServiceResult<{ number: string }>> {
  const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId }, select: { id: true, number: true, status: true } });
  if (!invoice) return { ok: false, error: "Diese Rechnung gibt es nicht. Bitte laden Sie die Seite neu." };
  if (invoice.status === "CANCELLED") return { ok: false, error: "Diese Rechnung ist storniert." };
  const now = new Date();
  await db.$transaction([
    db.invoice.update({ where: { id: invoice.id }, data: { sentAt: now, sentTo: input.note } }),
    db.invoice.updateMany({ where: { id: invoice.id, status: "OPEN" }, data: { status: "SENT" } }),
  ]);
  return { ok: true, number: invoice.number };
}

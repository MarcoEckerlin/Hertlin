"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getBillingSettings, saveBillingSettings } from "@/lib/billing-settings";
import { parseCostAccount } from "@/lib/costs";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { emptyToUndefined, errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import {
  INVOICE_PLACEHOLDERS,
  INVOICE_PREFIX_PATTERN,
  dateFromInput,
  isDateInput,
  isValidBic,
  isValidIban,
  normalizeIban,
  parseTaxRate,
  unknownPlaceholders,
} from "@/lib/invoices/calc";
import { resolveRecipient } from "@/lib/invoices/recipients";
import { cancelInvoice, createInvoice, markInvoiceSent, sendInvoice } from "@/lib/invoices/service";
import { checkbox, email as emailSchema, requiredText } from "@/lib/validation";

/**
 * Rechnungen in der Verwaltung: Einstellungen, erstellen, versenden, Zahlung, Storno. Nur für Administratoren.
 * Rechnungen werden nie gelöscht; IDs aus Formularen werden jedes Mal gegen die Datenbank geprüft.
 */

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_POSITIONS = 300;
const INVOICE_GONE = "Diese Rechnung gibt es nicht. Bitte laden Sie die Seite neu.";

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function idFrom(formData: FormData, key = "id"): string | null {
  const v = str(formData, key).trim();
  return ID_PATTERN.test(v) ? v : null;
}

function revalidateBilling() {
  revalidatePath("/admin", "layout");
}

const optionalEmail = z.preprocess(emptyToUndefined, emailSchema.optional());

/* ------------------------------------------------------------------ */
/* Einstellungen                                                       */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_KEYS = Object.keys(INVOICE_PLACEHOLDERS);

function placeholderText(label: string, max: number, required = false) {
  const base = required ? requiredText(label, max) : z.string().trim().max(max, `Höchstens ${max} Zeichen.`);
  return base.superRefine((value, ctx) => {
    const unknown = unknownPlaceholders(value, PLACEHOLDER_KEYS);
    if (unknown.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `Unbekannter Platzhalter ${unknown.join(", ")}. Möglich sind: ${PLACEHOLDER_KEYS.map((k) => `{${k}}`).join(", ")}.`,
      });
    }
  });
}

const settingsInput = z.object({
  taxNumber: z
    .string()
    .trim()
    .max(40, "Höchstens 40 Zeichen.")
    .regex(/^[0-9A-Za-z /.-]*$/, "Bitte nur Ziffern, Buchstaben, Leerzeichen und / . - verwenden."),
  smallBusiness: checkbox,
  taxRate: z
    .string()
    .trim()
    .refine((v) => parseTaxRate(v) !== null, "Bitte einen Steuersatz zwischen 0 und 100 % angeben, z. B. 19."),
  paymentTermDays: z.coerce
    .number("Bitte eine Zahl angeben.")
    .int("Bitte eine ganze Zahl angeben.")
    .min(0, "Mindestens 0 Tage.")
    .max(365, "Höchstens 365 Tage."),
  numberPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(INVOICE_PREFIX_PATTERN, "1 bis 8 Buchstaben oder Ziffern, z. B. RE."),
  bankAccountHolder: z.string().trim().max(120, "Höchstens 120 Zeichen."),
  iban: z
    .string()
    .trim()
    .max(42, "Die IBAN ist zu lang.")
    .refine((v) => v === "" || isValidIban(v), "Die IBAN stimmt nicht. Bitte Tippfehler prüfen."),
  bic: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidBic(v), "Ein BIC hat 8 oder 11 Zeichen, z. B. COBADEFFXXX."),
  bankName: z.string().trim().max(120, "Höchstens 120 Zeichen."),
  introText: placeholderText("einen Einleitungstext", 1000),
  paymentNote: placeholderText("einen Zahlungshinweis", 1000),
  emailSubject: placeholderText("einen Betreff", 200, true),
  emailText: placeholderText("einen E-Mail-Text", 4000, true),
  bccEmail: optionalEmail,
});

export async function saveBillingSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const parsed = settingsInput.safeParse({
    taxNumber: str(formData, "taxNumber"),
    smallBusiness: formData.get("smallBusiness"),
    taxRate: str(formData, "taxRate"),
    paymentTermDays: str(formData, "paymentTermDays"),
    numberPrefix: str(formData, "numberPrefix"),
    bankAccountHolder: str(formData, "bankAccountHolder"),
    iban: str(formData, "iban"),
    bic: str(formData, "bic"),
    bankName: str(formData, "bankName"),
    introText: str(formData, "introText"),
    paymentNote: str(formData, "paymentNote"),
    emailSubject: str(formData, "emailSubject"),
    emailText: str(formData, "emailText"),
    bccEmail: str(formData, "bccEmail"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const d = parsed.data;

  const previous = await getBillingSettings();
  await saveBillingSettings({
    taxNumber: d.taxNumber,
    smallBusiness: d.smallBusiness,
    taxRateBasisPoints: parseTaxRate(d.taxRate) ?? previous.taxRateBasisPoints,
    paymentTermDays: d.paymentTermDays,
    numberPrefix: d.numberPrefix,
    bankAccountHolder: d.bankAccountHolder,
    iban: d.iban ? normalizeIban(d.iban) : "",
    bic: d.bic.replace(/\s+/g, "").toUpperCase(),
    bankName: d.bankName,
    introText: d.introText,
    paymentNote: d.paymentNote,
    emailSubject: d.emailSubject,
    emailText: d.emailText.replace(/\r\n?/g, "\n"),
    bccEmail: d.bccEmail ?? "",
  });

  revalidateBilling();
  const prefixNote =
    previous.numberPrefix !== d.numberPrefix
      ? ` Neue Rechnungen beginnen mit „${d.numberPrefix}-“, die laufende Nummer im Jahr zählt weiter.`
      : "";
  return successState(`Die Rechnungseinstellungen sind gespeichert.${prefixNote}`);
}

/* ------------------------------------------------------------------ */
/* Rechnung erstellen                                                  */
/* ------------------------------------------------------------------ */

const addressSchema = z
  .string()
  .trim()
  .max(400, "Höchstens 400 Zeichen.")
  .transform((v) =>
    v
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 6)
      .join("\n"),
  );

export async function createInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();

  const key = parseCostAccount((k) => str(formData, k));
  const recipient = key ? await resolveRecipient(key) : null;
  if (!recipient) return errorState("Diesen Rechnungsempfänger gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const ids = [...new Set(formData.getAll("ids").filter((v): v is string => typeof v === "string" && ID_PATTERN.test(v)))];
  if (ids.length === 0) return errorState("Bitte wählen Sie mindestens eine Position aus.", formData);
  if (ids.length > MAX_POSITIONS) {
    return errorState(`Bitte höchstens ${MAX_POSITIONS} Positionen in eine Rechnung übernehmen.`, formData);
  }

  const fieldErrors: Record<string, string> = {};

  const emailParsed = optionalEmail.safeParse(str(formData, "recipientEmail"));
  if (!emailParsed.success) fieldErrors.recipientEmail = emailParsed.error.issues[0]?.message ?? "Bitte prüfen.";

  // Firmen: gespeicherte Rechnungsdaten; Privatkunden: Name und Anschrift im Formular änderbar
  let name = recipient.name;
  let address = recipient.addressLines.join("\n");
  if (recipient.kind === "private" || recipient.kind === "ticket") {
    const nameParsed = requiredText("den Namen", 160).safeParse(str(formData, "recipientName"));
    if (nameParsed.success) name = nameParsed.data.replace(/\s+/g, " ");
    else fieldErrors.recipientName = nameParsed.error.issues[0]?.message ?? "Bitte prüfen.";
    const addressParsed = addressSchema.safeParse(str(formData, "recipientAddress"));
    if (addressParsed.success) address = addressParsed.data;
    else fieldErrors.recipientAddress = addressParsed.error.issues[0]?.message ?? "Bitte prüfen.";
  }
  if (!address && !fieldErrors.recipientAddress) {
    if (recipient.kind === "private" || recipient.kind === "ticket") {
      fieldErrors.recipientAddress = "Bitte die Anschrift angeben – sie muss auf der Rechnung stehen.";
    } else {
      return errorState(
        "Für diesen Empfänger ist keine Anschrift hinterlegt. Bitte tragen Sie sie beim Kunden unter „Rechnungsdaten“ ein.",
        formData,
      );
    }
  }

  const start = str(formData, "periodStart").trim();
  const end = str(formData, "periodEnd").trim();
  if (start && !isDateInput(start)) fieldErrors.periodStart = "Bitte ein gültiges Datum angeben.";
  if (end && !isDateInput(end)) fieldErrors.periodEnd = "Bitte ein gültiges Datum angeben.";
  if (start && end && isDateInput(start) && isDateInput(end) && start > end) {
    fieldErrors.periodEnd = "Das Ende liegt vor dem Beginn.";
  }
  if ((start && !end) || (!start && end)) {
    fieldErrors[start ? "periodEnd" : "periodStart"] = "Bitte Beginn und Ende angeben (oder beide leer lassen).";
  }

  const intro = str(formData, "introText").trim();
  if (intro.length > 1000) fieldErrors.introText = "Höchstens 1000 Zeichen.";

  if (Object.keys(fieldErrors).length > 0) return errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors);

  const result = await createInvoice({
    recipient,
    entryIds: ids,
    recipientName: name,
    recipientAddress: address,
    recipientEmail: emailParsed.data ?? null,
    servicePeriodStart: start || null,
    servicePeriodEnd: end || null,
    introText: intro || null,
    createdById: user.id,
    expectedNetCents: /^-?\d{1,12}$/.test(str(formData, "expectedNetCents")) ? Number(str(formData, "expectedNetCents")) : null,
  });
  if (!result.ok) return errorState(result.error, formData);

  revalidateBilling();
  redirect(`/admin/rechnungen/${result.invoiceId}?erstellt=1`);
}

/* ------------------------------------------------------------------ */
/* Versand                                                             */
/* ------------------------------------------------------------------ */

const sendSchema = z.object({
  to: emailSchema,
  subject: requiredText("einen Betreff", 200),
  text: requiredText("einen Text", 8000),
});

export async function sendInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = idFrom(formData);
  if (!id) return errorState(INVOICE_GONE);

  const parsed = sendSchema.safeParse({
    to: str(formData, "to"),
    subject: str(formData, "subject"),
    text: str(formData, "text").replace(/\r\n?/g, "\n"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const result = await sendInvoice({ invoiceId: id, ...parsed.data });
  if (!result.ok) return errorState(result.error, formData);

  revalidateBilling();
  return successState(`Die Rechnung ${result.number} ist an ${result.sentTo} verschickt.`);
}

/**
 * Selbst verschickt (Post, eigenes E-Mail-Programm oder ohne eingerichteten Mailserver):
 * Rechnung als versendet markieren, mit kurzer Angabe, wie.
 */
export async function markInvoiceSentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = idFrom(formData);
  if (!id) return errorState(INVOICE_GONE);
  const note = str(formData, "note").replace(/\s+/g, " ").trim().slice(0, 120) || "selbst verschickt";
  const result = await markInvoiceSent({ invoiceId: id, note });
  if (!result.ok) return errorState(result.error, formData);
  revalidateBilling();
  // Das Formular verschwindet danach (Rechnung ist versendet) – die Bestätigung kommt als Toast
  redirect(`/admin/rechnungen/${id}?versendet=1`);
}

/* ------------------------------------------------------------------ */
/* Zahlung                                                             */
/* ------------------------------------------------------------------ */

/**
 * Zahlung festhalten („paid“, mit Datum des Zahlungseingangs) oder zurücknehmen („unpaid“, z. B. nach einem Versehen
 * oder einer Rücklastschrift). Eine Action für beide, damit das Formular nach dem Umschalten seine Meldung behält.
 */
export async function invoicePaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const intent = str(formData, "intent");
  if (intent === "paid") return markPaid(formData);
  if (intent === "unpaid") return markUnpaid(formData);
  return errorState("Die Aktion ist unklar. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");
}

async function markPaid(formData: FormData): Promise<FormState> {
  const id = idFrom(formData);
  const invoice = id
    ? await db.invoice.findUnique({ where: { id }, select: { id: true, number: true, kind: true, status: true, issueDate: true } })
    : null;
  if (!invoice) return errorState(INVOICE_GONE);
  if (invoice.kind !== "INVOICE") return errorState("Eine Stornorechnung wird nicht bezahlt.");
  if (invoice.status === "PAID") return successState(`Die Rechnung ${invoice.number} ist bereits als bezahlt markiert.`);
  if (invoice.status === "CANCELLED") return errorState("Diese Rechnung ist storniert.");

  const paidAt = str(formData, "paidAt").trim();
  if (!isDateInput(paidAt)) {
    return errorState("Bitte prüfen Sie das Datum.", formData, { paidAt: "Bitte das Datum des Zahlungseingangs angeben." });
  }
  if (paidAt > toDateInput(new Date())) {
    return errorState("Bitte prüfen Sie das Datum.", formData, { paidAt: "Das Datum liegt in der Zukunft." });
  }
  if (paidAt < toDateInput(invoice.issueDate)) {
    return errorState("Bitte prüfen Sie das Datum.", formData, { paidAt: "Das Datum liegt vor dem Rechnungsdatum." });
  }

  const updated = await db.invoice.updateMany({
    where: { id: invoice.id, kind: "INVOICE", status: { in: ["OPEN", "SENT"] } },
    data: { status: "PAID", paidAt: dateFromInput(paidAt) },
  });
  if (updated.count === 0) return errorState("Der Stand der Rechnung hat sich gerade geändert. Bitte laden Sie die Seite neu.");

  revalidateBilling();
  return successState(`Die Rechnung ${invoice.number} ist als bezahlt markiert.`);
}

async function markUnpaid(formData: FormData): Promise<FormState> {
  const id = idFrom(formData);
  const invoice = id
    ? await db.invoice.findUnique({ where: { id }, select: { id: true, number: true, status: true, sentAt: true } })
    : null;
  if (!invoice) return errorState(INVOICE_GONE);
  if (invoice.status !== "PAID") return successState(`Die Rechnung ${invoice.number} ist nicht als bezahlt markiert.`);

  await db.invoice.updateMany({
    where: { id: invoice.id, status: "PAID" },
    data: { status: invoice.sentAt ? "SENT" : "OPEN", paidAt: null },
  });
  revalidateBilling();
  return successState(`Die Zahlung zur Rechnung ${invoice.number} ist zurückgenommen.`);
}

/* ------------------------------------------------------------------ */
/* Storno                                                              */
/* ------------------------------------------------------------------ */

export async function cancelInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const id = idFrom(formData);
  if (!id) return errorState(INVOICE_GONE);
  if (str(formData, "confirm") !== "on") {
    return errorState("Bitte bestätigen Sie das Stornieren.", undefined, {
      confirm: "Bitte bestätigen, dass eine Stornorechnung erstellt wird.",
    });
  }

  const result = await cancelInvoice({ invoiceId: id, createdById: user.id });
  if (!result.ok) return errorState(result.error);

  revalidateBilling();
  redirect(`/admin/rechnungen/${result.invoiceId}?storniert=1`);
}

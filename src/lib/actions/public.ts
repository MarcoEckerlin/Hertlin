"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { site } from "@/config/site";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/crypto";
import { mainUrl } from "@/lib/hosts";
import { emptyToUndefined, errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { checkbox, email, optionalText, phone, requiredText } from "@/lib/validation";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { filesFromFormData, validateFiles } from "@/lib/uploads";
import { formatInquiryNumber, formatTicketNumber, parseTicketNumber } from "@/lib/format";
import {
  canCustomerReply,
  createTicketMessage,
  recordTicketEvent,
  setTicketStatus,
  statusAfterCustomerReply,
} from "@/lib/tickets";
import {
  notifyStaffCustomerReply,
  notifyStaffNewInquiry,
  notifyStaffNewTicket,
  sendInquiryConfirmation,
  sendPrivateStatusLink,
  sendPrivateTicketConfirmation,
} from "@/lib/notifications";
import { CONTACT_PREFERENCES, CUSTOMER_TYPES, INQUIRY_TOPICS, WORKPLACE_LABELS, WORKPLACE_RANGES } from "@/lib/constants";
import { PRIVATE_TICKET_CATEGORIES, inquiryTopicsFor } from "@/components/forms/form-options";

/**
 * Öffentliche Formulare der Hauptdomain (ohne Anmeldung):
 * Anfrage von Neukunden, Hilfe-Formular für Privatkunden, Antworten über den Status-Link
 * und das erneute Zusenden des Status-Links.
 *
 * Schutz: Honeypot-Feld, Rate-Limit pro IP, serverseitige Prüfung aller Eingaben.
 * Status-Link-Aktionen prüfen das Token bei jedem Aufruf erneut gegen die Datenbank.
 */

const HOUR = 60 * 60 * 1000;

/** Gleiche Form wie in src/app/(site)/status/[token]/guest-ticket.ts */
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

const SAVE_FAILED = `Das hat leider nicht geklappt. Bitte versuchen Sie es in ein paar Minuten noch einmal oder rufen Sie uns an: ${site.phone}.`;

/** Textfeld aus FormData; fehlende Felder werden zu "" (ergibt verständliche Pflichtfeld-Meldungen). */
function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Bots füllen das versteckte Feld „website“ aus, Menschen sehen es nicht. */
function isBot(formData: FormData): boolean {
  return text(formData, "website").trim() !== "";
}

/** Gibt eine Fehlermeldung zurück, wenn von dieser IP zu viele Einsendungen kamen. */
async function rateLimitMessage(scope: string, limit: number, windowMs: number): Promise<string | null> {
  const ip = await clientIp();
  const result = rateLimit(`public:${scope}:${ip}`, limit, windowMs);
  if (result.ok) return null;
  const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60_000));
  const wait = minutes === 1 ? "einer Minute" : `${minutes} Minuten`;
  return `Von Ihrem Anschluss kamen gerade sehr viele Nachrichten. Bitte versuchen Sie es in ${wait} noch einmal oder rufen Sie uns an: ${site.phone}.`;
}

/** Fehler aus Zod und eigenen Prüfungen zu einem Formularzustand zusammenführen. */
function invalidState(
  formData: FormData,
  error: z.ZodError | null,
  extra: Record<string, string>,
  message = "Bitte prüfen Sie die markierten Felder.",
): FormState {
  const fromZod = error ? (fromZodError(error, formData).fieldErrors ?? {}) : {};
  return errorState(message, formData, { ...extra, ...fromZod });
}

/** Hinweis, dass Dateien nach einem Fehler erneut ausgewählt werden müssen (Browser vergessen sie). */
function filesNote(files: File[]): string {
  return files.length > 0 ? " Ihre Dateien müssen Sie danach bitte noch einmal auswählen." : "";
}

const consent = checkbox.refine((v) => v, "Bitte bestätigen Sie die Einwilligung. Ohne sie dürfen wir Ihre Angaben nicht speichern.");

/* ======================================================================
 * Anfrage von Neukunden (/kontakt)
 * ==================================================================== */

const inquirySchema = z.object({
  customerType: z.enum(CUSTOMER_TYPES, { error: "Bitte wählen Sie, ob Sie für ein Unternehmen oder privat anfragen." }),
  name: requiredText("Ihren Namen", 120),
  email,
  phone,
  zipCity: optionalText(120),
  topic: z.enum(INQUIRY_TOPICS, { error: "Bitte wählen Sie ein Thema aus." }),
  message: z
    .string()
    .trim()
    .min(20, "Ein, zwei Sätze mehr helfen uns weiter – bitte mindestens 20 Zeichen.")
    .max(5000, "Bitte fassen Sie sich etwas kürzer (höchstens 5.000 Zeichen)."),
  preferredContact: z.enum(CONTACT_PREFERENCES, { error: "Bitte wählen Sie, wie wir uns melden sollen." }),
  privacy: consent,
});

/** Zusätzliche Felder, wenn ein Unternehmen anfragt. */
const businessSchema = z.object({
  companyName: requiredText("den Namen Ihrer Firma", 160),
  workplaces: z.preprocess(
    emptyToUndefined,
    z.enum(WORKPLACE_RANGES, { error: "Bitte wählen Sie einen Wert aus der Liste." }).optional(),
  ),
});

export async function submitInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // Bots bekommen dieselbe Erfolgsmeldung, gespeichert wird nichts.
  if (isBot(formData)) return successState("Vielen Dank, Ihre Anfrage ist angekommen.");

  const raw = {
    customerType: text(formData, "customerType"),
    name: text(formData, "name"),
    companyName: text(formData, "companyName"),
    workplaces: text(formData, "workplaces"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    zipCity: text(formData, "zipCity"),
    topic: text(formData, "topic"),
    message: text(formData, "message"),
    preferredContact: text(formData, "preferredContact"),
    privacy: formData.get("privacy"),
  };
  const parsed = inquirySchema.safeParse(raw);
  const parsedBusiness = raw.customerType === "BUSINESS" ? businessSchema.safeParse(raw) : null;

  // Prüfungen, die von mehreren Feldern abhängen
  const extra: Record<string, string> = {};
  if (raw.preferredContact === "PHONE" && raw.phone.trim() === "") {
    extra.phone = "Für einen Rückruf brauchen wir Ihre Telefonnummer.";
  }
  if (
    (raw.customerType === "BUSINESS" || raw.customerType === "PRIVATE") &&
    raw.topic &&
    !(inquiryTopicsFor(raw.customerType) as readonly string[]).includes(raw.topic)
  ) {
    extra.topic = "Bitte wählen Sie ein Thema aus der Liste.";
  }
  if (parsedBusiness && !parsedBusiness.success) {
    Object.assign(extra, fromZodError(parsedBusiness.error).fieldErrors);
  }
  if (!parsed.success || Object.keys(extra).length > 0) {
    return invalidState(formData, parsed.success ? null : parsed.error, extra);
  }

  const limited = await rateLimitMessage("inquiry", 5, HOUR);
  if (limited) return errorState(limited, formData);

  const data = parsed.data;
  const business = parsedBusiness?.success ? parsedBusiness.data : null;

  let inquiry: { id: number };
  try {
    inquiry = await db.inquiry.create({
      data: {
        customerType: data.customerType,
        name: data.name,
        companyName: business?.companyName ?? null,
        workplaces: business?.workplaces ?? null,
        email: data.email,
        phone: data.phone ?? null,
        zipCity: data.zipCity ?? null,
        topic: data.topic,
        message: data.message,
        preferredContact: data.preferredContact,
      },
      select: { id: true },
    });
  } catch (error) {
    console.error("[kontakt] Anfrage konnte nicht gespeichert werden:", error);
    return errorState(SAVE_FAILED, formData);
  }

  // E-Mails erst nach der Antwort verschicken, damit niemand auf den Mailserver warten muss.
  after(async () => {
    // Für das Team die übrigen Angaben vor die Nachricht setzen (lange Nachrichten werden in der Mail gekürzt).
    const details = [
      business?.workplaces ? `Arbeitsplätze: ${WORKPLACE_LABELS[business.workplaces]}` : null,
      data.zipCity ? `PLZ und Ort: ${data.zipCity}` : null,
      `Rückmeldung gewünscht: ${data.preferredContact === "PHONE" ? "telefonisch" : "per E-Mail"}`,
    ].filter((line) => line !== null);
    await notifyStaffNewInquiry({
      id: inquiry.id,
      customerType: data.customerType,
      name: data.name,
      companyName: business?.companyName ?? null,
      email: data.email,
      phone: data.phone ?? null,
      topic: data.topic,
      message: `${details.join("\n")}\n\n${data.message}`,
    });
    await sendInquiryConfirmation({ id: inquiry.id, name: data.name, email: data.email, customerType: data.customerType });
  });

  return successState("Vielen Dank, Ihre Anfrage ist angekommen.", {
    number: formatInquiryNumber(inquiry.id),
    email: data.email,
    customerType: data.customerType,
    preferredContact: data.preferredContact,
  });
}

/* ======================================================================
 * Hilfe-Formular für Privatkunden (/privatkunden#hilfe-anfordern)
 * ==================================================================== */

const requiredPhone = z
  .string()
  .trim()
  .min(1, "Bitte geben Sie eine Telefonnummer an, unter der wir Sie zurückrufen können.")
  .max(40, "Die Telefonnummer ist zu lang.")
  .regex(/^[0-9+()/\-\s.]+$/, "Bitte nur Ziffern, Leerzeichen und + ( ) / - verwenden.")
  .refine((v) => v.replace(/\D/g, "").length >= 5, "Die Telefonnummer scheint unvollständig zu sein.");

const privateTicketSchema = z.object({
  name: requiredText("Ihren Namen", 120),
  email,
  phone: requiredPhone,
  address: optionalText(300),
  category: z.enum(PRIVATE_TICKET_CATEGORIES, { error: "Bitte wählen Sie aus, worum es ungefähr geht." }),
  subject: requiredText("einen kurzen Betreff", 150),
  description: z
    .string()
    .trim()
    .min(10, "Bitte beschreiben Sie das Problem in ein paar Worten (mindestens 10 Zeichen).")
    .max(5000, "Bitte fassen Sie sich etwas kürzer (höchstens 5.000 Zeichen)."),
  availability: optionalText(200),
  privacy: consent,
});

export async function submitPrivateTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (isBot(formData)) return successState("Vielen Dank, Ihre Anfrage ist angekommen.");

  const files = filesFromFormData(formData);
  const parsed = privateTicketSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
    category: text(formData, "category"),
    subject: text(formData, "subject"),
    description: text(formData, "description"),
    availability: text(formData, "availability"),
    privacy: formData.get("privacy"),
  });
  const fileError = validateFiles(files);
  if (!parsed.success || fileError) {
    return invalidState(
      formData,
      parsed.success ? null : parsed.error,
      fileError ? { attachments: fileError } : {},
      `Bitte prüfen Sie die markierten Felder.${filesNote(files)}`,
    );
  }

  const limited = await rateLimitMessage("private-ticket", 5, HOUR);
  if (limited) return errorState(`${limited}${filesNote(files)}`, formData);

  const data = parsed.data;
  // Neues Gerät kaufen/einrichten ist keine Störung, sondern eine Anfrage.
  const type = data.category === "HARDWARE" ? "ANFRAGE" : "STOERUNG";
  // Virenverdacht, Betrug oder gehackte Konten dulden keinen Aufschub.
  const priority = data.category === "SICHERHEIT" ? "HIGH" : "NORMAL";
  const body = data.availability ? `${data.description}\n\nGut erreichbar: ${data.availability}` : data.description;
  const token = generateToken(24);

  let ticketId: number;
  try {
    const ticket = await db.ticket.create({
      data: {
        subject: data.subject,
        type,
        category: data.category,
        priority,
        status: "NEW",
        source: "PRIVATE_FORM",
        companyId: null,
        contactName: data.name,
        contactEmail: data.email,
        contactPhone: data.phone,
        contactAddress: data.address ?? null,
        guestToken: token,
      },
      select: { id: true },
    });
    ticketId = ticket.id;
  } catch (error) {
    console.error("[privatkunden] Ticket konnte nicht angelegt werden:", error);
    return errorState(`${SAVE_FAILED}${filesNote(files)}`, formData);
  }

  try {
    await createTicketMessage({ ticketId, body, authorName: data.name, fromStaff: false, files });
    await recordTicketEvent(ticketId, "CREATED", null);
  } catch (error) {
    console.error("[privatkunden] Nachricht zum Ticket konnte nicht gespeichert werden:", error);
    // Kein halbes Ticket ohne Beschreibung zurücklassen
    await db.ticket.delete({ where: { id: ticketId } }).catch(() => undefined);
    return errorState(`${SAVE_FAILED}${filesNote(files)}`, formData);
  }

  after(async () => {
    // Für das Team zusätzlich Rückrufnummer und Anschrift, damit niemand erst das Ticket öffnen muss.
    const staffBody = [
      `Rückruf: ${data.phone}`,
      data.address ? `Anschrift: ${data.address}` : null,
      files.length > 0 ? `Anhänge: ${files.length}` : null,
      "",
      body,
    ]
      .filter((line) => line !== null)
      .join("\n");
    await notifyStaffNewTicket({
      id: ticketId,
      subject: data.subject,
      type,
      category: data.category,
      priority,
      companyName: null,
      contactName: data.name,
      body: staffBody,
    });
    await sendPrivateTicketConfirmation({ to: data.email, name: data.name, ticketId, subject: data.subject, token });
  });

  return successState("Vielen Dank, Ihre Anfrage ist angekommen.", {
    number: formatTicketNumber(ticketId),
    email: data.email,
    statusPath: `/status/${token}`,
    statusUrl: mainUrl(`/status/${token}`),
  });
}

/* ======================================================================
 * Antwort über den Status-Link (/status/[token])
 * ==================================================================== */

const guestReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Bitte schreiben Sie uns ein paar Worte.")
    .max(5000, "Bitte fassen Sie sich etwas kürzer (höchstens 5.000 Zeichen)."),
});

export async function replyAsGuestAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  if (!GUEST_TOKEN_PATTERN.test(token)) {
    return errorState("Dieser Status-Link ist ungültig. Bitte öffnen Sie ihn direkt aus unserer E-Mail.");
  }

  let ticket;
  try {
    ticket = await db.ticket.findFirst({
      where: { guestToken: token, source: "PRIVATE_FORM", companyId: null },
      select: { id: true, subject: true, type: true, category: true, priority: true, status: true, contactName: true },
    });
  } catch (error) {
    console.error("[status] Ticket zum Status-Link konnte nicht geladen werden:", error);
    return errorState(SAVE_FAILED, formData);
  }
  if (!ticket) {
    return errorState("Dieser Status-Link ist ungültig. Bitte öffnen Sie ihn direkt aus unserer E-Mail.");
  }
  if (!canCustomerReply(ticket.status)) {
    return errorState(
      "Diese Anfrage ist bereits abgeschlossen. Bei einem neuen Problem nutzen Sie bitte das Formular für Privatkunden.",
    );
  }

  const files = filesFromFormData(formData);
  const parsed = guestReplySchema.safeParse({ body: text(formData, "body") });
  const fileError = validateFiles(files);
  if (!parsed.success || fileError) {
    return invalidState(
      formData,
      parsed.success ? null : parsed.error,
      fileError ? { attachments: fileError } : {},
      `Bitte prüfen Sie Ihre Nachricht.${filesNote(files)}`,
    );
  }

  const limited = await rateLimitMessage("guest-reply", 10, HOUR / 2);
  if (limited) return errorState(`${limited}${filesNote(files)}`, formData);

  const authorName = ticket.contactName?.trim() || "Privatkunde";
  const body = parsed.data.body;
  const nextStatus = statusAfterCustomerReply(ticket.status);

  try {
    await createTicketMessage({ ticketId: ticket.id, body, authorName, fromStaff: false, files });
    if (nextStatus !== ticket.status) await setTicketStatus(ticket.id, nextStatus, null);
  } catch (error) {
    console.error("[status] Antwort konnte nicht gespeichert werden:", error);
    return errorState(`${SAVE_FAILED}${filesNote(files)}`, formData);
  }

  after(() =>
    notifyStaffCustomerReply({
      id: ticket.id,
      subject: ticket.subject,
      type: ticket.type,
      category: ticket.category,
      priority: ticket.priority,
      companyName: null,
      contactName: ticket.contactName,
      authorName,
      body: files.length > 0 ? `${body}\n\n(${files.length} ${files.length === 1 ? "Anhang" : "Anhänge"})` : body,
    }),
  );

  revalidatePath(`/status/${token}`);

  if (ticket.status === "RESOLVED") {
    return successState("Danke für Ihre Nachricht. Wir haben die Anfrage wieder geöffnet und kümmern uns darum.");
  }
  if (ticket.status === "WAITING_CUSTOMER") {
    return successState("Danke für Ihre Antwort. Damit können wir weitermachen.");
  }
  return successState("Danke, Ihre Nachricht ist bei uns angekommen.");
}

/* ======================================================================
 * Status-Link erneut zusenden (/status)
 * ==================================================================== */

const statusLinkSchema = z.object({
  email,
  ticketNumber: z
    .string()
    .trim()
    .min(1, "Bitte geben Sie die Ticketnummer an.")
    .max(20, "Die Ticketnummer ist zu lang.")
    .refine((v) => parseTicketNumber(v) !== null, "Bitte die Nummer so eingeben, wie sie in unserer E-Mail steht, z. B. T-00042."),
});

export async function resendStatusLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = statusLinkSchema.safeParse({
    email: text(formData, "email"),
    ticketNumber: text(formData, "ticketNumber"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const limited = await rateLimitMessage("status-link", 5, HOUR);
  if (limited) return errorState(limited, formData);

  const ticketId = parseTicketNumber(parsed.data.ticketNumber);
  if (ticketId !== null) {
    try {
      const ticket = await db.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          subject: true,
          source: true,
          companyId: true,
          contactEmail: true,
          contactName: true,
          guestToken: true,
        },
      });
      if (
        ticket &&
        ticket.source === "PRIVATE_FORM" &&
        ticket.companyId === null &&
        ticket.guestToken &&
        ticket.contactEmail &&
        ticket.contactEmail.trim().toLowerCase() === parsed.data.email
      ) {
        const { contactEmail, guestToken } = ticket;
        // Nach der Antwort senden: Die Antwortzeit verrät so nicht, ob es das Ticket gibt.
        after(() =>
          sendPrivateStatusLink({
            to: contactEmail,
            name: ticket.contactName ?? "",
            ticketId: ticket.id,
            subject: ticket.subject,
            token: guestToken,
          }),
        );
      }
    } catch (error) {
      console.error("[status] Status-Link konnte nicht gesucht werden:", error);
      return errorState(SAVE_FAILED, formData);
    }
  }

  // Immer dieselbe Antwort, damit niemand ausprobieren kann, welche Tickets es gibt.
  return successState(
    "Wenn E-Mail-Adresse und Ticketnummer zusammenpassen, ist der Link in wenigen Minuten in Ihrem Postfach. Schauen Sie bitte auch im Spam-Ordner nach.",
  );
}

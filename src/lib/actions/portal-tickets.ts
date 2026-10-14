"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePortalContext, type PortalContext } from "@/lib/auth";
import { portalTicketWhere } from "@/lib/permissions";
import {
  OPEN_STATUSES,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  type TicketStatus,
} from "@/lib/constants";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { phone, requiredText } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { filesFromFormData, validateFiles } from "@/lib/uploads";
import { getSiteSettings } from "@/lib/settings";
import {
  canCustomerReply,
  createTicketMessage,
  recordTicketEvent,
  setTicketStatus,
  statusAfterCustomerReply,
} from "@/lib/tickets";
import {
  notifyStaffCustomerReply,
  notifyStaffCustomerStatusChange,
  notifyStaffNewTicket,
  sendPortalTicketConfirmation,
} from "@/lib/notifications";
import {
  assignableCompanies,
  parseTicketId,
  revalidatePortal,
  staffCompanyLabel,
} from "@/components/portal/portal-data";
import { defaultTicketLocationId } from "@/components/admin/tickets/data";

/**
 * Tickets im Kundenportal: anlegen, antworten, als gelöst markieren, wieder öffnen.
 * Jede Action holt zuerst den PortalContext (Mandant aus dem Host) und prüft das Ticket
 * erneut über portalTicketWhere – IDs aus dem Formular werden nie ungeprüft übernommen.
 */

const HOUR = 60 * 60 * 1000;
const MAX_BODY = 10_000;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function saveFailedMessage(): Promise<string> {
  const site = await getSiteSettings();
  return `Das hat leider nicht geklappt. Bitte versuchen Sie es in ein paar Minuten noch einmal. Wenn es dringend ist, rufen Sie uns an: ${site.phone}.`;
}

/** Browser vergessen ausgewählte Dateien nach dem Absenden. */
function filesNote(files: File[]): string {
  return files.length > 0 ? " Die Dateien müssen Sie bitte noch einmal auswählen." : "";
}

function attachmentNote(files: File[]): string | null {
  if (files.length === 0) return null;
  return files.length === 1 ? "(1 Anhang)" : `(${files.length} Anhänge)`;
}

/** Fehler aus Zod und eigenen Prüfungen zu einem Formularzustand zusammenführen. */
function invalidState(formData: FormData, error: z.ZodError | null, extra: Record<string, string>, message: string): FormState {
  const fromZod = error ? (fromZodError(error, formData).fieldErrors ?? {}) : {};
  return errorState(message, formData, { ...extra, ...fromZod });
}

/** Ticket im Sichtbereich des Benutzers – sonst null. */
async function findTicketInScope(ctx: PortalContext, ticketId: number | null) {
  if (!ticketId) return null;
  return db.ticket.findFirst({
    where: { AND: [{ id: ticketId }, portalTicketWhere(ctx)] },
    select: {
      id: true,
      subject: true,
      type: true,
      category: true,
      priority: true,
      status: true,
      company: { select: { name: true, parentId: true } },
    },
  });
}

/* ======================================================================
 * Neues Ticket (/tickets/neu)
 * ==================================================================== */

const newTicketSchema = z.object({
  type: z.enum(TICKET_TYPES, { error: "Bitte wählen Sie, ob es um eine Störung oder eine Anfrage geht." }),
  category: z.enum(TICKET_CATEGORIES, { error: "Bitte wählen Sie den passenden Bereich aus." }),
  priority: z.enum(TICKET_PRIORITIES, { error: "Bitte wählen Sie aus, wie dringend es ist." }),
  subject: requiredText("einen kurzen Betreff", 150),
  description: z
    .string()
    .trim()
    .min(10, "Bitte beschreiben Sie Ihr Anliegen in ein paar Worten (mindestens 10 Zeichen).")
    .max(MAX_BODY, "Bitte höchstens 10.000 Zeichen. Längere Protokolle hängen Sie am besten als Datei an."),
  contactPhone: phone,
});

export async function createPortalTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalContext();

  const files = filesFromFormData(formData);
  const parsed = newTicketSchema.safeParse({
    type: text(formData, "type"),
    category: text(formData, "category"),
    priority: text(formData, "priority"),
    subject: text(formData, "subject"),
    description: text(formData, "description"),
    contactPhone: text(formData, "contactPhone"),
  });

  const extra: Record<string, string> = {};
  const fileError = validateFiles(files);
  if (fileError) extra.attachments = fileError;

  // Firma: Standard ist die eigene; andere nur, wenn der Benutzer sie zuordnen darf.
  const companies = await assignableCompanies(ctx);
  const requestedCompanyId = text(formData, "companyId").trim() || ctx.company.id;
  const company = companies.find((c) => c.id === requestedCompanyId);
  if (!company) extra.companyId = "Bitte wählen Sie eine Firma aus der Liste.";

  if (!parsed.success || !company || Object.keys(extra).length > 0) {
    return invalidState(
      formData,
      parsed.success ? null : parsed.error,
      extra,
      `Bitte prüfen Sie die markierten Felder.${filesNote(files)}`,
    );
  }

  if (!rateLimit(`portal:ticket:${ctx.user.id}`, 20, HOUR).ok) {
    const site = await getSiteSettings();
    return errorState(
      `In der letzten Stunde kamen von Ihrem Zugang sehr viele Tickets. Bitte warten Sie etwas oder rufen Sie uns an: ${site.phone}.${filesNote(files)}`,
      formData,
    );
  }

  const data = parsed.data;
  const user = ctx.user;
  // Zuständiger Hertlin-Standort: der der Firma, bei Unterkunden ohne eigenen der des Firmenkunden
  const locationId = await defaultTicketLocationId(company.id);

  let ticketId: number;
  try {
    const ticket = await db.ticket.create({
      data: {
        subject: data.subject,
        type: data.type,
        category: data.category,
        priority: data.priority,
        status: "NEW",
        source: "PORTAL",
        companyId: company.id,
        locationId,
        createdById: user.id,
        contactName: user.name,
        contactEmail: user.email,
        contactPhone: data.contactPhone ?? null,
      },
      select: { id: true },
    });
    ticketId = ticket.id;
  } catch (error) {
    console.error("[portal] Ticket konnte nicht angelegt werden:", error);
    return errorState(`${await saveFailedMessage()}${filesNote(files)}`, formData);
  }

  try {
    await createTicketMessage({
      ticketId,
      body: data.description,
      authorId: user.id,
      authorName: user.name,
      fromStaff: false,
      files,
      initial: true,
    });
    await recordTicketEvent(ticketId, "CREATED", user.id);
  } catch (error) {
    console.error("[portal] Beschreibung zum Ticket konnte nicht gespeichert werden:", error);
    // Kein Ticket ohne Beschreibung zurücklassen
    await db.ticket.delete({ where: { id: ticketId } }).catch(() => undefined);
    return errorState(`${await saveFailedMessage()}${filesNote(files)}`, formData);
  }

  const companyName = company.isRoot ? company.name : `${ctx.root.name} › ${company.name}`;
  const slug = ctx.root.slug;

  // E-Mails nach der Antwort verschicken, damit niemand auf den Mailserver wartet.
  after(async () => {
    const staffBody = [
      data.contactPhone ? `Rückruf: ${data.contactPhone}` : null,
      files.length > 0 ? `Anhänge: ${files.length}` : null,
      data.contactPhone || files.length > 0 ? "" : null,
      data.description,
    ]
      .filter((line) => line !== null)
      .join("\n");
    await notifyStaffNewTicket({
      id: ticketId,
      subject: data.subject,
      type: data.type,
      category: data.category,
      priority: data.priority,
      companyName,
      contactName: user.name,
      createdByName: user.name,
      body: staffBody,
    });
    await sendPortalTicketConfirmation({ to: user.email, name: user.name, ticketId, subject: data.subject, slug });
  });

  revalidatePortal(ctx);
  redirect(`/tickets/${ticketId}?neu=1`);
}

/* ======================================================================
 * Antwort im Ticket (/tickets/[id])
 * ==================================================================== */

const replySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Bitte schreiben Sie eine Nachricht.")
    .max(MAX_BODY, "Bitte höchstens 10.000 Zeichen. Längere Protokolle hängen Sie am besten als Datei an."),
});

export async function replyPortalTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await requirePortalContext();

  const ticket = await findTicketInScope(ctx, parseTicketId(text(formData, "ticketId")));
  if (!ticket) {
    return errorState("Dieses Ticket wurde nicht gefunden. Bitte öffnen Sie es noch einmal über die Ticketliste.");
  }
  if (!canCustomerReply(ticket.status)) {
    return errorState(
      "Dieses Ticket ist bereits geschlossen. Wenn es ein neues Problem gibt, legen Sie bitte ein neues Ticket an.",
    );
  }

  const files = filesFromFormData(formData);
  const parsed = replySchema.safeParse({ body: text(formData, "body") });
  const fileError = validateFiles(files);
  if (!parsed.success || fileError) {
    return invalidState(
      formData,
      parsed.success ? null : parsed.error,
      fileError ? { attachments: fileError } : {},
      `Bitte prüfen Sie Ihre Nachricht.${filesNote(files)}`,
    );
  }

  if (!rateLimit(`portal:reply:${ctx.user.id}`, 30, HOUR / 6).ok) {
    return errorState(
      `Sie haben gerade sehr viele Nachrichten geschickt. Bitte warten Sie ein paar Minuten.${filesNote(files)}`,
      formData,
    );
  }

  const body = parsed.data.body;
  const nextStatus = statusAfterCustomerReply(ticket.status);
  try {
    await createTicketMessage({
      ticketId: ticket.id,
      body,
      authorId: ctx.user.id,
      authorName: ctx.user.name,
      fromStaff: false,
      files,
    });
    if (nextStatus !== ticket.status) await setTicketStatus(ticket.id, nextStatus, ctx.user.id);
  } catch (error) {
    console.error("[portal] Antwort konnte nicht gespeichert werden:", error);
    return errorState(`${await saveFailedMessage()}${filesNote(files)}`, formData);
  }

  const companyName = ticket.company ? staffCompanyLabel(ctx, ticket.company) : null;
  const authorName = ctx.user.name;
  const note = attachmentNote(files);
  after(() =>
    notifyStaffCustomerReply({
      id: ticket.id,
      subject: ticket.subject,
      type: ticket.type,
      category: ticket.category,
      priority: ticket.priority,
      companyName,
      authorName,
      body: note ? `${body}\n\n${note}` : body,
    }),
  );

  revalidatePortal(ctx);

  if (ticket.status === "RESOLVED") {
    return successState("Danke für Ihre Nachricht. Das Ticket ist wieder offen und wir kümmern uns darum.");
  }
  if (ticket.status === "WAITING_CUSTOMER") {
    return successState("Danke für Ihre Antwort. Damit können wir weitermachen.");
  }
  return successState("Ihre Nachricht ist angekommen.");
}

/* ======================================================================
 * Status durch den Kunden: „Problem ist gelöst“ und „Wieder öffnen“
 * Aufruf über <form action={markResolvedAction.bind(null, id)}>.
 * ==================================================================== */

async function changeStatusByCustomer(
  rawTicketId: unknown,
  allowedFrom: readonly string[],
  target: TicketStatus,
  statusLabel: string,
  hint: string,
): Promise<never> {
  const ctx = await requirePortalContext();
  const ticket = await findTicketInScope(ctx, parseTicketId(rawTicketId));
  if (!ticket) redirect("/tickets");

  // Hat sich der Status inzwischen geändert (z. B. durch Hertlin), passiert nichts.
  if (!allowedFrom.includes(ticket.status)) redirect(`/tickets/${ticket.id}`);

  let changed = false;
  try {
    changed = await setTicketStatus(ticket.id, target, ctx.user.id);
  } catch (error) {
    console.error("[portal] Status konnte nicht geändert werden:", error);
    redirect(`/tickets/${ticket.id}?hinweis=fehler`);
  }

  if (changed) {
    const companyName = ticket.company ? staffCompanyLabel(ctx, ticket.company) : null;
    const authorName = ctx.user.name;
    after(() =>
      notifyStaffCustomerStatusChange({
        id: ticket.id,
        subject: ticket.subject,
        type: ticket.type,
        category: ticket.category,
        priority: ticket.priority,
        companyName,
        actorName: authorName,
        statusLabel,
      }),
    );
  }

  revalidatePortal(ctx);
  redirect(`/tickets/${ticket.id}?hinweis=${hint}`);
}

export async function markResolvedAction(ticketId: number): Promise<void> {
  await changeStatusByCustomer(
    ticketId,
    OPEN_STATUSES,
    "RESOLVED",
    "Gelöst",
    "geloest",
  );
}

export async function reopenTicketAction(ticketId: number): Promise<void> {
  await changeStatusByCustomer(
    ticketId,
    ["RESOLVED"],
    "IN_PROGRESS",
    "Wieder geöffnet",
    "wieder-offen",
  );
}

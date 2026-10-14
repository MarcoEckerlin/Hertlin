"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff, type SessionUser } from "@/lib/auth";
import { generateToken } from "@/lib/crypto";
import {
  CUSTOMER_ROLES,
  STAFF_ROLES,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  type TicketStatus,
} from "@/lib/constants";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { checkbox, email, optionalText, phone, requiredText } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { filesFromFormData, validateFiles } from "@/lib/uploads";
import {
  createTicketMessage,
  customerRecipient,
  recordTicketEvent,
  setTicketStatus,
  statusAfterStaffReply,
} from "@/lib/tickets";
import {
  notifyCustomerStaffReply,
  notifyCustomerStatusChange,
  sendPrivateStatusLink,
  sendPrivateTicketConfirmation,
  sendStaffCreatedTicketMail,
} from "@/lib/notifications";
import { isRecipientWatchingTicket } from "@/realtime/bus";
import { parseLocationId } from "@/lib/locations";
import { PRIVATE_CUSTOMER } from "@/components/admin/tickets/filters";
import { defaultTicketLocationId, parseTicketIdParam } from "@/components/admin/tickets/data";

/**
 * Tickets in der Verwaltung: anlegen, bearbeiten, antworten, Status-Link senden, übernehmen.
 * Jede Action prüft zuerst die Anmeldung (requireStaff) und lädt danach das Ticket neu aus der
 * Datenbank – IDs aus Formularen werden nie ungeprüft übernommen. Kosten werden hier nicht berührt.
 */

const MAX_BODY = 10_000;
const HOUR = 60 * 60 * 1000;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Browser vergessen ausgewählte Dateien nach dem Absenden. */
function filesNote(files: File[]): string {
  return files.length > 0 ? " Die Dateien bitte noch einmal auswählen." : "";
}

function attachmentNote(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? "(1 Anhang – im Ticket abrufbar)" : `(${count} Anhänge – im Ticket abrufbar)`;
}

function invalidState(formData: FormData, error: z.ZodError | null, extra: Record<string, string>, message: string): FormState {
  const fromZod = error ? (fromZodError(error, formData).fieldErrors ?? {}) : {};
  return errorState(message, formData, { ...extra, ...fromZod });
}

/** Alle Verwaltungsseiten neu laden (Listen, Übersicht, Zähler in der Navigation). */
function revalidateAdmin(): void {
  revalidatePath("/admin", "layout");
}

const optionalEmail = z
  .string()
  .trim()
  .max(200, "Die E-Mail-Adresse ist zu lang.")
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(email.optional());

const bodySchema = z
  .string()
  .trim()
  .min(1, "Bitte schreiben Sie eine Nachricht.")
  .max(MAX_BODY, "Bitte höchstens 10.000 Zeichen. Längere Protokolle als Datei anhängen.");

type CompanyRef = {
  id: string;
  name: string;
  active: boolean;
  parentId: string | null;
  parent: { id: string; name: string; active: boolean } | null;
};

const companyRefSelect = {
  id: true,
  name: true,
  active: true,
  parentId: true,
  parent: { select: { id: true, name: true, active: true } },
} as const;

function companyLabel(company: { name: string; parent: { name: string } | null } | null): string {
  if (!company) return "Privatkunde";
  return company.parent ? `${company.parent.name} › ${company.name}` : company.name;
}

async function findActiveStaff(id: string) {
  return db.user.findFirst({
    where: { id, role: { in: [...STAFF_ROLES] }, active: true },
    select: { id: true, name: true },
  });
}

/* ======================================================================
 * Ticket anlegen (/admin/tickets/neu)
 * ==================================================================== */

const newTicketSchema = z.object({
  customer: z
    .string()
    .trim()
    .min(1, "Bitte wählen Sie einen Kunden aus – oder „Privatkunde“.")
    .max(40, "Bitte wählen Sie einen Kunden aus der Liste."),
  contactUserId: optionalText(40),
  contactName: optionalText(120),
  contactEmail: optionalEmail,
  contactPhone: phone,
  contactAddress: optionalText(300),
  subject: requiredText("einen Betreff", 150),
  type: z.enum(TICKET_TYPES, { error: "Bitte die Art auswählen." }),
  category: z.enum(TICKET_CATEGORIES, { error: "Bitte einen Bereich auswählen." }),
  priority: z.enum(TICKET_PRIORITIES, { error: "Bitte eine Priorität auswählen." }),
  assigneeId: optionalText(40),
  body: z
    .string()
    .trim()
    .min(1, "Bitte beschreiben Sie das Anliegen.")
    .max(MAX_BODY, "Bitte höchstens 10.000 Zeichen. Längere Protokolle als Datei anhängen."),
  notify: checkbox,
});

export async function createStaffTicketAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();

  const files = filesFromFormData(formData);
  const parsed = newTicketSchema.safeParse({
    customer: text(formData, "customer"),
    contactUserId: text(formData, "contactUserId"),
    contactName: text(formData, "contactName"),
    contactEmail: text(formData, "contactEmail"),
    contactPhone: text(formData, "contactPhone"),
    contactAddress: text(formData, "contactAddress"),
    subject: text(formData, "subject"),
    type: text(formData, "type"),
    category: text(formData, "category"),
    priority: text(formData, "priority"),
    assigneeId: text(formData, "assigneeId"),
    body: text(formData, "body"),
    notify: formData.get("notify"),
  });

  const extra: Record<string, string> = {};
  const fileError = validateFiles(files);
  if (fileError) extra.attachments = fileError;

  // Pflichtangaben bei Privatkunden gleich mitprüfen, damit alle Hinweise auf einmal erscheinen
  const isPrivate = text(formData, "customer").trim() === PRIVATE_CUSTOMER;
  if (isPrivate) {
    if (!text(formData, "contactName").trim()) extra.contactName = "Bei Privatkunden brauchen wir einen Namen.";
    if (!text(formData, "contactEmail").trim()) extra.contactEmail = "Für den Status-Link brauchen wir eine E-Mail-Adresse.";
  }

  if (!parsed.success) {
    return invalidState(formData, parsed.error, extra, `Bitte prüfen Sie die markierten Felder.${filesNote(files)}`);
  }
  const input = parsed.data;

  // Kunde, Ansprechpartner und Bearbeiter nie ungeprüft aus dem Formular übernehmen
  let company: CompanyRef | null = null;
  if (!isPrivate) {
    company = await db.company.findUnique({ where: { id: input.customer }, select: companyRefSelect });
    if (!company) extra.customer = "Diesen Kunden gibt es nicht mehr. Bitte laden Sie die Seite neu.";
    else if (!company.active || company.parent?.active === false) {
      extra.customer = "Dieser Kunde ist deaktiviert. Aktivieren Sie ihn zuerst oder wählen Sie einen anderen.";
    }
  }

  let contactUser: { id: string; name: string; email: string; phone: string | null } | null = null;
  if (company && !extra.customer && input.contactUserId) {
    contactUser = await db.user.findFirst({
      where: {
        id: input.contactUserId,
        active: true,
        role: { in: [...CUSTOMER_ROLES] },
        // Benutzer der gewählten Firma – bei Unterkunden auch die Hauptansprechpartner des Firmenkunden,
        // denn die sehen im Portal alle Unterkunden.
        OR: [
          { companyId: company.id },
          ...(company.parentId ? [{ companyId: company.parentId, role: "CUSTOMER_ADMIN" }] : []),
        ],
      },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!contactUser) extra.contactUserId = "Diese Person gehört nicht (mehr) zum gewählten Kunden.";
  }

  let assignee: { id: string; name: string } | null = null;
  if (input.assigneeId) {
    assignee = await findActiveStaff(input.assigneeId);
    if (!assignee) extra.assigneeId = "Diesen Mitarbeiter gibt es nicht mehr. Bitte wählen Sie neu aus.";
  }

  // Standort: Auswahl, sonst der des Kunden (Unterkunde ohne eigenen: der des Firmenkunden), bei Privatkunden der Hauptsitz
  const chosenLocation = await parseLocationId(formData.get("locationId"));
  if (chosenLocation === undefined) extra.locationId = "Diesen Standort gibt es nicht mehr. Bitte wählen Sie neu aus.";

  if (Object.keys(extra).length > 0) {
    return invalidState(formData, null, extra, `Bitte prüfen Sie die markierten Felder.${filesNote(files)}`);
  }
  const locationId = chosenLocation ?? (await defaultTicketLocationId(company?.id ?? null));

  const guestToken = isPrivate ? generateToken(24) : null;
  const contactName = contactUser ? contactUser.name : (input.contactName ?? null);
  const contactEmail = contactUser ? contactUser.email : (input.contactEmail ?? null);
  const contactPhone = contactUser ? (input.contactPhone ?? contactUser.phone ?? null) : (input.contactPhone ?? null);

  let ticketId: number;
  try {
    const ticket = await db.ticket.create({
      data: {
        subject: input.subject,
        type: input.type,
        category: input.category,
        priority: input.priority,
        // Mit Bearbeiter ist das Ticket schon in Arbeit, sonst landet es bei „Neu“
        status: assignee ? "IN_PROGRESS" : "NEW",
        source: "STAFF",
        companyId: company?.id ?? null,
        // Mit Ansprechpartner sieht diese Person das Ticket im Kundenportal und bekommt die E-Mails dazu
        createdById: contactUser?.id ?? null,
        assigneeId: assignee?.id ?? null,
        locationId,
        contactName,
        contactEmail,
        contactPhone,
        contactAddress: isPrivate ? (input.contactAddress ?? null) : null,
        guestToken,
      },
      select: { id: true },
    });
    ticketId = ticket.id;
  } catch (error) {
    console.error("[verwaltung] Ticket konnte nicht angelegt werden:", error instanceof Error ? error.message : error);
    return errorState(`Das Ticket konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.${filesNote(files)}`, formData);
  }

  try {
    await createTicketMessage({
      ticketId,
      body: input.body,
      authorId: staff.id,
      authorName: staff.name,
      fromStaff: true,
      internal: false,
      files,
    });
    await recordTicketEvent(ticketId, "CREATED", staff.id);
  } catch (error) {
    console.error("[verwaltung] Beschreibung konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    // Kein Ticket ohne Beschreibung zurücklassen
    await db.ticket.delete({ where: { id: ticketId } }).catch(() => undefined);
    return errorState(`Das Ticket konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.${filesNote(files)}`, formData);
  }

  let mail = "";
  if (input.notify) {
    const subject = input.subject;
    const body = [input.body, attachmentNote(files.length)].filter(Boolean).join("\n\n");
    if (isPrivate && contactEmail && guestToken) {
      const to = contactEmail;
      const name = contactName ?? "";
      after(() => sendPrivateTicketConfirmation({ to, name, ticketId, subject, token: guestToken }));
      mail = "&mail=1";
    } else {
      const recipient = await customerRecipient(ticketId);
      if (recipient) {
        after(() =>
          sendStaffCreatedTicketMail({
            to: recipient.email,
            name: recipient.name,
            ticketId,
            subject,
            body,
            link: recipient.link,
          }),
        );
        mail = "&mail=1";
      } else {
        mail = "&mail=0";
      }
    }
  }

  revalidateAdmin();
  redirect(`/admin/tickets/${ticketId}?neu=1${mail}`);
}

/* ======================================================================
 * Bearbeitung: Status, Priorität, Art, Bereich, Bearbeiter, Zuordnung
 * ==================================================================== */

const metaSchema = z.object({
  status: z.enum(TICKET_STATUSES, { error: "Bitte einen Status auswählen." }),
  priority: z.enum(TICKET_PRIORITIES, { error: "Bitte eine Priorität auswählen." }),
  type: z.enum(TICKET_TYPES, { error: "Bitte die Art auswählen." }),
  category: z.enum(TICKET_CATEGORIES, { error: "Bitte einen Bereich auswählen." }),
  assigneeId: z.string().trim().max(40),
  customer: z.string().trim().min(1, "Bitte eine Zuordnung auswählen.").max(40),
  notify: checkbox,
});

const metaTicketSelect = {
  id: true,
  subject: true,
  status: true,
  priority: true,
  type: true,
  category: true,
  assigneeId: true,
  assignee: { select: { name: true } },
  locationId: true,
  companyId: true,
  guestToken: true,
  company: { select: { name: true, parent: { select: { name: true } } } },
  createdBy: {
    select: {
      name: true,
      role: true,
      company: { select: { id: true, name: true, parentId: true } },
    },
  },
} as const;

export async function updateTicketMetaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();

  const ticketId = parseTicketIdParam(text(formData, "ticketId"));
  const ticket = ticketId ? await db.ticket.findUnique({ where: { id: ticketId }, select: metaTicketSelect }) : null;
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr. Bitte öffnen Sie es noch einmal über die Ticketliste.");

  const parsed = metaSchema.safeParse({
    status: text(formData, "status"),
    priority: text(formData, "priority"),
    type: text(formData, "type"),
    category: text(formData, "category"),
    assigneeId: text(formData, "assigneeId"),
    customer: text(formData, "customer"),
    notify: formData.get("notify"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const input = parsed.data;
  const extra: Record<string, string> = {};

  // Bearbeiter: nur aktive Mitarbeiter; ein bereits eingetragener (evtl. inzwischen deaktivierter) darf bleiben
  const newAssigneeId = input.assigneeId || null;
  let newAssignee: { id: string; name: string } | null = null;
  if (newAssigneeId && newAssigneeId !== ticket.assigneeId) {
    newAssignee = await findActiveStaff(newAssigneeId);
    if (!newAssignee) extra.assigneeId = "Diesen Mitarbeiter gibt es nicht mehr oder er ist deaktiviert.";
  }

  // Zuordnung zu Firma/Unterkunde
  const targetCompanyId = input.customer === PRIVATE_CUSTOMER ? null : input.customer;
  let targetCompany: CompanyRef | null = null;
  const companyChanged = targetCompanyId !== ticket.companyId;
  if (companyChanged) {
    if (targetCompanyId === null) {
      // Zurück zum Privatkunden nur, wenn das Ticket ursprünglich privat war (Status-Link vorhanden)
      if (!ticket.guestToken) extra.customer = "Ein Ticket eines Firmenkunden kann nicht zum Privatkunden-Ticket werden.";
    } else {
      targetCompany = await db.company.findUnique({ where: { id: targetCompanyId }, select: companyRefSelect });
      if (!targetCompany) extra.customer = "Diesen Kunden gibt es nicht mehr. Bitte laden Sie die Seite neu.";
      else if (!targetCompany.active || targetCompany.parent?.active === false) {
        extra.customer = "Dieser Kunde ist deaktiviert und kann keine Tickets bekommen.";
      } else if (ticket.createdBy && (CUSTOMER_ROLES as readonly string[]).includes(ticket.createdBy.role) && ticket.createdBy.company) {
        // Wer das Ticket im Portal gemeldet hat, muss es danach noch sehen können
        const creatorCompany = ticket.createdBy.company;
        const allowed =
          targetCompany.id === creatorCompany.id ||
          (ticket.createdBy.role === "CUSTOMER_ADMIN" && creatorCompany.parentId === null && targetCompany.parentId === creatorCompany.id);
        if (!allowed) {
          extra.customer = `${ticket.createdBy.name} würde das Ticket nach dem Umhängen im Kundenportal nicht mehr sehen. Legen Sie für den anderen Kunden besser ein neues Ticket an.`;
        }
      }
    }
  }

  // Standort: nur aktive; ein bereits eingetragener (inzwischen deaktivierter) darf bleiben.
  // Fehlt das Feld (keine Standorte angelegt), bleibt der Standort unverändert.
  let newLocationId = ticket.locationId;
  if (formData.has("locationId")) {
    const raw = text(formData, "locationId");
    if (raw && raw === ticket.locationId) newLocationId = raw;
    else {
      const parsedLocation = await parseLocationId(raw);
      if (parsedLocation === undefined) extra.locationId = "Diesen Standort gibt es nicht mehr. Bitte wählen Sie neu aus.";
      else newLocationId = parsedLocation;
    }
  }

  if (Object.keys(extra).length > 0) return errorState("Bitte prüfen Sie die markierten Felder.", formData, extra);

  const changes: string[] = [];
  const events: { type: "PRIORITY" | "TYPE" | "CATEGORY" | "ASSIGNEE" | "COMPANY"; from: string | null; to: string | null }[] = [];
  const data: {
    priority?: string;
    type?: string;
    category?: string;
    assigneeId?: string | null;
    companyId?: string | null;
    locationId?: string | null;
  } = {};

  if (input.priority !== ticket.priority) {
    data.priority = input.priority;
    events.push({ type: "PRIORITY", from: ticket.priority, to: input.priority });
    changes.push("Priorität");
  }
  if (input.type !== ticket.type) {
    data.type = input.type;
    events.push({ type: "TYPE", from: ticket.type, to: input.type });
    changes.push("Art");
  }
  if (input.category !== ticket.category) {
    data.category = input.category;
    events.push({ type: "CATEGORY", from: ticket.category, to: input.category });
    changes.push("Bereich");
  }
  if (newAssigneeId !== ticket.assigneeId) {
    data.assigneeId = newAssigneeId;
    events.push({ type: "ASSIGNEE", from: ticket.assignee?.name ?? null, to: newAssignee?.name ?? null });
    changes.push("Bearbeiter");
  }
  if (companyChanged) {
    data.companyId = targetCompanyId;
    events.push({ type: "COMPANY", from: companyLabel(ticket.company), to: companyLabel(targetCompany) });
    changes.push("Zuordnung");
  }
  if (newLocationId !== ticket.locationId) {
    data.locationId = newLocationId;
    changes.push("Standort");
  }

  const statusChanged = input.status !== ticket.status;
  if (statusChanged) changes.push("Status");

  if (changes.length === 0) return successState("Es gab nichts zu speichern – alle Angaben waren schon so eingetragen.");

  try {
    if (Object.keys(data).length > 0) await db.ticket.update({ where: { id: ticket.id }, data });
    for (const event of events) await recordTicketEvent(ticket.id, event.type, staff.id, event.from, event.to);
    if (statusChanged) await setTicketStatus(ticket.id, input.status, staff.id);
  } catch (error) {
    console.error("[verwaltung] Ticket konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState("Die Änderungen konnten gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  let mailNote = "";
  if (statusChanged && input.notify && (input.status === "RESOLVED" || input.status === "CLOSED")) {
    const recipient = await customerRecipient(ticket.id);
    if (recipient) {
      const statusLabel = STATUS_LABELS[input.status];
      const closed = input.status === "CLOSED";
      const subject = ticket.subject;
      const id = ticket.id;
      after(() =>
        notifyCustomerStatusChange({ to: recipient.email, name: recipient.name, ticketId: id, subject, statusLabel, closed, link: recipient.link }),
      );
      mailNote = ` Der Kunde wird per E-Mail informiert (${recipient.email}).`;
    } else {
      mailNote = " Eine E-Mail an den Kunden war nicht möglich, weil keine Adresse hinterlegt ist.";
    }
  }

  revalidateAdmin();
  return successState(`Gespeichert: ${changes.join(", ")}.${mailNote}`);
}

/* ======================================================================
 * Antwort an den Kunden oder interne Notiz
 * ==================================================================== */

const replySchema = z.object({
  mode: z.enum(["reply", "internal"], { error: "Bitte wählen Sie: Antwort an den Kunden oder interne Notiz." }),
  body: bodySchema,
  statusAfter: z.union([z.enum(TICKET_STATUSES), z.literal("")], { error: "Bitte einen Status aus der Liste wählen." }),
});

export async function staffReplyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();

  const ticketId = parseTicketIdParam(text(formData, "ticketId"));
  const ticket = ticketId
    ? await db.ticket.findUnique({ where: { id: ticketId }, select: { id: true, subject: true, status: true, assigneeId: true } })
    : null;
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr. Bitte öffnen Sie es noch einmal über die Ticketliste.");

  const files = filesFromFormData(formData);
  const parsed = replySchema.safeParse({
    mode: text(formData, "mode"),
    body: text(formData, "body"),
    statusAfter: text(formData, "statusAfter"),
  });
  const fileError = validateFiles(files);
  if (!parsed.success || fileError) {
    return invalidState(
      formData,
      parsed.success ? null : parsed.error,
      fileError ? { attachments: fileError } : {},
      `Bitte prüfen Sie die Nachricht.${filesNote(files)}`,
    );
  }

  const internal = parsed.data.mode === "internal";
  const body = parsed.data.body;
  const chosen = (parsed.data.statusAfter || null) as TicketStatus | null;
  // Öffentliche Antwort: gewählter Status oder automatisch (Neu -> In Bearbeitung). Interne Notiz: nur auf Wunsch.
  const nextStatus: TicketStatus | null = internal ? chosen : (chosen ?? statusAfterStaffReply(ticket.status));

  try {
    await createTicketMessage({
      ticketId: ticket.id,
      body,
      authorId: staff.id,
      authorName: staff.name,
      fromStaff: true,
      internal,
      files,
    });
    if (nextStatus && nextStatus !== ticket.status) await setTicketStatus(ticket.id, nextStatus, staff.id);
    // Wer antwortet, kümmert sich – sofern noch niemand eingetragen ist
    if (!ticket.assigneeId) {
      await db.ticket.update({ where: { id: ticket.id }, data: { assigneeId: staff.id } });
      await recordTicketEvent(ticket.id, "ASSIGNEE", staff.id, null, staff.name);
    }
  } catch (error) {
    console.error("[verwaltung] Nachricht konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState(`Die Nachricht konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.${filesNote(files)}`, formData);
  }

  revalidateAdmin();

  if (internal) return successState("Interne Notiz gespeichert.");

  const recipient = await customerRecipient(ticket.id);
  if (!recipient) {
    return successState("Antwort gespeichert. Eine E-Mail-Benachrichtigung war nicht möglich, weil keine Adresse hinterlegt ist.");
  }
  // Der Empfänger ist gerade live im Ticket: Die Antwort erscheint sofort bei ihm, die E-Mail entfällt (siehe notifyCustomerStaffReply).
  // Sieht nur jemand anderes zu (z. B. der Hauptansprechpartner), bekommt der Empfänger seine E-Mail trotzdem.
  if (isRecipientWatchingTicket(ticket.id, recipient.userId)) {
    return successState(
      `Antwort gesendet. ${recipient.name || "Der Kunde"} ist gerade online und sieht sie sofort – eine E-Mail war nicht nötig.`,
    );
  }
  const finalStatus = nextStatus ?? ticket.status;
  const mailBody = [body, attachmentNote(files.length)].filter(Boolean).join("\n\n");
  const subject = ticket.subject;
  const id = ticket.id;
  after(() =>
    notifyCustomerStaffReply({
      to: recipient.email,
      name: recipient.name,
      ticketId: id,
      subject,
      body: mailBody,
      link: recipient.link,
      waitingForCustomer: finalStatus === "WAITING_CUSTOMER",
      userId: recipient.userId,
    }),
  );
  return successState(`Antwort gesendet – Benachrichtigung an ${recipient.email}.`);
}

/* ======================================================================
 * Status-Link erneut senden (Privatkunden)
 * ==================================================================== */

export async function resendGuestLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const ticketId = parseTicketIdParam(text(formData, "ticketId"));
  const ticket = ticketId
    ? await db.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, subject: true, companyId: true, guestToken: true, contactEmail: true, contactName: true },
      })
    : null;
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr.");
  if (ticket.companyId || !ticket.guestToken) return errorState("Zu diesem Ticket gibt es keinen Status-Link.");
  if (!ticket.contactEmail) return errorState("Es ist keine E-Mail-Adresse hinterlegt. Den Link können Sie oben kopieren und weitergeben.");

  if (!rateLimit(`admin:status-link:${ticket.id}`, 5, HOUR).ok) {
    return errorState("Der Link wurde in der letzten Stunde schon mehrfach verschickt. Bitte warten Sie etwas.");
  }

  try {
    await sendPrivateStatusLink({
      to: ticket.contactEmail,
      name: ticket.contactName ?? "",
      ticketId: ticket.id,
      subject: ticket.subject,
      token: ticket.guestToken,
    });
  } catch (error) {
    console.error("[verwaltung] Status-Link konnte nicht verschickt werden:", error instanceof Error ? error.message : error);
    return errorState("Die E-Mail konnte gerade nicht verschickt werden. Bitte versuchen Sie es später noch einmal.");
  }

  return successState(`Status-Link an ${ticket.contactEmail} gesendet.`);
}

/* ======================================================================
 * Ticket übernehmen (Schnellaktion im Kopf der Detailseite)
 * Aufruf über <form action={takeTicketAction.bind(null, id)}>.
 * ==================================================================== */

export async function takeTicketAction(rawTicketId: number): Promise<void> {
  const staff: SessionUser = await requireStaff();
  const ticketId = parseTicketIdParam(rawTicketId);
  const ticket = ticketId
    ? await db.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, status: true, assigneeId: true, assignee: { select: { name: true } } },
      })
    : null;
  if (!ticket) redirect("/admin/tickets");

  if (ticket.assigneeId !== staff.id) {
    await db.ticket.update({ where: { id: ticket.id }, data: { assigneeId: staff.id } });
    await recordTicketEvent(ticket.id, "ASSIGNEE", staff.id, ticket.assignee?.name ?? null, staff.name);
  }
  if (ticket.status === "NEW") await setTicketStatus(ticket.id, "IN_PROGRESS", staff.id);

  revalidateAdmin();
}

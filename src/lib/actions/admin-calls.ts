"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PRIVATE_CUSTOMER } from "@/components/admin/calls/types";
import { requireAdmin, requireStaff, type SessionUser } from "@/lib/auth";
import { generateToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { CUSTOMER_ROLES, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_TYPES } from "@/lib/constants";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { defaultTicketLocationId } from "@/lib/locations";
import { formatTicketNumber, parseTicketNumber } from "@/lib/format";
import { sendPortalTicketConfirmation, sendPrivateTicketConfirmation } from "@/lib/notifications";
import { formatPhoneDisplay, isInternalNumber, normalizePhone } from "@/lib/phone";
import {
  companyPath,
  describeCall,
  matchCaller,
  processCallEvent,
  publishCallChanged,
  scheduleTestCallEnd,
  storedCallerLabel,
} from "@/lib/telephony";
import { createTicketMessage, recordTicketEvent } from "@/lib/tickets";
import { checkbox, email, optionalText, phone, requiredText } from "@/lib/validation";

/**
 * Aktionen zur Anrufliste in der Verwaltung: Ticket aus Anruf, Verknüpfen, Erledigt, Notiz, Testanruf.
 * Jede Aktion prüft zuerst die Anmeldung und danach, ob der Anruf (noch) existiert.
 */

const callSelect = {
  id: true,
  direction: true,
  status: true,
  fromNumber: true,
  toNumber: true,
  startedAt: true,
  answeredAt: true,
  endedAt: true,
  answeredBy: true,
  callerLabel: true,
  companyId: true,
  userId: true,
  ticketId: true,
  handledAt: true,
} as const;

async function findCall(callId: unknown) {
  if (typeof callId !== "string" || callId.length === 0 || callId.length > 40) return null;
  return db.phoneCall.findUnique({ where: { id: callId }, select: callSelect });
}

function revalidateCalls(callId?: string) {
  // Zähler „verpasste Anrufe“ steht in der Navigation – deshalb das ganze Layout neu laden
  revalidatePath("/admin", "layout");
  if (callId) revalidatePath(`/admin/anrufe/${callId}`);
}

/* ------------------------------------------------------------------ */
/* Ticket aus Anruf                                                    */
/* ------------------------------------------------------------------ */

const optionalEmail = z
  .string()
  .trim()
  .max(200, "Die E-Mail-Adresse ist zu lang.")
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(email.optional());

const ticketFromCallSchema = z.object({
  subject: requiredText("einen Betreff", 160),
  type: z.enum(TICKET_TYPES, { error: "Bitte die Art auswählen." }),
  category: z.enum(TICKET_CATEGORIES, { error: "Bitte einen Bereich auswählen." }),
  priority: z.enum(TICKET_PRIORITIES, { error: "Bitte eine Priorität auswählen." }),
  customer: z
    .string({ error: "Bitte einen Kunden auswählen." })
    .trim()
    .min(1, "Bitte einen Kunden auswählen oder „Privatkunde“ wählen.")
    .max(40),
  contactUserId: optionalText(40),
  contactName: optionalText(120),
  contactPhone: phone,
  contactEmail: optionalEmail,
  note: requiredText("eine Gesprächsnotiz", 5000),
  publicMessage: optionalText(5000),
  notify: checkbox,
  assignToMe: checkbox,
});

export async function createTicketFromCallAction(callId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const call = await findCall(callId);
  if (!call) return errorState("Diesen Anruf gibt es nicht mehr. Bitte laden Sie die Anrufliste neu.");
  if (call.ticketId) {
    return errorState(`Zu diesem Anruf gibt es schon ein Ticket (${formatTicketNumber(call.ticketId)}).`);
  }

  const parsed = ticketFromCallSchema.safeParse({
    subject: formData.get("subject"),
    type: formData.get("type"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    customer: formData.get("customer"),
    contactUserId: formData.get("contactUserId") ?? undefined,
    contactName: formData.get("contactName") ?? undefined,
    contactPhone: formData.get("contactPhone") ?? undefined,
    contactEmail: formData.get("contactEmail") ?? undefined,
    note: formData.get("note"),
    publicMessage: formData.get("publicMessage") ?? undefined,
    notify: formData.get("notify"),
    assignToMe: formData.get("assignToMe"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const input = parsed.data;
  const isPrivate = input.customer === PRIVATE_CUSTOMER;

  // Kunde und Ansprechpartner nie ungeprüft aus dem Formular übernehmen
  let company: {
    id: string;
    name: string;
    slug: string | null;
    active: boolean;
    parentId: string | null;
    parent: { id: string; name: string; slug: string | null; active: boolean } | null;
  } | null = null;
  if (!isPrivate) {
    company = await db.company.findUnique({
      where: { id: input.customer },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        parentId: true,
        parent: { select: { id: true, name: true, slug: true, active: true } },
      },
    });
    if (!company) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, { customer: "Diesen Kunden gibt es nicht mehr." });
    }
    if (!company.active || company.parent?.active === false) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
        customer: "Dieser Kunde ist deaktiviert. Aktivieren Sie ihn zuerst oder wählen Sie einen anderen.",
      });
    }
  }

  let contactUser: { id: string; name: string; email: string; active: boolean } | null = null;
  if (company && input.contactUserId) {
    contactUser = await db.user.findFirst({
      where: { id: input.contactUserId, companyId: company.id, role: { in: [...CUSTOMER_ROLES] } },
      select: { id: true, name: true, email: true, active: true },
    });
    if (!contactUser) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
        contactUserId: "Dieser Ansprechpartner gehört nicht zum gewählten Kunden.",
      });
    }
  }

  if (isPrivate && !input.contactName) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
      contactName: "Bei Privatkunden brauchen wir einen Namen.",
    });
  }

  const contactName = contactUser ? null : (input.contactName ?? null);
  const contactPhone = contactUser ? null : (input.contactPhone ?? null);
  const contactEmail = contactUser ? null : (input.contactEmail ?? null);
  const guestToken = company ? null : generateToken(24);
  // Standort wie bei jedem anderen neuen Ticket: der des Kunden, bei Privatkunden der Hauptsitz
  const locationId = await defaultTicketLocationId(company?.id ?? null);

  const ticket = await db.ticket.create({
    data: {
      subject: input.subject,
      type: input.type,
      category: input.category,
      priority: input.priority,
      // Wie beim Anlegen in der Verwaltung: Mit Bearbeiter ist das Ticket schon in Bearbeitung, nicht mehr „Neu“
      status: input.assignToMe ? "IN_PROGRESS" : "NEW",
      source: "STAFF",
      companyId: company?.id ?? null,
      locationId,
      // Mit Ansprechpartner sieht dieser das Ticket auch im Kundenportal
      createdById: contactUser?.id ?? staff.id,
      assigneeId: input.assignToMe ? staff.id : null,
      contactName,
      contactPhone,
      contactEmail,
      guestToken,
    },
    select: { id: true },
  });

  const who = call.callerLabel ?? contactUser?.name ?? contactName;
  await createTicketMessage({
    ticketId: ticket.id,
    body: `${describeCall(call, who)}\n\n${input.note}`,
    authorId: staff.id,
    authorName: staff.name,
    fromStaff: true,
    internal: true,
  });
  if (input.publicMessage) {
    await createTicketMessage({
      ticketId: ticket.id,
      body: input.publicMessage,
      authorId: staff.id,
      authorName: staff.name,
      fromStaff: true,
      internal: false,
    });
  }
  await recordTicketEvent(ticket.id, "CREATED", staff.id);

  const fallbackLabel = company
    ? `${contactUser?.name ?? contactName ?? "Ansprechpartner"} · ${companyPath(company)}`
    : `Privatkunde: ${contactName ?? "Name unbekannt"} (${formatTicketNumber(ticket.id)})`;
  await db.phoneCall.update({
    where: { id: call.id },
    data: {
      ticketId: ticket.id,
      ...(call.handledAt ? {} : { handledAt: new Date(), handledById: staff.id }),
      // Unbekannter Anrufer: Zuordnung aus dem Formular übernehmen
      ...(call.companyId || !company ? {} : { companyId: company.id }),
      ...(call.userId || !contactUser ? {} : { userId: contactUser.id }),
      ...(call.callerLabel ? {} : { callerLabel: fallbackLabel }),
    },
  });

  if (input.notify) {
    try {
      if (company) {
        const slug = company.parent?.slug ?? company.slug;
        const recipient = contactUser?.active
          ? { email: contactUser.email, name: contactUser.name }
          : contactEmail
            ? { email: contactEmail, name: contactName ?? "" }
            : null;
        if (slug && recipient) {
          await sendPortalTicketConfirmation({ to: recipient.email, name: recipient.name, ticketId: ticket.id, subject: input.subject, slug });
        }
      } else if (contactEmail && guestToken) {
        await sendPrivateTicketConfirmation({
          to: contactEmail,
          name: contactName ?? "",
          ticketId: ticket.id,
          subject: input.subject,
          token: guestToken,
        });
      }
    } catch (error) {
      console.error("[anrufe] Bestätigung konnte nicht verschickt werden:", error instanceof Error ? error.message : error);
    }
  }

  await publishCallChanged(call.id);
  revalidateCalls(call.id);
  revalidatePath("/admin/tickets");
  redirect(`/admin/tickets/${ticket.id}`);
}

/* ------------------------------------------------------------------ */
/* Mit bestehendem Ticket verknüpfen                                   */
/* ------------------------------------------------------------------ */

async function linkCallToTicket(
  staff: SessionUser,
  callId: unknown,
  ticketId: number,
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const call = await findCall(callId);
  if (!call) return { ok: false, error: "Diesen Anruf gibt es nicht mehr. Bitte laden Sie die Anrufliste neu." };
  if (call.ticketId === ticketId) return { ok: true };
  if (call.ticketId) {
    return { ok: false, error: `Der Anruf ist schon mit ${formatTicketNumber(call.ticketId)} verknüpft. Lösen Sie zuerst diese Verknüpfung.` };
  }
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, select: { id: true, companyId: true } });
  if (!ticket) return { ok: false, error: `Ein Ticket ${formatTicketNumber(ticketId)} gibt es nicht.` };

  await db.phoneCall.update({
    where: { id: call.id },
    data: {
      ticketId: ticket.id,
      ...(call.handledAt ? {} : { handledAt: new Date(), handledById: staff.id }),
      ...(call.companyId || !ticket.companyId ? {} : { companyId: ticket.companyId }),
    },
  });
  await createTicketMessage({
    ticketId: ticket.id,
    body: note ? `${describeCall(call)}\n\n${note}` : describeCall(call),
    authorId: staff.id,
    authorName: staff.name,
    fromStaff: true,
    internal: true,
  });
  await publishCallChanged(call.id);
  return { ok: true };
}

const linkSchema = z.object({
  ticket: z.string({ error: "Bitte eine Ticketnummer angeben." }).trim().min(1, "Bitte eine Ticketnummer angeben.").max(20),
  note: optionalText(5000),
});

export async function linkCallToTicketAction(callId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const parsed = linkSchema.safeParse({ ticket: formData.get("ticket"), note: formData.get("note") ?? undefined });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const ticketId = parseTicketNumber(parsed.data.ticket);
  if (!ticketId) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
      ticket: "Bitte die Nummer so angeben, wie sie im Ticket steht, z. B. T-00042.",
    });
  }
  const result = await linkCallToTicket(staff, callId, ticketId, parsed.data.note);
  if (!result.ok) return errorState(result.error, formData);
  revalidateCalls(typeof callId === "string" ? callId : undefined);
  revalidatePath(`/admin/tickets/${ticketId}`);
  return successState(`Der Anruf ist jetzt mit ${formatTicketNumber(ticketId)} verknüpft.`);
}

/** Schnell-Verknüpfung über einen Vorschlag (offenes Ticket des Kunden). */
export async function linkCallToSuggestedTicketAction(callId: string, ticketId: number): Promise<void> {
  const staff = await requireStaff();
  if (!Number.isInteger(ticketId) || ticketId <= 0) return;
  const result = await linkCallToTicket(staff, callId, ticketId);
  if (result.ok) {
    revalidateCalls(typeof callId === "string" ? callId : undefined);
    revalidatePath(`/admin/tickets/${ticketId}`);
  }
}

export async function unlinkCallTicketAction(callId: string): Promise<void> {
  await requireStaff();
  const call = await findCall(callId);
  if (!call || !call.ticketId) return;
  await db.phoneCall.update({ where: { id: call.id }, data: { ticketId: null } });
  await publishCallChanged(call.id);
  revalidateCalls(call.id);
}

/* ------------------------------------------------------------------ */
/* Erledigt und Notiz                                                  */
/* ------------------------------------------------------------------ */

/** Erledigt markieren (bei verpassten Anrufen: zurückgerufen) oder wieder öffnen. */
export async function setCallHandledAction(callId: string, handled: boolean): Promise<void> {
  const staff = await requireStaff();
  const call = await findCall(callId);
  if (!call) return;
  if (handled === true && !call.handledAt) {
    await db.phoneCall.update({ where: { id: call.id }, data: { handledAt: new Date(), handledById: staff.id } });
  } else if (handled === false && call.handledAt) {
    await db.phoneCall.update({ where: { id: call.id }, data: { handledAt: null, handledById: null } });
  } else {
    return;
  }
  await publishCallChanged(call.id);
  revalidateCalls(call.id);
}

const noteSchema = z.object({ note: optionalText(2000) });

export async function saveCallNoteAction(callId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const call = await findCall(callId);
  if (!call) return errorState("Diesen Anruf gibt es nicht mehr. Bitte laden Sie die Anrufliste neu.");
  const parsed = noteSchema.safeParse({ note: formData.get("note") ?? undefined });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  await db.phoneCall.update({ where: { id: call.id }, data: { note: parsed.data.note ?? null } });
  revalidateCalls(call.id);
  return successState(parsed.data.note ? "Notiz gespeichert." : "Notiz entfernt.");
}

/* ------------------------------------------------------------------ */
/* Testanruf (nur Administratoren)                                     */
/* ------------------------------------------------------------------ */

export async function simulateTestCallAction(): Promise<FormState> {
  await requireAdmin();

  const [users, companies] = await Promise.all([
    db.user.findMany({
      where: { phone: { not: null }, active: true, role: { in: [...CUSTOMER_ROLES] }, company: { active: true } },
      select: { phone: true },
      take: 50,
    }),
    db.company.findMany({ where: { phone: { not: null }, active: true }, select: { phone: true }, take: 50 }),
  ]);
  const numbers = [...new Set([...users, ...companies].map((x) => normalizePhone(x.phone)))].filter(
    (n): n is string => !!n && !isInternalNumber(n),
  );
  if (numbers.length === 0) {
    return errorState(
      "Bei keinem Kunden ist eine Telefonnummer hinterlegt. Tragen Sie zuerst bei einem Kunden oder Ansprechpartner eine Nummer ein.",
    );
  }

  const number = numbers[randomInt(numbers.length)];
  const callId = generateToken(9);
  await processCallEvent({
    provider: "test",
    kind: "ringing",
    callId,
    direction: "IN",
    from: number,
    to: null,
    answeredBy: null,
    cause: null,
    at: null,
  });
  scheduleTestCallEnd(callId);
  const match = await matchCaller(number);

  revalidateCalls();
  return successState(
    `Testanruf von ${storedCallerLabel(match) ?? "einem Kunden"} (${formatPhoneDisplay(number)}) ist eingegangen. ` +
      "Der Hinweis erscheint jetzt unten rechts bei allen angemeldeten Mitarbeitern und verschwindet nach etwa 20 Sekunden.",
  );
}

export async function deleteTestCallsAction(): Promise<void> {
  await requireAdmin();
  await db.phoneCall.deleteMany({ where: { provider: "test" } });
  revalidateCalls();
}


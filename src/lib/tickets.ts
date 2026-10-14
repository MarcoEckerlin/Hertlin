import "server-only";
import { db } from "@/lib/db";
import { removeStoredFiles, storeFiles } from "@/lib/uploads";
import { mainUrl, portalUrl } from "@/lib/hosts";
import type { TicketStatus } from "@/lib/constants";

/**
 * Gemeinsame Ticket-Logik für Kundenportal, Privatkunden-Status und Verwaltung.
 * Rechteprüfung passiert VOR dem Aufruf dieser Funktionen.
 */

/** Legt eine Nachricht samt Anhängen an. Dateien vorher mit validateFiles() prüfen. */
export async function createTicketMessage(opts: {
  ticketId: number;
  body: string;
  authorId?: string | null;
  authorName?: string | null;
  fromStaff?: boolean;
  internal?: boolean;
  files?: File[];
}): Promise<{ id: string }> {
  const stored = await storeFiles(opts.files ?? []);
  try {
    const message = await db.ticketMessage.create({
      data: {
        ticketId: opts.ticketId,
        body: opts.body,
        authorId: opts.authorId ?? null,
        authorName: opts.authorName ?? null,
        fromStaff: opts.fromStaff ?? false,
        internal: opts.internal ?? false,
        attachments: { create: stored },
      },
      select: { id: true },
    });
    await db.ticket.update({ where: { id: opts.ticketId }, data: { updatedAt: new Date() } });
    return message;
  } catch (error) {
    await removeStoredFiles(stored.map((s) => s.storedName));
    throw error;
  }
}

export async function recordTicketEvent(
  ticketId: number,
  type: "CREATED" | "STATUS" | "PRIORITY" | "ASSIGNEE" | "COMPANY" | "TYPE" | "CATEGORY",
  actorId: string | null,
  fromValue?: string | null,
  toValue?: string | null,
): Promise<void> {
  await db.ticketEvent.create({ data: { ticketId, type, actorId, fromValue: fromValue ?? null, toValue: toValue ?? null } });
}

/** Setzt den Status inkl. Zeitstempel und Protokolleintrag. Gibt false zurück, wenn sich nichts geändert hat. */
export async function setTicketStatus(ticketId: number, status: TicketStatus, actorId: string | null): Promise<boolean> {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
  if (!ticket || ticket.status === status) return false;
  const now = new Date();
  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      resolvedAt: status === "RESOLVED" ? now : status === "CLOSED" ? undefined : null,
      closedAt: status === "CLOSED" ? now : null,
    },
  });
  await recordTicketEvent(ticketId, "STATUS", actorId, ticket.status, status);
  return true;
}

/**
 * Status nach einer Antwort des Kunden:
 * "Rückfrage an Sie" und "Gelöst" gehen zurück in die Bearbeitung, sonst bleibt der Status.
 * Geschlossene Tickets nehmen keine Antworten mehr an (vorher prüfen mit canCustomerReply).
 */
export function statusAfterCustomerReply(status: string): TicketStatus {
  if (status === "WAITING_CUSTOMER" || status === "RESOLVED") return "IN_PROGRESS";
  return status as TicketStatus;
}

/** Status nach einer öffentlichen Antwort von Hertlin, wenn nicht ausdrücklich ein anderer gewählt wurde. */
export function statusAfterStaffReply(status: string): TicketStatus {
  if (status === "NEW") return "IN_PROGRESS";
  return status as TicketStatus;
}

export function canCustomerReply(status: string): boolean {
  return status !== "CLOSED";
}

/** Link, über den der Kunde das Ticket sieht: Portal (Firmenkunden) oder Status-Link (Privatkunden). */
export function customerTicketLink(ticket: {
  id: number;
  guestToken: string | null;
  company: { slug: string | null; parent: { slug: string | null } | null } | null;
}): string | null {
  if (ticket.company) {
    const slug = ticket.company.parent?.slug ?? ticket.company.slug;
    return slug ? portalUrl(slug, `/tickets/${ticket.id}`) : null;
  }
  return ticket.guestToken ? mainUrl(`/status/${ticket.guestToken}`) : null;
}

/**
 * Empfänger für Benachrichtigungen an den Kunden:
 * Ersteller des Tickets (aktiver Portalbenutzer) bzw. hinterlegte Kontaktadresse.
 */
export async function customerRecipient(ticketId: number): Promise<{ email: string; name: string; link: string } | null> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      guestToken: true,
      contactEmail: true,
      contactName: true,
      createdBy: { select: { email: true, name: true, active: true, role: true } },
      company: { select: { slug: true, email: true, name: true, parent: { select: { slug: true } } } },
    },
  });
  if (!ticket) return null;
  const link = customerTicketLink(ticket);
  if (!link) return null;

  const creator = ticket.createdBy;
  if (creator && creator.active && (creator.role === "CUSTOMER_ADMIN" || creator.role === "CUSTOMER_USER")) {
    return { email: creator.email, name: creator.name, link };
  }
  if (ticket.contactEmail) return { email: ticket.contactEmail, name: ticket.contactName ?? "", link };
  return null;
}

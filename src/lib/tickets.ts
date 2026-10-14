import "server-only";
import { db } from "@/lib/db";
import { removeStoredFiles, storeFiles } from "@/lib/uploads";
import { mainUrl, portalUrl } from "@/lib/hosts";
import { CUSTOMER_ROLES, type TicketStatus } from "@/lib/constants";
import { publish } from "@/realtime/bus";

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
  /** Erste Nachricht beim Anlegen eines Tickets – der Hinweis „Neues Ticket“ folgt über recordTicketEvent */
  initial?: boolean;
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
    const ticket = await db.ticket.update({
      where: { id: opts.ticketId },
      data: { updatedAt: new Date() },
      select: { subject: true },
    });
    // Live: alle offenen Ansichten des Tickets laden den Verlauf neu (interne Notizen nur bei Mitarbeitern)
    publish({ type: "ticket.message", ticketId: opts.ticketId, internal: opts.internal ?? false, fromStaff: opts.fromStaff ?? false });
    if (!opts.fromStaff && !opts.initial) {
      let author = opts.authorName ?? null;
      if (!author && opts.authorId) {
        author = (await db.user.findUnique({ where: { id: opts.authorId }, select: { name: true } }))?.name ?? null;
      }
      publish({
        type: "staff.notice",
        notice: { kind: "ticket.message", ticketId: opts.ticketId, subject: ticket.subject, author: author ?? "Kunde" },
      });
    }
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

  if (type === "CREATED") {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: {
        subject: true,
        priority: true,
        contactName: true,
        company: { select: { name: true, parent: { select: { name: true } } } },
      },
    });
    if (ticket) {
      const customer = ticket.company
        ? [ticket.company.parent?.name, ticket.company.name].filter(Boolean).join(" › ")
        : `Privat: ${ticket.contactName ?? "unbekannt"}`;
      publish({
        type: "staff.notice",
        notice: { kind: "ticket.created", ticketId, subject: ticket.subject, priority: ticket.priority, customer },
      });
    }
  } else {
    publish({ type: "ticket.updated", ticketId });
  }
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

/** Grobe Formprüfung eines Status-Links, bevor die Datenbank gefragt wird. */
export function isPlausibleGuestToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,100}$/.test(token);
}

/** Bedingung für Privatkunden-Tickets per Status-Link. */
export function guestTicketWhere(token: string) {
  return { guestToken: token, companyId: null } as const;
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

/** Kundenkonto mit den Angaben, die für die Sichtbarkeit im Portal zählen. */
type PortalAccount = {
  id: string;
  role: string;
  active: boolean;
  company: { id: string; parentId: string | null; active: boolean; parent: { active: boolean } | null } | null;
};

const portalAccountSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  company: { select: { id: true, parentId: true, active: true, parent: { select: { active: true } } } },
} as const;

/**
 * Sieht dieses Kundenkonto das Ticket im Portal? Gleiche Regeln wie getPortalContext() und portalTicketWhere():
 * Konto, Firma und Firmenkunde aktiv; Hauptansprechpartner sehen die Tickets ihrer Firma (beim Firmenkunden
 * auch die der Unterkunden), Mitarbeiter nur selbst erstellte.
 */
export function portalAccountSeesTicket(
  account: PortalAccount,
  ticket: { companyId: string | null; createdById: string | null; company: { parentId: string | null } | null },
): boolean {
  if (!(CUSTOMER_ROLES as readonly string[]).includes(account.role)) return false;
  const company = account.company;
  if (!account.active || !company || !company.active || company.parent?.active === false) return false;
  if (!ticket.companyId || !ticket.company) return false;
  const isAdmin = account.role === "CUSTOMER_ADMIN";
  const inScope =
    ticket.companyId === company.id || (isAdmin && company.parentId === null && ticket.company.parentId === company.id);
  return inScope && (isAdmin || ticket.createdById === account.id);
}

/**
 * Empfänger für Benachrichtigungen an den Kunden:
 * - Ticket aus dem Portal (Ersteller ist ein Kundenkonto): der Ersteller, solange er das Ticket im Portal
 *   noch sehen darf. Sonst (gesperrt, umgehängt, herabgestuft) ein aktiver Hauptansprechpartner, der es sieht –
 *   nie die alte Kontaktadresse, denn die ist bei Portal-Tickets die Adresse des Erstellers.
 * - Sonst (Privatkunde, von Hertlin angelegt): die hinterlegte Kontaktadresse.
 */
export async function customerRecipient(ticketId: number): Promise<{ email: string; name: string; link: string } | null> {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      guestToken: true,
      contactEmail: true,
      contactName: true,
      companyId: true,
      createdById: true,
      createdBy: { select: portalAccountSelect },
      company: { select: { slug: true, email: true, name: true, parentId: true, parent: { select: { slug: true } } } },
    },
  });
  if (!ticket) return null;
  const link = customerTicketLink(ticket);
  if (!link) return null;

  const creator = ticket.createdBy;
  if (!ticket.company || !creator || !(CUSTOMER_ROLES as readonly string[]).includes(creator.role)) {
    return ticket.contactEmail ? { email: ticket.contactEmail, name: ticket.contactName ?? "", link } : null;
  }
  if (portalAccountSeesTicket(creator, ticket)) return { email: creator.email, name: creator.name, link };

  // Hauptansprechpartner der Ticketfirma zuerst, danach die des Firmenkunden
  const companyIds = [ticket.company.parentId, ticket.companyId].filter((id): id is string => !!id);
  const admins = await db.user.findMany({
    where: { role: "CUSTOMER_ADMIN", active: true, companyId: { in: companyIds } },
    select: portalAccountSelect,
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  const fallback = [...admins]
    .sort((a, b) => Number(a.company?.id !== ticket.companyId) - Number(b.company?.id !== ticket.companyId))
    .find((admin) => portalAccountSeesTicket(admin, ticket));
  return fallback ? { email: fallback.email, name: fallback.name, link } : null;
}

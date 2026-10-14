import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Zugriff über den Status-Link (Privatkunden, ohne Anmeldung).
 * Das Token ist das einzige Geheimnis – es gilt nur für Tickets aus dem Privatkunden-Formular.
 */

/** Tokens aus generateToken() sind base64url; offensichtlich falsche Werte gar nicht erst abfragen. */
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

export function isPlausibleGuestToken(token: string): boolean {
  return GUEST_TOKEN_PATTERN.test(token);
}

export function guestTicketWhere(token: string) {
  return { guestToken: token, source: "PRIVATE_FORM", companyId: null } satisfies Prisma.TicketWhereInput;
}

/**
 * Alles, was der Privatkunde sehen darf: keine Kosten, keine internen Notizen,
 * keine E-Mail-Adressen von Mitarbeitern.
 */
const guestTicketSelect = {
  id: true,
  subject: true,
  category: true,
  status: true,
  contactName: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  assignee: { select: { name: true } },
  messages: {
    where: { internal: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      fromStaff: true,
      authorName: true,
      createdAt: true,
      author: { select: { name: true } },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, mimeType: true, size: true },
      },
    },
  },
} satisfies Prisma.TicketSelect;

export type GuestTicket = Prisma.TicketGetPayload<{ select: typeof guestTicketSelect }>;

export async function loadGuestTicket(token: string): Promise<GuestTicket | null> {
  if (!isPlausibleGuestToken(token)) return null;
  return db.ticket.findFirst({ where: guestTicketWhere(token), select: guestTicketSelect });
}

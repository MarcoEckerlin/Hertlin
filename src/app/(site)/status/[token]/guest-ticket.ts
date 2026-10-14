import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isLangCode, type LangCode } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { translateForViewer } from "@/lib/chat-translation";

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
  return { guestToken: token, companyId: null } satisfies Prisma.TicketWhereInput;
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
  contactLanguage: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  assignee: { select: { name: true } },
  // Letzter Statuswechsel – nur serverseitig für die Live-Ansage (wer hat geändert: Kunde ohne Konto = null)
  events: {
    where: { type: "STATUS" },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: { id: true, createdAt: true, actorId: true },
  },
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

/* ------------------------------------------------------------------ */
/* Sprache und Übersetzung                                             */
/* ------------------------------------------------------------------ */

/**
 * Sprache, in der der Privatkunde unsere Antworten liest:
 * gespeicherte Wahl (Ticket.contactLanguage), sonst die Sprache des Website-Übersetzers (Cookie), sonst Deutsch.
 * fromCookie: nur vorausgewählt, noch nicht gespeichert.
 */
export function guestViewerLanguage(
  contactLanguage: string | null,
  cookieLanguage: string | null | undefined,
): { lang: LangCode; fromCookie: boolean } {
  if (isLangCode(contactLanguage)) return { lang: contactLanguage, fromCookie: false };
  if (isLangCode(cookieLanguage)) return { lang: cookieLanguage, fromCookie: cookieLanguage !== "de" };
  return { lang: "de", fromCookie: false };
}

/** Länger warten wir beim Seitenaufbau nicht auf den Übersetzungsdienst. */
const TRANSLATION_WAIT_MS = 6000;

export type GuestTranslations = Record<string, { text: string; from: string | null }>;

/**
 * Übersetzt die Nachrichten von Hertlin in die Sprache des Privatkunden.
 * Fällt der Dienst aus oder braucht zu lange, bleiben die Originale stehen; die Übersetzung landet
 * trotzdem im Zwischenspeicher und erscheint beim nächsten Laden.
 */
export async function guestMessageTranslations(messages: GuestTicket["messages"], lang: LangCode): Promise<GuestTranslations> {
  if (lang === "de" || !translationEnabled()) return {};
  const items = messages.filter((m) => m.fromStaff && m.body.trim() !== "").map((m) => ({ id: m.id, body: m.body }));
  if (items.length === 0) return {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<GuestTranslations>((resolve) => {
    timer = setTimeout(() => resolve({}), TRANSLATION_WAIT_MS);
  });
  try {
    return await Promise.race([
      translateForViewer(items, lang).catch((error: unknown) => {
        console.error("[status] Übersetzung der Nachrichten fehlgeschlagen:", error instanceof Error ? error.message : error);
        return {};
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

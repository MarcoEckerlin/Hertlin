import "server-only";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PortalContext } from "@/lib/auth";
import { customerMessagesWhere, customerTicketSelect, portalAssignableCompanyIds } from "@/lib/permissions";
import { parseTicketNumber } from "@/lib/format";
import { isLangCode, type LangCode } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { translateForViewer } from "@/lib/chat-translation";

/**
 * Gemeinsame Abfragen für die Kundenportal-Seiten und -Actions (Übersicht, Tickets, Profil).
 * Rechte: Aufrufer holen vorher den PortalContext über requirePortalContext().
 */

export type PortalCompanyOption = {
  id: string;
  name: string;
  /** true = der Firmenkunde selbst, false = Unterkunde */
  isRoot: boolean;
  active: boolean;
};

function sortCompanies(rootId: string, companies: { id: string; name: string; parentId: string | null; active: boolean }[]) {
  return companies
    .map((c) => ({ id: c.id, name: c.name, isRoot: c.id === rootId, active: c.active }))
    .sort((a, b) => (a.isRoot === b.isRoot ? a.name.localeCompare(b.name, "de") : a.isRoot ? -1 : 1));
}

/** Firmen, denen der Benutzer ein neues Ticket zuordnen darf (nur aktive). Firmenkunde zuerst, dann Unterkunden. */
export async function assignableCompanies(ctx: PortalContext): Promise<PortalCompanyOption[]> {
  const companies = await db.company.findMany({
    where: { id: { in: portalAssignableCompanyIds(ctx) }, active: true },
    select: { id: true, name: true, parentId: true, active: true },
  });
  return sortCompanies(ctx.root.id, companies);
}

/** Alle Firmen im Sichtbereich, z. B. für den Filter der Ticketliste (auch deaktivierte Unterkunden mit alten Tickets). */
export async function scopeCompanies(ctx: PortalContext): Promise<PortalCompanyOption[]> {
  const companies = await db.company.findMany({
    where: { id: { in: ctx.scopeCompanyIds } },
    select: { id: true, name: true, parentId: true, active: true },
  });
  return sortCompanies(ctx.root.id, companies);
}

/** Bezeichnung für E-Mails an das Team: Unterkunden mit Firmenkunde davor. */
export function staffCompanyLabel(ctx: PortalContext, company: { name: string; parentId: string | null }): string {
  return company.parentId ? `${ctx.root.name} › ${company.name}` : company.name;
}

/** Ticket-ID aus URL oder Formular. Akzeptiert nur positive ganze Zahlen. */
export function parseTicketId(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

/** Wie parseTicketId, akzeptiert aber auch die Anzeigeform „T-00042“ (z. B. aus einer abgetippten Adresse). */
export function parseTicketParam(value: string): number | null {
  const direct = parseTicketId(value);
  if (direct) return direct;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const id = parseTicketNumber(decoded);
  return id && id > 0 ? id : null;
}

/** Alle Portalseiten des Firmenkunden neu laden (Ticketzahlen, Listen, Name in der Seitenleiste). */
export function revalidatePortal(ctx: PortalContext): void {
  revalidatePath(`/portal/${ctx.root.slug}`, "layout");
}

/* ------------------------------------------------------------------ */
/* Ticketdetail                                                        */
/* ------------------------------------------------------------------ */

/** Ticket mit Verlauf für Kunden: ohne Kosten, ohne interne Notizen, nur Statuswechsel aus dem Protokoll. */
export const portalTicketDetailSelect = {
  ...customerTicketSelect,
  messages: {
    where: customerMessagesWhere,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      fromStaff: true,
      authorId: true,
      authorName: true,
      createdAt: true,
      author: { select: { name: true } },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, size: true },
      },
    },
  },
  events: {
    where: { type: "STATUS" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      toValue: true,
      createdAt: true,
      actorId: true,
      actor: { select: { name: true, role: true } },
    },
  },
} satisfies Prisma.TicketSelect;

export type PortalTicketDetail = Prisma.TicketGetPayload<{ select: typeof portalTicketDetailSelect }>;
export type PortalTicketMessage = PortalTicketDetail["messages"][number];
export type PortalTicketEvent = PortalTicketDetail["events"][number];

/** Ticketzeile für Listen. */
export type PortalTicketRow = Prisma.TicketGetPayload<{ select: typeof customerTicketSelect }>;

/* ------------------------------------------------------------------ */
/* Übersetzung der Nachrichten                                         */
/* ------------------------------------------------------------------ */

/** Nachrichten-ID -> Übersetzung in die Sprache des Lesers (nur Nachrichten, die übersetzt werden mussten). */
export type MessageTranslations = Record<string, { text: string; from: string | null }>;

/** Länger warten wir beim Seitenaufbau nicht auf den Übersetzungsdienst. */
const TRANSLATION_WAIT_MS = 6000;

/** Sprache, in der ein Portalbenutzer Nachrichten liest (Standard Deutsch). */
export function viewerLanguage(language: string | null | undefined): LangCode {
  return isLangCode(language) ? language : "de";
}

/**
 * Übersetzt die Nachrichten eines Tickets in die Sprache des Lesers (User.language).
 * - Eigene Nachrichten bleiben, wie sie geschrieben wurden.
 * - Bei Deutsch als Lesesprache werden nur Nachrichten von Kundenseite geprüft (Hertlin schreibt Deutsch).
 * - Dauert der Dienst zu lange oder fällt aus, bleiben die Originale stehen. Die Übersetzung läuft im
 *   Hintergrund weiter und liegt beim nächsten Laden im Zwischenspeicher.
 */
export async function portalMessageTranslations(
  messages: Pick<PortalTicketMessage, "id" | "body" | "authorId" | "fromStaff">[],
  viewer: { id: string; language: string | null | undefined },
): Promise<MessageTranslations> {
  const lang = viewerLanguage(viewer.language);
  if (!translationEnabled()) return {};
  const items = messages
    .filter((m) => m.authorId !== viewer.id && m.body.trim() !== "" && (lang !== "de" || !m.fromStaff))
    .map((m) => ({ id: m.id, body: m.body }));
  if (items.length === 0) return {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<MessageTranslations>((resolve) => {
    timer = setTimeout(() => resolve({}), TRANSLATION_WAIT_MS);
  });
  try {
    return await Promise.race([
      translateForViewer(items, lang).catch((error: unknown) => {
        console.error("[portal] Übersetzung der Nachrichten fehlgeschlagen:", error instanceof Error ? error.message : error);
        return {};
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

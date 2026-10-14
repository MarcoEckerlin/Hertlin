import "server-only";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PortalContext } from "@/lib/auth";
import { customerMessagesWhere, customerTicketSelect, portalAssignableCompanyIds } from "@/lib/permissions";
import { parseTicketNumber } from "@/lib/format";

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

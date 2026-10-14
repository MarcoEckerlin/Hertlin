import "server-only";
import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PortalContext } from "@/lib/auth";
import { CUSTOMER_ROLES, OPEN_STATUSES } from "@/lib/constants";
import { portalManageableUserWhere, portalTicketWhere } from "@/lib/permissions";
import type { CompanyOption, PortalRole } from "@/components/portal/admin/types";

/**
 * Abfragen für die Benutzer- und Unterkundenverwaltung im Kundenportal.
 * Aufrufer holen vorher den PortalContext über requirePortalAdmin() bzw. requirePortalRootAdmin().
 * Interne Felder (z. B. Company.internalNote, Passwort-Hashes) werden hier nie selektiert.
 */

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Vergleichsform für Suche und Namensprüfung: ohne Groß/Klein, Akzente und doppelte Leerzeichen. */
export function searchKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de");
}

/** Plausible ID aus URL oder Query (cuid). Alles andere gilt als nicht vorhanden. */
export function cleanId(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : null;
}

export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/** Firmen im Verwaltungsbereich: Firmenkunde zuerst, dann Unterkunden alphabetisch. */
export async function manageableCompanies(ctx: PortalContext): Promise<CompanyOption[]> {
  const companies = await db.company.findMany({
    where: { id: { in: ctx.scopeCompanyIds }, OR: [{ id: ctx.root.id }, { parentId: ctx.root.id }] },
    select: { id: true, name: true, active: true },
  });
  return companies
    .map((c) => ({ id: c.id, name: c.name, isRoot: c.id === ctx.root.id, active: c.active }))
    .sort((a, b) => (a.isRoot === b.isRoot ? compareNames(a.name, b.name) : a.isRoot ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/* Unterkunden                                                         */
/* ------------------------------------------------------------------ */

const subCustomerSelect = {
  id: true,
  name: true,
  street: true,
  zip: true,
  city: true,
  phone: true,
  email: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

export type SubCustomer = Prisma.CompanyGetPayload<{ select: typeof subCustomerSelect }>;

/** Unterkunde des Firmenkunden oder null (fremde Firmen und der Firmenkunde selbst zählen nicht). */
export const getSubCustomer = cache(async (rootId: string, id: string): Promise<SubCustomer | null> => {
  return db.company.findFirst({ where: { id, parentId: rootId }, select: subCustomerSelect });
});

export type SubCustomerRow = {
  id: string;
  name: string;
  street: string | null;
  zip: string | null;
  city: string | null;
  active: boolean;
  activeUsers: number;
  openTickets: number;
};

/** Alle Unterkunden mit Zahlen für die Liste, alphabetisch sortiert. */
export async function listSubCustomers(ctx: PortalContext): Promise<SubCustomerRow[]> {
  const rows = await db.company.findMany({
    where: { parentId: ctx.root.id },
    select: {
      id: true,
      name: true,
      street: true,
      zip: true,
      city: true,
      active: true,
      _count: {
        select: {
          users: { where: { active: true, role: { in: [...CUSTOMER_ROLES] } } },
          tickets: { where: { status: { in: [...OPEN_STATUSES] } } },
        },
      },
    },
  });
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      street: r.street,
      zip: r.zip,
      city: r.city,
      active: r.active,
      activeUsers: r._count.users,
      openTickets: r._count.tickets,
    }))
    .sort((a, b) => compareNames(a.name, b.name));
}

/** Die letzten Tickets einer Firma im Sichtbereich des Benutzers (nur kundentaugliche Felder). */
export async function recentTicketsOf(ctx: PortalContext, companyId: string, take = 5) {
  const where: Prisma.TicketWhereInput = { AND: [portalTicketWhere(ctx), { companyId }] };
  const [tickets, total, open] = await Promise.all([
    db.ticket.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take,
      select: {
        id: true,
        subject: true,
        status: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    db.ticket.count({ where }),
    db.ticket.count({ where: { AND: [where, { status: { in: [...OPEN_STATUSES] } }] } }),
  ]);
  return { tickets, total, open };
}

/* ------------------------------------------------------------------ */
/* Benutzer                                                            */
/* ------------------------------------------------------------------ */

const portalUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  position: true,
  role: true,
  active: true,
  companyId: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PortalUserRow = Omit<Prisma.UserGetPayload<{ select: typeof portalUserSelect }>, "role" | "companyId"> & {
  role: PortalRole;
  companyId: string;
  /** Passwort noch nicht festgelegt */
  invited: boolean;
};

/**
 * IDs der Benutzer, die ihre Einladung noch nicht angenommen haben.
 * Eigene Abfrage, damit Passwort-Hashes nie in Seitendaten landen.
 */
async function invitedIds(where: Prisma.UserWhereInput): Promise<Set<string>> {
  const rows = await db.user.findMany({ where: { AND: [where, { passwordHash: null }] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

function toRow(
  user: Prisma.UserGetPayload<{ select: typeof portalUserSelect }>,
  invited: Set<string>,
): PortalUserRow | null {
  if (!user.companyId || (user.role !== "CUSTOMER_ADMIN" && user.role !== "CUSTOMER_USER")) return null;
  return { ...user, role: user.role, companyId: user.companyId, invited: invited.has(user.id) };
}

/** Alle Benutzer, die der Hauptansprechpartner verwalten darf (optional eingeschränkt). */
export async function listManageableUsers(ctx: PortalContext, extra?: Prisma.UserWhereInput): Promise<PortalUserRow[]> {
  const where: Prisma.UserWhereInput = extra ? { AND: [portalManageableUserWhere(ctx), extra] } : portalManageableUserWhere(ctx);
  const [users, invited] = await Promise.all([
    db.user.findMany({ where, select: portalUserSelect }),
    invitedIds(where),
  ]);
  return users
    .map((u) => toRow(u, invited))
    .filter((u): u is PortalUserRow => u !== null)
    .sort((a, b) => {
      // Hauptansprechpartner zuerst, dann alphabetisch
      if (a.role !== b.role) return a.role === "CUSTOMER_ADMIN" ? -1 : 1;
      return compareNames(a.name, b.name);
    });
}

/** Anzahl der Tickets, die ein Benutzer erstellt hat (nur im Sichtbereich des Betrachters). */
export async function ticketCountsOf(ctx: PortalContext, userId: string) {
  const where: Prisma.TicketWhereInput = { AND: [portalTicketWhere(ctx), { createdById: userId }] };
  const [total, open] = await Promise.all([
    db.ticket.count({ where }),
    db.ticket.count({ where: { AND: [where, { status: { in: [...OPEN_STATUSES] } }] } }),
  ]);
  return { total, open };
}

/** Ein Benutzer im Verwaltungsbereich oder null. */
export const getManageableUser = cache(async (ctx: PortalContext, id: string): Promise<PortalUserRow | null> => {
  const where: Prisma.UserWhereInput = { AND: [portalManageableUserWhere(ctx), { id }] };
  const [user, invited] = await Promise.all([
    db.user.findFirst({ where, select: portalUserSelect }),
    invitedIds(where),
  ]);
  return user ? toRow(user, invited) : null;
});

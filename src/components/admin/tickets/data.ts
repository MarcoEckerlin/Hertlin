import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { CUSTOMER_ROLES, STAFF_ROLES } from "@/lib/constants";
import { parseTicketNumber } from "@/lib/format";
import { PRIVATE_CUSTOMER, VIEW_STATUSES, type TicketListFilters, type TicketSort } from "@/components/admin/tickets/filters";

/**
 * Abfragen für die Ticketseiten der Verwaltung.
 * Aufrufer prüfen vorher die Anmeldung (requireStaff). Kosten sind hier bewusst NICHT enthalten –
 * sie werden nur für Administratoren separat geladen (siehe loadTicketCosts / loadCostSums).
 */

/* ------------------------------------------------------------------ */
/* Listen                                                              */
/* ------------------------------------------------------------------ */

export const staffTicketRowSelect = {
  id: true,
  subject: true,
  type: true,
  category: true,
  priority: true,
  status: true,
  source: true,
  createdAt: true,
  updatedAt: true,
  contactName: true,
  company: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.TicketSelect;

export type StaffTicketRow = Prisma.TicketGetPayload<{ select: typeof staffTicketRowSelect }>;

type CustomerRef = {
  company: { name: string; parent: { name: string } | null } | null;
  contactName: string | null;
};

/** „Firmenkunde › Unterkunde“, „Firmenkunde“ oder „Privat: Name“ */
export function customerLabel(ticket: CustomerRef): string {
  if (ticket.company) {
    return ticket.company.parent ? `${ticket.company.parent.name} › ${ticket.company.name}` : ticket.company.name;
  }
  return `Privat: ${ticket.contactName?.trim() || "ohne Namen"}`;
}

/** Bedingung für die Ticketliste aus den Filtern. userId: der angemeldete Mitarbeiter (für „mir zugewiesen“). */
export function ticketListWhere(filters: TicketListFilters, userId: string): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [];

  if (filters.status) and.push({ status: filters.status });
  else if (filters.ansicht !== "alle") and.push({ status: { in: [...VIEW_STATUSES[filters.ansicht]] } });

  if (filters.prioritaet) and.push({ priority: filters.prioritaet });
  if (filters.art) and.push({ type: filters.art });

  if (filters.bearbeiter === "mir") and.push({ assigneeId: userId });
  else if (filters.bearbeiter === "keiner") and.push({ assigneeId: null });
  else if (filters.bearbeiter) and.push({ assigneeId: filters.bearbeiter });

  if (filters.kunde === PRIVATE_CUSTOMER) and.push({ companyId: null });
  else if (filters.kunde) {
    // Firmenkunde inklusive aller Unterkunden; bei einer Unterkunde nur diese
    and.push({ OR: [{ companyId: filters.kunde }, { company: { parentId: filters.kunde } }] });
  }

  const q = filters.suche.trim();
  if (q) {
    const number = parseTicketNumber(q);
    const or: Prisma.TicketWhereInput[] = [
      { subject: { contains: q } },
      { contactName: { contains: q } },
      { contactEmail: { contains: q } },
      { createdBy: { is: { name: { contains: q } } } },
      { createdBy: { is: { email: { contains: q } } } },
      { company: { is: { name: { contains: q } } } },
      { company: { is: { parent: { is: { name: { contains: q } } } } } },
    ];
    if (number) or.unshift({ id: number });
    and.push({ OR: or });
  }

  return and.length > 0 ? { AND: and } : {};
}

/** Reihenfolge „Dringende zuerst“: kritisch, hoch, dann der Rest – jeweils zuletzt aktualisiert oben. */
const PRIORITY_GROUPS: string[][] = [["CRITICAL"], ["HIGH"], ["NORMAL", "LOW"]];

export type TicketPage<T> = { rows: T[]; total: number; page: number; pageCount: number };

/**
 * Eine Seite Tickets. Die Sortierung nach Dringlichkeit geht über mehrere Abfragen,
 * weil die Priorität als Text gespeichert ist und sich nicht direkt sinnvoll sortieren lässt.
 */
export async function findTicketPage<S extends Prisma.TicketSelect>(opts: {
  where: Prisma.TicketWhereInput;
  sort: TicketSort;
  page: number;
  pageSize: number;
  select: S;
}): Promise<TicketPage<Prisma.TicketGetPayload<{ select: S }>>> {
  const { where, sort, pageSize, select } = opts;

  if (sort !== "dringlichkeit") {
    const total = await db.ticket.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(opts.page, pageCount);
    const rows = await db.ticket.findMany({
      where,
      orderBy: sort === "neu" ? [{ createdAt: "desc" }, { id: "desc" }] : [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select,
    });
    return { rows: rows as Prisma.TicketGetPayload<{ select: S }>[], total, page, pageCount };
  }

  const groupWhere = (priorities: string[]): Prisma.TicketWhereInput => ({ AND: [where, { priority: { in: priorities } }] });
  const counts = await Promise.all(PRIORITY_GROUPS.map((g) => db.ticket.count({ where: groupWhere(g) })));
  const total = counts.reduce((sum, c) => sum + c, 0);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(opts.page, pageCount);

  let skip = (page - 1) * pageSize;
  let take = pageSize;
  const rows: Prisma.TicketGetPayload<{ select: S }>[] = [];
  for (let i = 0; i < PRIORITY_GROUPS.length && take > 0; i++) {
    if (skip >= counts[i]) {
      skip -= counts[i];
      continue;
    }
    const part = await db.ticket.findMany({
      where: groupWhere(PRIORITY_GROUPS[i]),
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select,
    });
    rows.push(...(part as Prisma.TicketGetPayload<{ select: S }>[]));
    take -= part.length;
    skip = 0;
  }
  return { rows, total, page, pageCount };
}

/**
 * Kostensummen je Ticket – NUR für Administratoren aufrufen.
 * Ergebnis: Ticket-ID -> { total, open } in Cent.
 */
export async function loadCostSums(ticketIds: number[]): Promise<Map<number, { total: number; open: number }>> {
  const map = new Map<number, { total: number; open: number }>();
  if (ticketIds.length === 0) return map;
  const groups = await db.costEntry.groupBy({
    by: ["ticketId", "billed"],
    where: { ticketId: { in: ticketIds } },
    _sum: { totalCents: true },
  });
  for (const g of groups) {
    const entry = map.get(g.ticketId) ?? { total: 0, open: 0 };
    const sum = g._sum.totalCents ?? 0;
    entry.total += sum;
    if (!g.billed) entry.open += sum;
    map.set(g.ticketId, entry);
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* Auswahllisten                                                       */
/* ------------------------------------------------------------------ */

export type StaffOption = { id: string; name: string; role: string; active: boolean };

/**
 * Hertlin-Mitarbeiter für „Bearbeiter“.
 * includeId: auch einen inzwischen deaktivierten Bearbeiter aufführen (z. B. den aktuell eingetragenen).
 * includeInactive: alle, auch deaktivierte (für Filter über alte Tickets).
 */
export async function loadStaffOptions(opts: { includeId?: string | null; includeInactive?: boolean } = {}): Promise<StaffOption[]> {
  return db.user.findMany({
    where: {
      role: { in: [...STAFF_ROLES] },
      ...(opts.includeInactive ? {} : { OR: [{ active: true }, ...(opts.includeId ? [{ id: opts.includeId }] : [])] }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, active: true },
  });
}

export type ContactUserOption = { id: string; name: string; email: string; phone: string | null; role: string };

export type CustomerChildOption = { id: string; name: string; active: boolean; users: ContactUserOption[] };

export type CustomerGroupOption = {
  id: string;
  name: string;
  active: boolean;
  users: ContactUserOption[];
  children: CustomerChildOption[];
};

const contactUserSelect = {
  where: { active: true, role: { in: [...CUSTOMER_ROLES] } },
  orderBy: { name: "asc" },
  select: { id: true, name: true, email: true, phone: true, role: true },
} satisfies Prisma.Company$usersArgs;

/**
 * Firmenkunden mit ihren Unterkunden, alphabetisch.
 * activeOnly: nur aktive (für neue Tickets/Zuordnung); withUsers: aktive Kundenbenutzer je Firma mitladen.
 */
export async function loadCustomerGroups(opts: { activeOnly: boolean; withUsers: boolean }): Promise<CustomerGroupOption[]> {
  const activeWhere = opts.activeOnly ? { active: true } : {};
  const companies = await db.company.findMany({
    where: { parentId: null, ...activeWhere },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      active: true,
      users: opts.withUsers ? contactUserSelect : false,
      children: {
        where: activeWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true, active: true, users: opts.withUsers ? contactUserSelect : false },
      },
    },
  });
  return companies.map((c) => ({
    id: c.id,
    name: c.name,
    active: c.active,
    users: c.users ?? [],
    children: c.children.map((child) => ({ id: child.id, name: child.name, active: child.active, users: child.users ?? [] })),
  }));
}

/* ------------------------------------------------------------------ */
/* Ticketdetail                                                        */
/* ------------------------------------------------------------------ */

/** Alles, was die Verwaltung zum Ticket braucht – inklusive interner Notizen, OHNE Kosten. */
export const staffTicketDetailSelect = {
  id: true,
  subject: true,
  type: true,
  category: true,
  priority: true,
  status: true,
  source: true,
  companyId: true,
  createdById: true,
  assigneeId: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  contactAddress: true,
  contactLanguage: true,
  guestToken: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      parentId: true,
      parent: { select: { id: true, name: true, slug: true, active: true } },
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      position: true,
      role: true,
      active: true,
      company: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
    },
  },
  assignee: { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      fromStaff: true,
      internal: true,
      authorId: true,
      authorName: true,
      createdAt: true,
      author: { select: { name: true, role: true } },
      attachments: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, size: true } },
    },
  },
  events: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      fromValue: true,
      toValue: true,
      createdAt: true,
      actorId: true,
      actor: { select: { name: true, role: true } },
    },
  },
  phoneCalls: {
    orderBy: { startedAt: "desc" },
    take: 10,
    select: { id: true, direction: true, status: true, fromNumber: true, toNumber: true, startedAt: true },
  },
} satisfies Prisma.TicketSelect;

export type StaffTicketDetail = Prisma.TicketGetPayload<{ select: typeof staffTicketDetailSelect }>;
export type StaffTicketMessage = StaffTicketDetail["messages"][number];
export type StaffTicketEvent = StaffTicketDetail["events"][number];

/** Ticket-ID aus URL oder Formular: nur positive ganze Zahlen (auch „T-00042“). */
export function parseTicketIdParam(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  if (/^\d{1,9}$/.test(value)) {
    const id = Number(value);
    return id > 0 ? id : null;
  }
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const id = parseTicketNumber(decoded);
  return id && id > 0 ? id : null;
}

/* ------------------------------------------------------------------ */
/* Kosten (NUR Administratoren)                                        */
/* ------------------------------------------------------------------ */

export const costEntrySelect = {
  id: true,
  ticketId: true,
  kind: true,
  description: true,
  quantityHundredths: true,
  unit: true,
  unitPriceCents: true,
  totalCents: true,
  performedAt: true,
  billed: true,
  billedAt: true,
  createdAt: true,
  createdBy: { select: { name: true } },
} satisfies Prisma.CostEntrySelect;

export type CostEntryRow = Prisma.CostEntryGetPayload<{ select: typeof costEntrySelect }>;

/** Kostenpositionen eines Tickets – nur nach requireAdmin() bzw. Rollenprüfung aufrufen. */
export async function loadTicketCosts(ticketId: number): Promise<CostEntryRow[]> {
  return db.costEntry.findMany({
    where: { ticketId },
    orderBy: [{ performedAt: "asc" }, { createdAt: "asc" }],
    select: costEntrySelect,
  });
}

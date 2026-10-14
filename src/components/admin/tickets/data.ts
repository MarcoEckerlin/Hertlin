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
  locationId: true,
  location: { select: { id: true, name: true, city: true, active: true } },
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
      /** Sprache, in der der Kunde Nachrichten liest (Übersetzung im Kundenportal) */
      language: true,
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
    select: {
      id: true,
      direction: true,
      status: true,
      fromNumber: true,
      toNumber: true,
      callerLabel: true,
      answeredBy: true,
      startedAt: true,
      answeredAt: true,
      handledAt: true,
    },
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
/* Leistungen und Material (Kostenpositionen)                          */
/* ------------------------------------------------------------------ */

/**
 * Was alle Mitarbeiter von einer Position sehen: Datum, Art, Beschreibung, Menge, wer sie erbracht hat
 * und ob sie abgerechnet ist. KEINE Preise, Summen oder Rechnungsdaten – die stehen nur in costEntrySelect.
 */
export const staffCostEntrySelect = {
  id: true,
  ticketId: true,
  kind: true,
  description: true,
  quantityHundredths: true,
  unit: true,
  performedAt: true,
  billed: true,
  invoiceId: true,
  presetId: true,
  createdAt: true,
  createdById: true,
  createdBy: { select: { id: true, name: true } },
  performedBy: { select: { id: true, name: true } },
} satisfies Prisma.CostEntrySelect;

export type StaffCostEntryRow = Prisma.CostEntryGetPayload<{ select: typeof staffCostEntrySelect }>;

/** Wie staffCostEntrySelect, zusätzlich Preise und Abrechnung – NUR für Administratoren. */
export const costEntrySelect = {
  ...staffCostEntrySelect,
  unitPriceCents: true,
  totalCents: true,
  needsPrice: true,
  billedAt: true,
  invoice: { select: { id: true, number: true } },
  preset: { select: { id: true, name: true, unit: true, unitPriceCents: true } },
} satisfies Prisma.CostEntrySelect;

export type CostEntryRow = Prisma.CostEntryGetPayload<{ select: typeof costEntrySelect }>;

const costOrder = [{ performedAt: "asc" as const }, { createdAt: "asc" as const }];

/** Katalogeintrag für „Aus dem Katalog“ (Typ liegt bei den Formularwerten, damit ihn auch der Browser kennt) */
type PresetOption = import("@/components/admin/tickets/cost-values").PresetOption;

/** Positionen eines Tickets ohne Beträge – für alle Mitarbeiter (canRecordCosts). */
export async function loadTicketCostsForStaff(ticketId: number): Promise<StaffCostEntryRow[]> {
  return db.costEntry.findMany({ where: { ticketId }, orderBy: costOrder, select: staffCostEntrySelect });
}

/** Positionen eines Tickets mit Beträgen – nur nach requireAdmin() bzw. canSeeCostAmounts() aufrufen. */
export async function loadTicketCosts(ticketId: number): Promise<CostEntryRow[]> {
  return db.costEntry.findMany({ where: { ticketId }, orderBy: costOrder, select: costEntrySelect });
}

/**
 * Aktive Katalogeinträge für „Aus dem Katalog“. Für Techniker wird der Preis gar nicht erst geladen,
 * damit er auch nicht in den Daten der Seite landet.
 */
export async function loadPresetOptions(opts: { withPrices: boolean }): Promise<PresetOption[]> {
  const presets = await db.costPreset.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      kind: true,
      name: true,
      unit: true,
      defaultQuantityHundredths: true,
      usageCount: true,
      lastUsedAt: true,
      sortOrder: true,
      unitPriceCents: opts.withPrices,
    },
  });
  return presets.map((p) => {
    const option: PresetOption = {
      id: p.id,
      kind: p.kind,
      name: p.name,
      unit: p.unit,
      defaultQuantityHundredths: p.defaultQuantityHundredths,
      usageCount: p.usageCount,
      lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
      sortOrder: p.sortOrder,
    };
    if (opts.withPrices) option.unitPriceCents = p.unitPriceCents ?? null;
    return option;
  });
}

/* ------------------------------------------------------------------ */
/* Standort neuer Tickets                                              */
/* ------------------------------------------------------------------ */

/**
 * Vorgabe für den Standort eines neuen Tickets:
 * Firma → deren Standort, bei einer Unterkunde ohne eigenen Standort der des Firmenkunden;
 * Privatkunde (companyId null) → Hauptsitz. Nur aktive Standorte, sonst null.
 */
export async function defaultTicketLocationId(companyId: string | null): Promise<string | null> {
  if (!companyId) {
    const main = await db.location.findFirst({
      where: { isMain: true, active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    return main?.id ?? null;
  }
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      location: { select: { id: true, active: true } },
      parent: { select: { location: { select: { id: true, active: true } } } },
    },
  });
  if (!company) return null;
  if (company.location?.active) return company.location.id;
  if (company.parent?.location?.active) return company.parent.location.id;
  return null;
}

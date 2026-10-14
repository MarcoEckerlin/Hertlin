import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { dateFromInput } from "@/lib/invoices/calc";

/**
 * Abfragen für die Rechnungsliste (Verwaltung) und die Rechnungen im Kundenportal.
 */

/* ------------------------------------------------------------------ */
/* Filter der Rechnungsliste                                           */
/* ------------------------------------------------------------------ */

export const INVOICE_LIST_FILTERS = [
  { value: "alle", label: "Alle" },
  { value: "unbezahlt", label: "Unbezahlt" },
  { value: "ueberfaellig", label: "Überfällig" },
  { value: "nicht-versendet", label: "Noch nicht versendet" },
  { value: "bezahlt", label: "Bezahlt" },
  { value: "storniert", label: "Storniert" },
  { value: "storno", label: "Stornorechnungen" },
] as const;

export type InvoiceListStatus = (typeof INVOICE_LIST_FILTERS)[number]["value"];

export type InvoiceListFilter = {
  status: InvoiceListStatus;
  year: number | null;
  query: string;
  /** Kunde (Firmenkunde inkl. Unterkunden bzw. Unterkunde) */
  companyId: string | null;
  page: number;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

export function parseInvoiceListFilter(sp: SearchParams): InvoiceListFilter {
  const statusParam = first(sp.status);
  const status = (INVOICE_LIST_FILTERS.some((f) => f.value === statusParam) ? statusParam : "alle") as InvoiceListStatus;
  const yearParam = first(sp.jahr);
  const year = /^\d{4}$/.test(yearParam) && Number(yearParam) >= 2000 && Number(yearParam) <= 2100 ? Number(yearParam) : null;
  const kunde = first(sp.kunde);
  const page = Number(first(sp.seite));
  return {
    status,
    year,
    query: first(sp.q).slice(0, 100),
    companyId: /^[a-zA-Z0-9_-]{1,64}$/.test(kunde) ? kunde : null,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Query-Parameter für Links (Standardwerte weggelassen) */
export function invoiceListParams(filter: InvoiceListFilter, overrides: Partial<InvoiceListFilter> = {}): Record<string, string> {
  const f = { ...filter, ...overrides };
  const params: Record<string, string> = {};
  if (f.status !== "alle") params.status = f.status;
  if (f.year) params.jahr = String(f.year);
  if (f.query) params.q = f.query;
  if (f.companyId) params.kunde = f.companyId;
  if (f.page > 1) params.seite = String(f.page);
  return params;
}

/** Beginn des heutigen Kalendertags (12:00 UTC, wie die gespeicherten Fälligkeitsdaten) */
function todayMarker(now: Date = new Date()): Date {
  return dateFromInput(toDateInput(now));
}

const UNPAID: Prisma.InvoiceWhereInput = { kind: "INVOICE", status: { in: ["OPEN", "SENT"] } };

function statusWhere(status: InvoiceListStatus, now: Date): Prisma.InvoiceWhereInput {
  switch (status) {
    case "alle":
      return {};
    case "unbezahlt":
      return UNPAID;
    case "ueberfaellig":
      return { ...UNPAID, dueDate: { lt: todayMarker(now) } };
    case "nicht-versendet":
      return { status: "OPEN", sentAt: null };
    case "bezahlt":
      return { status: "PAID" };
    case "storniert":
      return { status: "CANCELLED" };
    case "storno":
      return { kind: "CANCELLATION" };
  }
}

async function companyScope(companyId: string): Promise<string[]> {
  const children = await db.company.findMany({ where: { parentId: companyId }, select: { id: true } });
  return [companyId, ...children.map((c) => c.id)];
}

export const invoiceRowSelect = {
  id: true,
  number: true,
  kind: true,
  status: true,
  issueDate: true,
  dueDate: true,
  grossCents: true,
  recipientName: true,
  recipientEmail: true,
  companyId: true,
  privateEmail: true,
  sentAt: true,
  paidAt: true,
  cancelsInvoice: { select: { id: true, number: true } },
  cancelledBy: { select: { id: true, number: true } },
} satisfies Prisma.InvoiceSelect;

export type InvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceRowSelect }>;

export const INVOICE_PAGE_SIZE = 25;

export async function listInvoices(filter: InvoiceListFilter, now: Date = new Date()) {
  const and: Prisma.InvoiceWhereInput[] = [statusWhere(filter.status, now)];
  if (filter.year) and.push({ year: filter.year });
  if (filter.companyId) and.push({ companyId: { in: await companyScope(filter.companyId) } });
  if (filter.query) {
    const q = filter.query;
    and.push({
      OR: [
        { number: { contains: q } },
        { recipientName: { contains: q } },
        { recipientEmail: { contains: q.toLowerCase() } },
        { privateEmail: { contains: q.toLowerCase() } },
      ],
    });
  }
  const where: Prisma.InvoiceWhereInput = { AND: and };

  const [total, rows] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: [{ year: "desc" }, { sequence: "desc" }],
      skip: (filter.page - 1) * INVOICE_PAGE_SIZE,
      take: INVOICE_PAGE_SIZE,
      select: invoiceRowSelect,
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE)) };
}

/** Offene (unbezahlte) Beträge, davon überfällig – unabhängig vom Filter. */
export async function unpaidTotals(now: Date = new Date(), companyIds?: string[]) {
  const scope: Prisma.InvoiceWhereInput = companyIds ? { companyId: { in: companyIds } } : {};
  const [open, overdue] = await Promise.all([
    db.invoice.aggregate({ where: { ...UNPAID, ...scope }, _sum: { grossCents: true }, _count: { _all: true } }),
    db.invoice.aggregate({
      where: { ...UNPAID, ...scope, dueDate: { lt: todayMarker(now) } },
      _sum: { grossCents: true },
      _count: { _all: true },
    }),
  ]);
  return {
    openCents: open._sum.grossCents ?? 0,
    openCount: open._count._all,
    overdueCents: overdue._sum.grossCents ?? 0,
    overdueCount: overdue._count._all,
  };
}

/** Jahre, in denen es Rechnungen gibt (neueste zuerst) */
export async function invoiceYears(): Promise<number[]> {
  const rows = await db.invoice.findMany({ distinct: ["year"], select: { year: true }, orderBy: { year: "desc" } });
  return rows.map((r) => r.year);
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

export async function getInvoiceDetail(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { position: "asc" } },
      company: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      cancelsInvoice: { select: { id: true, number: true, issueDate: true } },
      cancelledBy: { select: { id: true, number: true, issueDate: true } },
      createdBy: { select: { name: true } },
    },
  });
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;

/* ------------------------------------------------------------------ */
/* Kundenportal                                                        */
/* ------------------------------------------------------------------ */

/**
 * Rechnungen, die ein Hauptansprechpartner im Portal sieht: Rechnungen seiner Firma (beim Firmenkunden inkl.
 * Unterkunden), sobald sie versendet oder bezahlt sind. Noch nicht versendete Rechnungen bleiben intern.
 */
export function portalInvoiceWhere(companyIds: string[]): Prisma.InvoiceWhereInput {
  return {
    companyId: { in: companyIds },
    OR: [{ sentAt: { not: null } }, { paidAt: { not: null } }],
  };
}

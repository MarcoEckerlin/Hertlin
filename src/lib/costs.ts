import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import { formatTicketNumber } from "@/lib/format";

/**
 * Kostenübersicht pro Konto – ausschließlich für Administratoren.
 * Aufrufer prüfen vorher requireAdmin() bzw. die Rolle ADMIN.
 *
 * Konto = Firmenkunde (inkl. aller Unterkunden) oder Privatkunde (zusammengefasst über die E-Mail-Adresse).
 * Zeiträume beziehen sich auf das Leistungsdatum (performedAt) in deutscher Zeit.
 */

const TZ = "Europe/Berlin";

/* ------------------------------------------------------------------ */
/* Filter: Zeitraum und Abrechnungsstand                               */
/* ------------------------------------------------------------------ */

export const BILLING_FILTERS = ["offen", "abgerechnet", "alle"] as const;
export type BillingFilter = (typeof BILLING_FILTERS)[number];

export const BILLING_FILTER_LABELS: Record<BillingFilter, string> = {
  offen: "Noch nicht abgerechnet",
  abgerechnet: "Abgerechnet",
  alle: "Alle Positionen",
};

export type PeriodFilter =
  | { kind: "all" }
  | { kind: "month"; year: number; month: number }
  | { kind: "year"; year: number }
  /** Datumsangaben YYYY-MM-DD, jeweils einschließlich */
  | { kind: "range"; from: string | null; to: string | null };

export type CostFilter = { period: PeriodFilter; billing: BillingFilter };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

function validYear(year: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 2100;
}

/** "2026-03-31" → gültig? (prüft auch, ob es den Tag gibt) */
function validDateInput(value: string): boolean {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!validYear(y) || mo < 1 || mo > 12 || d < 1) return false;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Liest Zeitraum und Abrechnungsstand aus den Query-Parametern (zeitraum, von, bis, abrechnung). */
export function parseCostFilter(sp: SearchParams): CostFilter {
  const billingParam = first(sp.abrechnung);
  const billing: BillingFilter = (BILLING_FILTERS as readonly string[]).includes(billingParam)
    ? (billingParam as BillingFilter)
    : "offen";

  const zeitraum = first(sp.zeitraum);
  const von = first(sp.von);
  const bis = first(sp.bis);

  let period: PeriodFilter = { kind: "all" };
  const month = zeitraum.match(/^(\d{4})-(\d{2})$/);
  const year = zeitraum.match(/^(\d{4})$/);
  if (month && validYear(Number(month[1])) && Number(month[2]) >= 1 && Number(month[2]) <= 12) {
    period = { kind: "month", year: Number(month[1]), month: Number(month[2]) };
  } else if (year && validYear(Number(year[1]))) {
    period = { kind: "year", year: Number(year[1]) };
  } else if (zeitraum === "frei" || (!zeitraum && (von || bis))) {
    let from = validDateInput(von) ? von : null;
    let to = validDateInput(bis) ? bis : null;
    if (from && to && from > to) [from, to] = [to, from];
    if (from || to) period = { kind: "range", from, to };
  }

  return { period, billing };
}

/** Query-Parameter für Links, die den Filter beibehalten sollen (Standardwerte werden weggelassen). */
export function costFilterParams(filter: CostFilter): Record<string, string> {
  const params: Record<string, string> = {};
  const p = filter.period;
  if (p.kind === "month") params.zeitraum = `${p.year}-${String(p.month).padStart(2, "0")}`;
  if (p.kind === "year") params.zeitraum = String(p.year);
  if (p.kind === "range") {
    params.zeitraum = "frei";
    if (p.from) params.von = p.from;
    if (p.to) params.bis = p.to;
  }
  if (filter.billing !== "offen") params.abrechnung = filter.billing;
  return params;
}

/** Pfad mit Filter-Query, z. B. für Drilldown- und Export-Links. */
export function withCostFilter(path: string, filter: CostFilter, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ ...extra, ...costFilterParams(filter) }).toString();
  return q ? `${path}?${q}` : path;
}

/* ---------- Zeitzone ---------- */

/** Abstand der deutschen Zeit zu UTC in Minuten zum Zeitpunkt at (Sommerzeit berücksichtigt). */
function berlinOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Zeitpunkt 0:00 Uhr deutscher Zeit am angegebenen Tag (Monat 1–12, Überlauf erlaubt, z. B. Monat 13). */
function berlinMidnight(year: number, month: number, day: number): Date {
  const utc = Date.UTC(year, month - 1, day);
  const guess = new Date(utc - berlinOffsetMinutes(new Date(utc)) * 60000);
  return new Date(utc - berlinOffsetMinutes(guess) * 60000);
}

function splitDate(value: string): [number, number, number] {
  const [y, m, d] = value.split("-").map(Number);
  return [y, m, d];
}

/** Jahr und Monat (1–12) in deutscher Zeit. */
export function berlinYearMonth(date: Date = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}

/** Grenzen des Zeitraums für performedAt: gte (einschließlich) und lt (ausschließlich). */
export function periodBounds(period: PeriodFilter): { gte?: Date; lt?: Date } {
  switch (period.kind) {
    case "all":
      return {};
    case "month":
      return { gte: berlinMidnight(period.year, period.month, 1), lt: berlinMidnight(period.year, period.month + 1, 1) };
    case "year":
      return { gte: berlinMidnight(period.year, 1, 1), lt: berlinMidnight(period.year + 1, 1, 1) };
    case "range": {
      const bounds: { gte?: Date; lt?: Date } = {};
      if (period.from) bounds.gte = berlinMidnight(...splitDate(period.from));
      if (period.to) {
        const [y, m, d] = splitDate(period.to);
        bounds.lt = berlinMidnight(y, m, d + 1);
      }
      return bounds;
    }
  }
}

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function germanDate(value: string): string {
  const [y, m, d] = splitDate(value);
  return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`;
}

/** Lesbare Bezeichnung, z. B. „Oktober 2026“, „Jahr 2026“, „01.01.2026 – 31.03.2026“. */
export function periodLabel(period: PeriodFilter): string {
  switch (period.kind) {
    case "all":
      return "Gesamter Zeitraum";
    case "month":
      return `${MONTH_NAMES[period.month - 1]} ${period.year}`;
    case "year":
      return `Jahr ${period.year}`;
    case "range":
      if (period.from && period.to) return `${germanDate(period.from)} – ${germanDate(period.to)}`;
      if (period.from) return `ab ${germanDate(period.from)}`;
      return `bis ${germanDate(period.to ?? "")}`;
  }
}

/** Teil des Dateinamens beim Export, z. B. „2026-10“, „2026“, „alle“, „2026-01-01-bis-2026-03-31“. */
export function periodFileSlug(period: PeriodFilter): string {
  switch (period.kind) {
    case "all":
      return "alle";
    case "month":
      return `${period.year}-${String(period.month).padStart(2, "0")}`;
    case "year":
      return String(period.year);
    case "range":
      if (period.from && period.to) return `${period.from}-bis-${period.to}`;
      if (period.from) return `ab-${period.from}`;
      return `bis-${period.to ?? ""}`;
  }
}

export type PeriodOption = { value: string; label: string };

/** Auswahl für den Zeitraum-Filter: Jahre und die letzten 24 Monate (neueste zuerst). */
export function periodOptions(now: Date = new Date()): { years: PeriodOption[]; months: PeriodOption[] } {
  const { year, month } = berlinYearMonth(now);
  const months: PeriodOption[] = [];
  for (let i = 0; i < 24; i++) {
    const total = year * 12 + (month - 1) - i;
    const y = Math.floor(total / 12);
    const m = (total % 12) + 1;
    const value = `${y}-${String(m).padStart(2, "0")}`;
    const label = `${MONTH_NAMES[m - 1]} ${y}${i === 0 ? " (laufend)" : ""}`;
    months.push({ value, label });
  }
  return {
    years: [
      { value: String(year), label: `Dieses Jahr (${year})` },
      { value: String(year - 1), label: `Letztes Jahr (${year - 1})` },
    ],
    months,
  };
}

/** Wert des Zeitraum-Feldes im Filterformular. */
export function periodSelectValue(period: PeriodFilter): string {
  switch (period.kind) {
    case "all":
      return "alle";
    case "range":
      return "frei";
    default:
      return costFilterParams({ period, billing: "offen" }).zeitraum ?? "alle";
  }
}

/** Werte für das Filterformular (Auswahlfelder, eigener Zeitraum, ältere Zeiträume aus der Adresse). */
export function costFilterFormProps(filter: CostFilter, now: Date = new Date()) {
  const { years, months } = periodOptions(now);
  const period = periodSelectValue(filter.period);
  const listed = period === "alle" || period === "frei" || [...years, ...months].some((o) => o.value === period);
  return {
    period,
    from: filter.period.kind === "range" ? (filter.period.from ?? "") : "",
    to: filter.period.kind === "range" ? (filter.period.to ?? "") : "",
    billing: filter.billing,
    years,
    months,
    extraOption: listed ? null : { value: period, label: periodLabel(filter.period) },
  };
}

/* ------------------------------------------------------------------ */
/* Konten                                                              */
/* ------------------------------------------------------------------ */

/**
 * company: Firmenkunde (Wurzel) inkl. aller Unterkunden
 * private: Privatkunde, zusammengefasst über die E-Mail-Adresse (klein geschrieben)
 * ticket:  einzelnes Privatkunden-Ticket ohne E-Mail-Adresse
 */
export type CostAccount =
  | { kind: "company"; companyId: string }
  | { kind: "private"; email: string }
  | { kind: "ticket"; ticketId: number };

export type ResolvedCostAccount = {
  account: CostAccount;
  label: string;
  sublabel: string | null;
  /** Firmenkunde: Firmen-IDs (Wurzel + Unterkunden) */
  companyIds: string[];
  /** Firmenkunde: Unterkunden mit eigener Rechnung (eigener Rechnungsempfänger) */
  separateSubs: { id: string; name: string }[];
  ticketWhere: Prisma.TicketWhereInput;
  /** Für den Export-Dateinamen */
  fileSlug: string;
};

/** Link auf die Positionen eines Kontos, optional mit Filter. */
export function costAccountHref(account: CostAccount, filter?: CostFilter): string {
  const path = account.kind === "company" ? `/admin/kosten/konto/${account.companyId}` : "/admin/kosten/privat";
  const extra = account.kind === "company" ? {} : costAccountParams(account);
  if (filter) return withCostFilter(path, filter, extra);
  const q = new URLSearchParams(extra).toString();
  return q ? `${path}?${q}` : path;
}

/** Kennung des Kontos als Formular- bzw. Query-Felder (konto | email | ticket). */
export function costAccountParams(account: CostAccount): Record<string, string> {
  switch (account.kind) {
    case "company":
      return { konto: account.companyId };
    case "private":
      return { email: account.email };
    case "ticket":
      return { ticket: String(account.ticketId) };
  }
}

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

/** Konto aus Query-Parametern bzw. Formularfeldern (konto, email, ticket). Ungültig oder leer: null. */
export function parseCostAccount(get: (key: string) => string): CostAccount | null {
  const konto = get("konto").trim();
  if (konto) return ID_PATTERN.test(konto) ? { kind: "company", companyId: konto } : null;
  const email = get("email").trim().toLowerCase();
  if (email) return email.length <= 200 && email.includes("@") ? { kind: "private", email } : null;
  const ticket = get("ticket").trim();
  if (ticket) return /^\d{1,9}$/.test(ticket) ? { kind: "ticket", ticketId: Number(ticket) } : null;
  return null;
}

function fileSlugOf(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "konto"
  );
}

/** E-Mail-Schreibweisen eines Privatkunden (SQLite vergleicht Gleichheit mit Groß/Klein). */
export async function privateEmailVariants(email: string): Promise<string[]> {
  const rows = await db.ticket.findMany({
    where: { companyId: null, contactEmail: { not: null } },
    distinct: ["contactEmail"],
    select: { contactEmail: true },
  });
  return rows.map((r) => r.contactEmail).filter((e): e is string => !!e && e.trim().toLowerCase() === email);
}

/** Prüft, ob es das Konto gibt, und liefert Bezeichnung und Ticket-Filter. */
export async function resolveCostAccount(account: CostAccount): Promise<ResolvedCostAccount | null> {
  if (account.kind === "company") {
    const company = await db.company.findFirst({
      where: { id: account.companyId, parentId: null },
      select: {
        id: true,
        name: true,
        customerNumber: true,
        children: { orderBy: { name: "asc" }, select: { id: true, name: true, invoiceSeparately: true } },
      },
    });
    if (!company) return null;
    const companyIds = [company.id, ...company.children.map((c) => c.id)];
    return {
      account,
      label: company.name,
      sublabel: company.customerNumber ? `Kundennummer ${company.customerNumber}` : null,
      companyIds,
      separateSubs: company.children.filter((c) => c.invoiceSeparately).map((c) => ({ id: c.id, name: c.name })),
      ticketWhere: { companyId: { in: companyIds } },
      fileSlug: fileSlugOf(company.name),
    };
  }

  if (account.kind === "private") {
    const variants = await privateEmailVariants(account.email);
    if (variants.length === 0) return null;
    const latest = await db.ticket.findFirst({
      where: { companyId: null, contactEmail: { in: variants } },
      orderBy: { id: "desc" },
      select: { contactName: true },
    });
    return {
      account,
      label: latest?.contactName?.trim() || account.email,
      sublabel: account.email,
      companyIds: [],
      separateSubs: [],
      ticketWhere: { companyId: null, contactEmail: { in: variants } },
      fileSlug: fileSlugOf(latest?.contactName?.trim() || account.email.split("@")[0]),
    };
  }

  const ticket = await db.ticket.findFirst({
    where: { id: account.ticketId, companyId: null },
    select: { id: true, contactName: true, contactEmail: true },
  });
  if (!ticket) return null;
  return {
    account,
    label: ticket.contactName?.trim() || `Privatkunde zu ${formatTicketNumber(ticket.id)}`,
    sublabel: ticket.contactEmail?.trim() || "ohne E-Mail-Adresse",
    companyIds: [],
    separateSubs: [],
    ticketWhere: { id: ticket.id, companyId: null },
    fileSlug: fileSlugOf(ticket.contactName?.trim() || formatTicketNumber(ticket.id)),
  };
}

/* ------------------------------------------------------------------ */
/* Summen                                                              */
/* ------------------------------------------------------------------ */

export type CostTotals = {
  entries: number;
  tickets: number;
  /** Arbeitszeit in Minuten (Positionen der Art LABOR mit Einheit Std. oder Min.) */
  laborMinutes: number;
  materialCents: number;
  totalCents: number;
  openCents: number;
  billedCents: number;
  /** Positionen ohne Preis (Techniker hat erfasst, Preis fehlt noch) – zählen erst mit Preis in den Summen */
  unpricedEntries: number;
};

function emptyTotals(): CostTotals {
  return {
    entries: 0,
    tickets: 0,
    laborMinutes: 0,
    materialCents: 0,
    totalCents: 0,
    openCents: 0,
    billedCents: 0,
    unpricedEntries: 0,
  };
}

type EntryLike = {
  kind: string;
  unit: string;
  quantityHundredths: number;
  totalCents: number;
  billed: boolean;
  needsPrice?: boolean;
};

/** Arbeitszeit einer Position in Minuten; andere Einheiten (z. B. Pauschale) zählen nicht als Zeit. */
export function laborMinutesOf(entry: Pick<EntryLike, "kind" | "unit" | "quantityHundredths">): number {
  if (entry.kind !== "LABOR") return 0;
  const unit = entry.unit.trim().toLowerCase();
  if (unit === "std." || unit === "std" || unit === "h") return (entry.quantityHundredths * 60) / 100;
  if (unit === "min." || unit === "min") return entry.quantityHundredths / 100;
  return 0;
}

class TotalsBuilder {
  totals = emptyTotals();
  private ticketIds = new Set<number>();

  add(entry: EntryLike, ticketId: number) {
    const t = this.totals;
    t.entries += 1;
    if (entry.needsPrice) t.unpricedEntries += 1;
    t.totalCents += entry.totalCents;
    if (entry.billed) t.billedCents += entry.totalCents;
    else t.openCents += entry.totalCents;
    if (entry.kind === "MATERIAL") t.materialCents += entry.totalCents;
    t.laborMinutes += laborMinutesOf(entry);
    this.ticketIds.add(ticketId);
    t.tickets = this.ticketIds.size;
  }
}

const numberHours = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 75 Minuten → "1,25" (Stunden, zwei Nachkommastellen) */
export function formatHours(minutes: number): string {
  return numberHours.format(Math.round((minutes / 60) * 100) / 100);
}

function billingWhere(billing: BillingFilter): Prisma.CostEntryWhereInput {
  if (billing === "offen") return { billed: false };
  if (billing === "abgerechnet") return { billed: true };
  return {};
}

function costWhere(filter: CostFilter, ticketWhere?: Prisma.TicketWhereInput): Prisma.CostEntryWhereInput {
  const bounds = periodBounds(filter.period);
  return {
    ...billingWhere(filter.billing),
    ...(bounds.gte || bounds.lt ? { performedAt: bounds } : {}),
    ...(ticketWhere ? { ticket: ticketWhere } : {}),
  };
}

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

/* ------------------------------------------------------------------ */
/* Übersicht pro Konto                                                 */
/* ------------------------------------------------------------------ */

export type CostBreakdownRow = { companyId: string; label: string; isRoot: boolean; totals: CostTotals };

export type CostOverviewRow = {
  key: string;
  account: CostAccount;
  label: string;
  sublabel: string | null;
  active: boolean;
  totals: CostTotals;
  /** Aufschlüsselung nach Firmenkunde/Unterkunden – nur, wenn Unterkunden Kosten haben */
  breakdown: CostBreakdownRow[];
};

export type CostOverview = {
  companies: CostOverviewRow[];
  privates: CostOverviewRow[];
  totals: CostTotals;
};

export async function getCostOverview(filter: CostFilter): Promise<CostOverview> {
  const entries = await db.costEntry.findMany({
    where: costWhere(filter),
    select: {
      kind: true,
      unit: true,
      quantityHundredths: true,
      totalCents: true,
      billed: true,
      needsPrice: true,
      ticketId: true,
      ticket: {
        select: {
          companyId: true,
          contactName: true,
          contactEmail: true,
          company: {
            select: {
              id: true,
              name: true,
              parentId: true,
              customerNumber: true,
              active: true,
              parent: { select: { id: true, name: true, customerNumber: true, active: true } },
            },
          },
        },
      },
    },
  });

  type CompanyAcc = {
    row: CostOverviewRow;
    builder: TotalsBuilder;
    parts: Map<string, { label: string; isRoot: boolean; builder: TotalsBuilder }>;
  };
  type PrivateAcc = { row: CostOverviewRow; builder: TotalsBuilder; latestTicketId: number };

  const companies = new Map<string, CompanyAcc>();
  const privates = new Map<string, PrivateAcc>();
  const all = new TotalsBuilder();

  for (const entry of entries) {
    all.add(entry, entry.ticketId);
    const { company, contactEmail, contactName } = entry.ticket;

    if (company) {
      const root = company.parent ?? company;
      let acc = companies.get(root.id);
      if (!acc) {
        acc = {
          row: {
            key: `company:${root.id}`,
            account: { kind: "company", companyId: root.id },
            label: root.name,
            sublabel: root.customerNumber,
            active: root.active,
            totals: emptyTotals(),
            breakdown: [],
          },
          builder: new TotalsBuilder(),
          parts: new Map(),
        };
        companies.set(root.id, acc);
      }
      acc.builder.add(entry, entry.ticketId);
      let part = acc.parts.get(company.id);
      if (!part) {
        part = { label: company.name, isRoot: company.parentId === null, builder: new TotalsBuilder() };
        acc.parts.set(company.id, part);
      }
      part.builder.add(entry, entry.ticketId);
      continue;
    }

    const email = privateAccountEmail(contactEmail);
    const key = email ? `private:${email}` : `ticket:${entry.ticketId}`;
    let acc = privates.get(key);
    if (!acc) {
      acc = {
        row: {
          key,
          account: email ? { kind: "private", email } : { kind: "ticket", ticketId: entry.ticketId },
          label: contactName?.trim() || email || `Privatkunde zu ${formatTicketNumber(entry.ticketId)}`,
          sublabel: email ?? "ohne E-Mail-Adresse",
          active: true,
          totals: emptyTotals(),
          breakdown: [],
        },
        builder: new TotalsBuilder(),
        // Nur Tickets mit Namen zählen, sonst verdrängt ein Ticket ohne Namen den Namen eines älteren
        latestTicketId: contactName?.trim() ? entry.ticketId : 0,
      };
      privates.set(key, acc);
    }
    // Name aus dem jüngsten Ticket (mit Namen) anzeigen, wie privateAccountLabels() für die CSV
    if (entry.ticketId > acc.latestTicketId && contactName?.trim()) {
      acc.latestTicketId = entry.ticketId;
      acc.row.label = contactName.trim();
    }
    acc.builder.add(entry, entry.ticketId);
  }

  const companyRows = [...companies.values()].map((acc) => {
    const parts = [...acc.parts.entries()];
    const hasSubCosts = parts.some(([, p]) => !p.isRoot);
    const breakdown: CostBreakdownRow[] = hasSubCosts
      ? parts
          .map(([companyId, p]) => ({ companyId, label: p.label, isRoot: p.isRoot, totals: p.builder.totals }))
          .sort((a, b) => (a.isRoot === b.isRoot ? collator.compare(a.label, b.label) : a.isRoot ? -1 : 1))
      : [];
    return { ...acc.row, totals: acc.builder.totals, breakdown };
  });
  const privateRows = [...privates.values()].map((acc) => ({ ...acc.row, totals: acc.builder.totals }));

  companyRows.sort((a, b) => collator.compare(a.label, b.label));
  privateRows.sort((a, b) => collator.compare(a.label, b.label));

  return { companies: companyRows, privates: privateRows, totals: all.totals };
}

/* ------------------------------------------------------------------ */
/* Positionen eines Kontos                                             */
/* ------------------------------------------------------------------ */

export type CostDetailEntry = {
  id: string;
  kind: string;
  description: string;
  quantityHundredths: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
  performedAt: Date;
  billed: boolean;
  billedAt: Date | null;
  createdByName: string | null;
  /** Mitarbeiter, der die Leistung erbracht hat */
  performedByName: string | null;
  /** Preis fehlt noch (vom Techniker erfasst) */
  needsPrice: boolean;
  /** Rechnung, auf der die Position steht */
  invoice: { id: string; number: string } | null;
};

export type CostDetailTicket = {
  id: number;
  subject: string;
  status: string;
  /** Firma des Tickets (null bei Privatkunden) */
  companyId: string | null;
  /** Unterkunde bzw. Firma, wenn abweichend vom Firmenkunden */
  subCompanyName: string | null;
  contactName: string | null;
  entries: CostDetailEntry[];
  totals: CostTotals;
};

export type CostAccountDetail = {
  tickets: CostDetailTicket[];
  totals: CostTotals;
};

export async function getAccountCostDetail(resolved: ResolvedCostAccount, filter: CostFilter): Promise<CostAccountDetail> {
  const entries = await db.costEntry.findMany({
    where: costWhere(filter, resolved.ticketWhere),
    orderBy: [{ performedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      kind: true,
      description: true,
      quantityHundredths: true,
      unit: true,
      unitPriceCents: true,
      totalCents: true,
      performedAt: true,
      billed: true,
      billedAt: true,
      needsPrice: true,
      createdBy: { select: { name: true } },
      performedBy: { select: { name: true } },
      invoice: { select: { id: true, number: true } },
      ticket: {
        select: {
          id: true,
          subject: true,
          status: true,
          contactName: true,
          company: { select: { id: true, name: true, parentId: true } },
        },
      },
    },
  });

  const tickets = new Map<number, { ticket: CostDetailTicket; builder: TotalsBuilder }>();
  const all = new TotalsBuilder();

  for (const e of entries) {
    all.add(e, e.ticket.id);
    let group = tickets.get(e.ticket.id);
    if (!group) {
      group = {
        ticket: {
          id: e.ticket.id,
          subject: e.ticket.subject,
          status: e.ticket.status,
          companyId: e.ticket.company?.id ?? null,
          subCompanyName: e.ticket.company?.parentId ? e.ticket.company.name : null,
          contactName: e.ticket.contactName,
          entries: [],
          totals: emptyTotals(),
        },
        builder: new TotalsBuilder(),
      };
      tickets.set(e.ticket.id, group);
    }
    group.builder.add(e, e.ticket.id);
    group.ticket.entries.push({
      id: e.id,
      kind: e.kind,
      description: e.description,
      quantityHundredths: e.quantityHundredths,
      unit: e.unit,
      unitPriceCents: e.unitPriceCents,
      totalCents: e.totalCents,
      performedAt: e.performedAt,
      billed: e.billed,
      billedAt: e.billedAt,
      createdByName: e.createdBy?.name ?? null,
      performedByName: e.performedBy?.name ?? null,
      needsPrice: e.needsPrice,
      invoice: e.invoice,
    });
  }

  // Neueste Tickets zuerst, innerhalb eines Tickets chronologisch
  const list = [...tickets.values()].map((g) => ({ ...g.ticket, totals: g.builder.totals })).sort((a, b) => b.id - a.id);

  return { tickets: list, totals: all.totals };
}

/** Bulk-Aktion: Filter, der nur Positionen dieses Kontos trifft. */
export function accountCostWhere(resolved: ResolvedCostAccount, ids: string[]): Prisma.CostEntryWhereInput {
  return { id: { in: ids }, ticket: resolved.ticketWhere };
}

/* ------------------------------------------------------------------ */
/* Kurzübersicht für die Kundenseite                                   */
/* ------------------------------------------------------------------ */

export type CostSummary = { openCents: number; openEntries: number; billedCents: number; lastPerformedAt: Date | null };

/** Offene und abgerechnete Summe aller Tickets der angegebenen Firmen (gesamter Zeitraum). */
export async function getCompanyCostSummary(companyIds: string[]): Promise<CostSummary> {
  if (companyIds.length === 0) return { openCents: 0, openEntries: 0, billedCents: 0, lastPerformedAt: null };
  const where: Prisma.CostEntryWhereInput = { ticket: { companyId: { in: companyIds } } };
  const [groups, last] = await Promise.all([
    db.costEntry.groupBy({ by: ["billed"], where, _sum: { totalCents: true }, _count: { _all: true } }),
    db.costEntry.findFirst({ where, orderBy: { performedAt: "desc" }, select: { performedAt: true } }),
  ]);
  const open = groups.find((g) => !g.billed);
  const billed = groups.find((g) => g.billed);
  return {
    openCents: open?._sum.totalCents ?? 0,
    openEntries: open?._count._all ?? 0,
    billedCents: billed?._sum.totalCents ?? 0,
    lastPerformedAt: last?.performedAt ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Privatkunden-Konten                                                 */
/* ------------------------------------------------------------------ */

/** Schlüssel eines Privatkunden-Kontos: E-Mail-Adresse ohne Leerzeichen, klein geschrieben (null = ohne Adresse). */
export function privateAccountEmail(contactEmail: string | null | undefined): string | null {
  return contactEmail?.trim().toLowerCase() || null;
}

/**
 * Spalte „Konto“ der CSV für Privatkunden-Tickets, passend zur Übersicht: ein Konto je E-Mail-Adresse
 * (Groß-/Kleinschreibung egal) mit dem Namen aus dem jüngsten Ticket, das einen Namen hat.
 * Tickets ohne E-Mail-Adresse sind jeweils ein eigenes Konto. Ergebnis: Ticketnummer → Bezeichnung.
 */
export function privateAccountLabels(
  tickets: { id: number; contactName: string | null; contactEmail: string | null }[],
): Map<number, string> {
  const names = new Map<string, { ticketId: number; name: string }>();
  for (const t of tickets) {
    const email = privateAccountEmail(t.contactEmail);
    const name = t.contactName?.trim();
    if (!email || !name) continue;
    const known = names.get(email);
    if (!known || t.id > known.ticketId) names.set(email, { ticketId: t.id, name });
  }
  const labels = new Map<number, string>();
  for (const t of tickets) {
    const email = privateAccountEmail(t.contactEmail);
    labels.set(
      t.id,
      email
        ? [names.get(email)?.name, email].filter(Boolean).join(", ")
        : t.contactName?.trim() || `Privatkunde zu ${formatTicketNumber(t.id)}`,
    );
  }
  return labels;
}

/* ------------------------------------------------------------------ */
/* CSV-Export                                                          */
/* ------------------------------------------------------------------ */

const CSV_HEADER = [
  "Datum",
  "Konto",
  "Unterkunde",
  "Ticket",
  "Betreff",
  "Art",
  "Beschreibung",
  "Menge",
  "Einheit",
  "Einzelpreis",
  "Gesamt",
  "Abgerechnet",
  "Rechnung",
];

const csvNumber = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const csvQuantity = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 2, useGrouping: false });

const csvDate = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Textzelle: Formel-Einschleusung verhindern (Zellen, die mit = + - @ oder Steuerzeichen beginnen,
 * bekommen ein ' vorangestellt) und bei Bedarf in Anführungszeichen setzen.
 */
function csvText(value: string | null | undefined): string {
  let v = (value ?? "").replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return csvQuote(v);
}

/** Zahlenzelle (selbst formatiert, ohne Formelgefahr). */
function csvQuote(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Erstellt die CSV-Datei (Semikolon, deutsche Dezimalkommas, UTF-8 mit BOM). */
export async function buildCostCsv(filter: CostFilter, resolved: ResolvedCostAccount | null): Promise<string> {
  const entries = await db.costEntry.findMany({
    where: costWhere(filter, resolved?.ticketWhere),
    orderBy: [{ performedAt: "asc" }, { ticketId: "asc" }, { createdAt: "asc" }],
    select: {
      kind: true,
      description: true,
      quantityHundredths: true,
      unit: true,
      unitPriceCents: true,
      totalCents: true,
      performedAt: true,
      billed: true,
      needsPrice: true,
      invoice: { select: { number: true } },
      ticket: {
        select: {
          id: true,
          subject: true,
          contactName: true,
          contactEmail: true,
          company: { select: { name: true, parentId: true, parent: { select: { name: true } } } },
        },
      },
    },
  });

  // Privatkunden wie in der Übersicht: ein Konto je E-Mail-Adresse, egal in welcher Schreibweise
  const privateLabels = privateAccountLabels(entries.filter((e) => !e.ticket.company).map((e) => e.ticket));
  const lines = [CSV_HEADER.map(csvText).join(";")];
  for (const e of entries) {
    const company = e.ticket.company;
    const account = company ? (company.parent?.name ?? company.name) : (privateLabels.get(e.ticket.id) ?? "Privatkunde");
    lines.push(
      [
        csvQuote(csvDate.format(e.performedAt)),
        csvText(account),
        csvText(company?.parentId ? company.name : ""),
        csvText(formatTicketNumber(e.ticket.id)),
        csvText(e.ticket.subject),
        csvText(labelOf(COST_KIND_LABELS, e.kind)),
        csvText(e.description),
        csvQuote(csvQuantity.format(e.quantityHundredths / 100)),
        csvText(e.unit),
        e.needsPrice ? csvText("Preis fehlt") : csvQuote(csvNumber.format(e.unitPriceCents / 100)),
        csvQuote(csvNumber.format(e.totalCents / 100)),
        csvText(e.billed ? "ja" : "nein"),
        csvText(e.invoice?.number ?? ""),
      ].join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

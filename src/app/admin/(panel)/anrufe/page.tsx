import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { CallsList, type CallListItem } from "@/components/admin/calls/calls-list";
import { CallsLiveRefresh } from "@/components/admin/calls/calls-live-refresh";
import { NotificationPermission } from "@/components/admin/calls/notification-permission";
import { requireStaff } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatInquiryNumber, formatTicketNumber } from "@/lib/format";
import { counterpartNumber, normalizePhone, startOfBerlinDay } from "@/lib/phone";
import { matchCallers, telephonyToken, type CallerMatch } from "@/lib/telephony";

export const metadata: Metadata = { title: "Anrufe" };

const PAGE_SIZE = 30;

const RANGES = [
  { key: "heute", label: "Heute" },
  { key: "7-tage", label: "7 Tage" },
  { key: "alle", label: "Alle" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

type Filters = { zeitraum: RangeKey; verpasst: boolean; ohneTicket: boolean; q: string };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function filterHref(filters: Filters, change: Partial<Filters>): string {
  const f = { ...filters, ...change };
  const params = new URLSearchParams();
  if (f.zeitraum !== "7-tage") params.set("zeitraum", f.zeitraum);
  if (f.verpasst) params.set("verpasst", "1");
  if (f.ohneTicket) params.set("ohne-ticket", "1");
  if (f.q) params.set("q", f.q);
  const s = params.toString();
  return s ? `/admin/anrufe?${s}` : "/admin/anrufe";
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset",
        active ? "bg-ink text-white ring-ink" : "bg-white text-ink-soft ring-line-strong hover:bg-brand-50 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

function callerLink(
  company: { id: string; parentId: string | null } | null,
  match: CallerMatch | null,
): { href: string; label: string } | null {
  if (company) return { href: `/admin/kunden/${company.parentId ?? company.id}`, label: "Kunde öffnen" };
  if (!match) return null;
  if (match.rootCompanyId) return { href: `/admin/kunden/${match.rootCompanyId}`, label: "Kunde öffnen" };
  if (match.inquiryId) return { href: `/admin/anfragen/${match.inquiryId}`, label: `Anfrage ${formatInquiryNumber(match.inquiryId)}` };
  if (match.ticketId) return { href: `/admin/tickets/${match.ticketId}`, label: `Ticket ${formatTicketNumber(match.ticketId)}` };
  return null;
}

export default async function CallsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const rangeParam = first(sp.zeitraum);
  const filters: Filters = {
    zeitraum: RANGES.some((r) => r.key === rangeParam) ? (rangeParam as RangeKey) : "7-tage",
    verpasst: first(sp.verpasst) === "1",
    ohneTicket: first(sp["ohne-ticket"]) === "1",
    q: (first(sp.q) ?? "").trim().slice(0, 80),
  };
  const page = parsePage(sp.seite);
  const now = new Date();
  const today = startOfBerlinDay(now);

  const and: Prisma.PhoneCallWhereInput[] = [];
  if (filters.zeitraum === "heute") and.push({ startedAt: { gte: today } });
  if (filters.zeitraum === "7-tage") and.push({ startedAt: { gte: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000) } });
  if (filters.verpasst) and.push({ status: "MISSED", handledAt: null });
  if (filters.ohneTicket) and.push({ ticketId: null });
  if (filters.q) {
    const digits = filters.q.replace(/\D/g, "");
    const number = digits.length >= 3 ? (normalizePhone(filters.q) ?? digits) : null;
    and.push({
      OR: [
        { callerLabel: { contains: filters.q } },
        { answeredBy: { contains: filters.q } },
        { note: { contains: filters.q } },
        ...(number ? [{ fromNumber: { contains: number } }, { toNumber: { contains: number } }] : []),
      ],
    });
  }
  const where: Prisma.PhoneCallWhereInput = and.length ? { AND: and } : {};

  const [total, rows, openMissed, anyCalls] = await Promise.all([
    db.phoneCall.count({ where }),
    db.phoneCall.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        provider: true,
        direction: true,
        status: true,
        fromNumber: true,
        toNumber: true,
        callerLabel: true,
        answeredBy: true,
        startedAt: true,
        answeredAt: true,
        endedAt: true,
        handledAt: true,
        note: true,
        company: { select: { id: true, parentId: true } },
        handledBy: { select: { name: true } },
        ticket: { select: { id: true, subject: true } },
      },
    }),
    db.phoneCall.count({ where: { status: "MISSED", handledAt: null } }),
    db.phoneCall.count({ take: 1 }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Anrufer ohne Zuordnung erneut suchen – z. B. wenn die Nummer inzwischen beim Kunden eingetragen ist
  let matches = new Map<string, CallerMatch>();
  const unknownNumbers = rows.filter((r) => !r.company).map((r) => counterpartNumber(r));
  if (unknownNumbers.length > 0) {
    matches = await matchCallers(unknownNumbers).catch(() => new Map<string, CallerMatch>());
  }

  const calls: CallListItem[] = rows.map((r) => {
    const number = counterpartNumber(r);
    const normalized = normalizePhone(number);
    const match = !r.company && normalized ? (matches.get(normalized) ?? null) : null;
    const link = callerLink(r.company, match);
    return {
      id: r.id,
      provider: r.provider,
      direction: r.direction,
      status: r.status,
      number,
      callerLabel: r.callerLabel ?? match?.label ?? null,
      callerHref: link?.href ?? null,
      callerHrefLabel: link?.label ?? null,
      answeredBy: r.answeredBy,
      startedAt: r.startedAt,
      answeredAt: r.answeredAt,
      endedAt: r.endedAt,
      handledAt: r.handledAt,
      handledByName: r.handledBy?.name ?? null,
      note: r.note,
      ticket: r.ticket,
    };
  });

  const filtered = filters.zeitraum !== "7-tage" || filters.verpasst || filters.ohneTicket || filters.q !== "";
  const isAdmin = user.role === "ADMIN";

  return (
    <div>
      <PageHeader
        title="Anrufe"
        description="Alle Anrufe aus der Telefonanlage. Bekannte Nummern ordnen wir automatisch dem Kunden zu – aus jedem Anruf lässt sich direkt ein Ticket machen."
        meta={
          <>
            <CallsLiveRefresh />
            <NotificationPermission compact />
          </>
        }
        actions={
          isAdmin ? (
            <ButtonLink href="/admin/anrufe/einrichtung" variant="secondary">
              Telefonanlage einrichten
            </ButtonLink>
          ) : null
        }
      />

      {openMissed > 0 && !filters.verpasst ? (
        <Alert tone="warning" className="mb-5">
          {openMissed === 1 ? "Ein verpasster Anruf wartet" : `${openMissed} verpasste Anrufe warten`} auf Rückruf.{" "}
          <Link href={filterHref(filters, { verpasst: true, zeitraum: "alle" })} className="font-semibold underline">
            Anzeigen
          </Link>
        </Alert>
      ) : null}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter" className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <Pill key={r.key} href={filterHref(filters, { zeitraum: r.key })} active={filters.zeitraum === r.key}>
              {r.label}
            </Pill>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
          <Pill href={filterHref(filters, { verpasst: !filters.verpasst })} active={filters.verpasst}>
            Verpasst, offen{openMissed > 0 ? ` (${openMissed})` : ""}
          </Pill>
          <Pill href={filterHref(filters, { ohneTicket: !filters.ohneTicket })} active={filters.ohneTicket}>
            Ohne Ticket
          </Pill>
        </nav>

        <form action="/admin/anrufe" method="get" role="search" className="flex w-full gap-2 lg:w-auto">
          {filters.zeitraum !== "7-tage" ? <input type="hidden" name="zeitraum" value={filters.zeitraum} /> : null}
          {filters.verpasst ? <input type="hidden" name="verpasst" value="1" /> : null}
          {filters.ohneTicket ? <input type="hidden" name="ohne-ticket" value="1" /> : null}
          <label htmlFor="anrufe-suche" className="sr-only">
            Nummer, Name oder Notiz suchen
          </label>
          <input
            id="anrufe-suche"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Nummer, Name oder Notiz"
            maxLength={80}
            className="block h-10 w-full min-w-0 rounded-full border border-line-strong bg-white px-4 text-sm text-ink placeholder:text-ink-muted/80 hover:border-brand-300 focus:border-brand-500 focus:ring-3 focus:ring-brand-200/70 focus:outline-none lg:w-64"
          />
          <Button type="submit" variant="secondary">
            <Search className="size-4" aria-hidden />
            Suchen
          </Button>
        </form>
      </div>

      {calls.length === 0 ? (
        anyCalls === 0 ? (
          <EmptyState
            title="Noch keine Anrufe"
            action={
              isAdmin ? (
                <ButtonLink href="/admin/anrufe/einrichtung">{telephonyToken() ? "Einrichtung prüfen" : "Telefonanlage einrichten"}</ButtonLink>
              ) : null
            }
          >
            Sobald die Telefonanlage angebunden ist, erscheint hier jeder Anruf – mit Kunde, Status und wer angenommen hat.
            {isAdmin ? null : " Die Anbindung richtet ein Administrator ein."}
          </EmptyState>
        ) : (
          <EmptyState
            title="Keine Anrufe für diese Auswahl"
            action={
              filtered ? (
                <ButtonLink href="/admin/anrufe?zeitraum=alle" variant="secondary">
                  Alle Anrufe anzeigen
                </ButtonLink>
              ) : null
            }
          >
            {filters.q
              ? `Zu „${filters.q}“ haben wir keinen Anruf gefunden. Prüfen Sie die Schreibweise oder erweitern Sie den Zeitraum.`
              : "Ändern Sie den Zeitraum oder die Filter oben."}
          </EmptyState>
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted">
            {total === 1 ? "1 Anruf" : `${total} Anrufe`}
            {filters.zeitraum === "heute" ? " heute" : filters.zeitraum === "7-tage" ? " in den letzten 7 Tagen" : ""}
          </p>
          <CallsList calls={calls} now={now} />
          <Pagination
            page={Math.min(page, pageCount)}
            pageCount={pageCount}
            basePath="/admin/anrufe"
            baseQuery={{
              zeitraum: filters.zeitraum !== "7-tage" ? filters.zeitraum : undefined,
              verpasst: filters.verpasst ? "1" : undefined,
              "ohne-ticket": filters.ohneTicket ? "1" : undefined,
              q: filters.q || undefined,
            }}
          />
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, TriangleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/constants";
import { formatMoney, formatTicketNumber } from "@/lib/format";
import { canSeeCostAmounts } from "@/lib/permissions";
import { startOfBerlinDay } from "@/lib/phone";
import { getSiteSettings, unfinishedSettings } from "@/lib/settings";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { findTicketPage, staffTicketRowSelect } from "@/components/admin/tickets/data";
import { ticketListHref } from "@/components/admin/tickets/filters";
import { StaffTicketList } from "@/components/admin/tickets/ticket-table";
import { InquiryList, ListCard, StatCard } from "@/components/admin/dashboard/widgets";
import { settingsLabelList } from "@/components/admin/website/settings-labels";

// Die Titelvorlage aus (panel)/layout.tsx gilt nicht für die Seite im selben Segment
export const metadata: Metadata = { title: { absolute: "Übersicht | Hertlin Verwaltung" } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DAY = 24 * 60 * 60 * 1000;
const open = { in: [...OPEN_STATUSES] };

/** Zeitpunkt vor n Tagen (für „wartet seit über 7 Tagen“) */
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function AdminDashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaff();
  const params = await searchParams;
  const hinweis = Array.isArray(params.hinweis) ? params.hinweis[0] : params.hinweis;
  const staleSince = daysAgo(7);

  const [
    newCount,
    newUnassigned,
    inProgress,
    inProgressMine,
    waiting,
    waitingStale,
    criticalOpen,
    highOpen,
    mine,
    latest,
    inquiries,
    inquiryCount,
    missedCalls,
    missedToday,
    anyCall,
  ] = await Promise.all([
    db.ticket.count({ where: { status: "NEW" } }),
    db.ticket.count({ where: { status: "NEW", assigneeId: null } }),
    db.ticket.count({ where: { status: "IN_PROGRESS" } }),
    db.ticket.count({ where: { status: "IN_PROGRESS", assigneeId: user.id } }),
    db.ticket.count({ where: { status: "WAITING_CUSTOMER" } }),
    db.ticket.count({ where: { status: "WAITING_CUSTOMER", updatedAt: { lt: staleSince } } }),
    db.ticket.count({ where: { status: open, priority: "CRITICAL" } }),
    db.ticket.count({ where: { status: open, priority: "HIGH" } }),
    findTicketPage({
      where: { assigneeId: user.id, status: open },
      sort: "dringlichkeit",
      page: 1,
      pageSize: 8,
      select: staffTicketRowSelect,
    }),
    db.ticket.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 8, select: staffTicketRowSelect }),
    db.inquiry.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, companyName: true, customerType: true, topic: true, createdAt: true },
    }),
    db.inquiry.count({ where: { status: "NEW" } }),
    // Verpasste Anrufe, um die sich noch niemand gekümmert hat (wie der Zähler in der Navigation)
    db.phoneCall.count({ where: { status: "MISSED", handledAt: null } }),
    db.phoneCall.count({ where: { status: "MISSED", handledAt: null, startedAt: { gte: startOfBerlinDay() } } }),
    // Gibt es überhaupt schon Anrufe? Ohne Telefonanlage wäre „alle erledigt“ irreführend
    db.phoneCall.count({ take: 1 }),
  ]);

  // Kosten nur für Administratoren abfragen und anzeigen. Positionen ohne Preis zählen erst mit Preis.
  const showAmounts = canSeeCostAmounts(user.role);
  const unbilled = showAmounts
    ? await Promise.all([
        db.costEntry.aggregate({
          where: { billed: false, needsPrice: false },
          _sum: { totalCents: true },
          _count: { _all: true },
        }),
        db.costEntry.groupBy({ by: ["ticketId"], where: { billed: false, needsPrice: false } }),
      ]).then(([sum, tickets]) => ({
        cents: sum._sum.totalCents ?? 0,
        positions: sum._count._all,
        tickets: tickets.length,
      }))
    : null;
  const missingPrices = showAmounts ? await loadMissingPrices() : null;

  // Platzhalter in den Firmendaten erscheinen öffentlich (Kopfzeile, Impressum, E-Mails). Ändern können sie nur Administratoren.
  const unfinished = user.role === "ADMIN" ? unfinishedSettings(await getSiteSettings()) : [];

  const today = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date());

  return (
    <>
      <PageHeader
        title="Übersicht"
        description={today}
        actions={
          <ButtonLink href="/admin/tickets/neu">
            <Plus className="size-4" aria-hidden />
            Ticket anlegen
          </ButtonLink>
        }
      />

      {hinweis === "kein-zugriff" ? (
        <Alert tone="warning" title="Kein Zugriff" className="mb-6">
          Diese Seite ist Administratoren vorbehalten. Wenn Sie dort etwas brauchen, sprechen Sie bitte einen Administrator an.
        </Alert>
      ) : null}

      {unfinished.length > 0 ? (
        <Alert tone="warning" title="Die Firmendaten sind noch nicht vollständig" className="mb-6">
          <p>
            Noch mit Platzhalter („TODO“): {settingsLabelList(unfinished)}. Diese Angaben stehen so auf der Website, im Impressum und in
            E-Mails an Kunden.{" "}
            <Link href="/admin/website/firmendaten" className="font-semibold underline underline-offset-2">
              Firmendaten ergänzen
            </Link>
          </p>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          href={ticketListHref({ status: "NEW" })}
          label="Neu"
          value={newCount}
          hint={newCount === 0 ? "keine neuen Tickets" : newUnassigned > 0 ? `${newUnassigned} ohne Bearbeiter` : "alle zugewiesen"}
        />
        <StatCard
          href={ticketListHref({ status: "IN_PROGRESS" })}
          label="In Bearbeitung"
          value={inProgress}
          hint={inProgress === 0 ? "nichts in Arbeit" : inProgressMine > 0 ? `${inProgressMine} davon bei Ihnen` : "keines davon bei Ihnen"}
        />
        <StatCard
          href={ticketListHref({ status: "WAITING_CUSTOMER" })}
          label="Wartet auf Kunde"
          value={waiting}
          hint={
            waiting === 0
              ? "keine offenen Rückfragen"
              : waitingStale > 0
                ? `${waitingStale} davon seit über 7 Tagen`
                : "alle jünger als 7 Tage"
          }
        />
        <StatCard
          href={ticketListHref({ prioritaet: "CRITICAL" })}
          label="Kritisch offen"
          value={criticalOpen}
          hint={highOpen > 0 ? `dazu ${plural(highOpen, "Ticket", "Tickets")} mit hoher Priorität` : "keine mit hoher Priorität"}
          alert={criticalOpen > 0}
        />
        <StatCard
          href="/admin/anrufe?verpasst=1&zeitraum=alle"
          label="Verpasste Anrufe"
          value={missedCalls}
          hint={
            anyCall === 0
              ? "noch keine Anrufe erfasst"
              : missedCalls === 0
                ? "alle zurückgerufen oder erledigt"
                : missedToday > 0
                  ? `${missedToday} davon heute`
                  : "noch nicht zurückgerufen"
          }
          alert={missedCalls > 0}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <ListCard
            title="Mir zugewiesen"
            count={mine.total}
            footerHref={mine.total > mine.rows.length ? ticketListHref({ bearbeiter: "mir" }) : undefined}
            footerLabel={`Alle ${mine.total} anzeigen`}
          >
            <StaffTicketList
              tickets={mine.rows}
              emptyText="Ihnen ist gerade kein offenes Ticket zugewiesen. Neue Tickets ohne Bearbeiter finden Sie unter „Neu“."
            />
          </ListCard>

          <ListCard title="Neueste Tickets" footerHref={ticketListHref({ ansicht: "alle", sortierung: "neu" })} footerLabel="Alle Tickets">
            <StaffTicketList tickets={latest} emptyText="Noch keine Tickets vorhanden." />
          </ListCard>
        </div>

        <div className="min-w-0 space-y-6">
          <ListCard title="Neue Anfragen" count={inquiryCount} footerHref="/admin/anfragen" footerLabel="Alle Anfragen">
            <InquiryList inquiries={inquiries} />
          </ListCard>

          {missingPrices && missingPrices.positions > 0 ? (
            <section
              aria-labelledby="karte-preis-fehlt"
              className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-card"
            >
              <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4 sm:px-6">
                <h2 id="karte-preis-fehlt" className="flex items-center gap-2 text-base font-bold text-amber-900">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden />
                  Positionen ohne Preis ({missingPrices.positions})
                </h2>
              </div>
              <p className="px-5 pt-4 text-sm text-ink-muted sm:px-6">
                Im Ticket ohne Katalogpreis erfasst. Erst mit Preis zählen sie in den Summen und lassen sich abrechnen.
              </p>
              <ul className="divide-y divide-line px-2 py-2 sm:px-3">
                {missingPrices.tickets.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/tickets/${t.id}#kosten`}
                      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink group-hover:underline">{t.subject}</span>
                        <span className="block text-xs text-ink-muted">
                          {formatTicketNumber(t.id)} · {plural(t.count, "Position", "Positionen")}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
              {missingPrices.moreTickets > 0 ? (
                <p className="border-t border-line px-5 py-3 text-xs text-ink-muted sm:px-6">
                  Dazu {plural(missingPrices.moreTickets, "weiteres Ticket", "weitere Tickets")}.
                </p>
              ) : null}
            </section>
          ) : null}

          {unbilled ? (
            <Card>
              <CardHeader title="Nicht abgerechnete Kosten" description="Nur für Administratoren sichtbar." />
              <CardBody>
                <p className="text-3xl font-bold tracking-tight text-ink tabular-nums">{formatMoney(unbilled.cents)}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {unbilled.positions === 0
                    ? "Alles abgerechnet."
                    : `${plural(unbilled.positions, "Position", "Positionen")} aus ${plural(unbilled.tickets, "Ticket", "Tickets")}`}
                </p>
                <Link href="/admin/kosten" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline">
                  Kosten pro Konto ansehen
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

const MISSING_PRICE_LIMIT = 6;

/** Positionen ohne Preis (nicht auf einer Rechnung), gruppiert nach Ticket – nur für Administratoren. */
async function loadMissingPrices() {
  const groups = await db.costEntry.groupBy({
    by: ["ticketId"],
    where: { needsPrice: true, invoiceId: null },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const positions = groups.reduce((sum, g) => sum + g._count._all, 0);
  // Zuletzt erfasste zuerst
  const shown = [...groups]
    .sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0))
    .slice(0, MISSING_PRICE_LIMIT);
  const subjects = await db.ticket.findMany({
    where: { id: { in: shown.map((g) => g.ticketId) } },
    select: { id: true, subject: true },
  });
  const subjectOf = new Map(subjects.map((t) => [t.id, t.subject]));
  return {
    positions,
    tickets: shown.map((g) => ({ id: g.ticketId, subject: subjectOf.get(g.ticketId) ?? "", count: g._count._all })),
    moreTickets: Math.max(0, groups.length - shown.length),
  };
}

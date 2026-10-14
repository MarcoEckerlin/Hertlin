import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { findTicketPage, staffTicketRowSelect } from "@/components/admin/tickets/data";
import { ticketListHref } from "@/components/admin/tickets/filters";
import { StaffTicketList } from "@/components/admin/tickets/ticket-table";
import { InquiryList, ListCard, StatCard } from "@/components/admin/dashboard/widgets";

export const metadata: Metadata = { title: "Übersicht" };

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
  ]);

  // Kosten nur für Administratoren abfragen und anzeigen
  const unbilled =
    user.role === "ADMIN"
      ? await Promise.all([
          db.costEntry.aggregate({ where: { billed: false }, _sum: { totalCents: true }, _count: { _all: true } }),
          db.costEntry.groupBy({ by: ["ticketId"], where: { billed: false } }),
        ]).then(([sum, tickets]) => ({
          cents: sum._sum.totalCents ?? 0,
          positions: sum._count._all,
          tickets: tickets.length,
        }))
      : null;

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
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

        <div className="space-y-6">
          <ListCard title="Neue Anfragen" count={inquiryCount} footerHref="/admin/anfragen" footerLabel="Alle Anfragen">
            <InquiryList inquiries={inquiries} />
          </ListCard>

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

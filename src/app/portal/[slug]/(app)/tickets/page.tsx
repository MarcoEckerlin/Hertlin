import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePortalContext } from "@/lib/auth";
import { customerTicketSelect, portalTicketWhere } from "@/lib/permissions";
import { parseTicketNumber } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { scopeCompanies } from "@/components/portal/portal-data";
import { TicketFilterForm } from "@/components/portal/ticket-filter-form";
import { TicketStatusTabs } from "@/components/portal/ticket-status-tabs";
import { TicketTable } from "@/components/portal/ticket-list";
import {
  STATUS_FILTERS,
  TYPE_FILTERS,
  parseStatusFilter,
  parseTypeFilter,
  ticketListHref,
  type StatusFilterKey,
  type TypeFilterKey,
} from "@/components/portal/ticket-filters";

export const metadata: Metadata = { title: "Tickets" };

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PortalTicketsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePortalContext();
  const params = await searchParams;

  const status = parseStatusFilter(first(params.status));
  const art = parseTypeFilter(first(params.art));
  const suche = (first(params.suche) ?? "").trim().slice(0, 100);
  const requestedPage = parsePage(params.seite);

  // Firmenfilter nur für den Hauptansprechpartner des Firmenkunden und nur mit Firmen aus seinem Sichtbereich
  const companies = ctx.isRootAdmin && ctx.scopeCompanyIds.length > 1 ? await scopeCompanies(ctx) : null;
  const requestedFirma = first(params.firma);
  const firma = companies && requestedFirma && companies.some((c) => c.id === requestedFirma) ? requestedFirma : undefined;

  const filters: Prisma.TicketWhereInput[] = [portalTicketWhere(ctx)];
  if (art) filters.push({ type: TYPE_FILTERS[art].type });
  if (firma) filters.push({ companyId: firma });
  if (suche) {
    const number = parseTicketNumber(suche);
    filters.push({ OR: [{ subject: { contains: suche } }, ...(number ? [{ id: number }] : [])] });
  }
  const statusFilter = STATUS_FILTERS.find((f) => f.key === status) ?? STATUS_FILTERS[0];
  const where: Prisma.TicketWhereInput = {
    AND: statusFilter.statuses ? [...filters, { status: { in: [...statusFilter.statuses] } }] : filters,
  };

  const [grouped, total] = await Promise.all([
    db.ticket.groupBy({ by: ["status"], where: { AND: filters }, _count: { _all: true } }),
    db.ticket.count({ where }),
  ]);

  const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]));
  const counts = Object.fromEntries(
    STATUS_FILTERS.map((f) => [
      f.key,
      f.statuses
        ? f.statuses.reduce((sum, s) => sum + (byStatus.get(s) ?? 0), 0)
        : grouped.reduce((sum, g) => sum + g._count._all, 0),
    ]),
  ) as Record<StatusFilterKey, number>;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const tickets =
    total > 0
      ? await db.ticket.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: customerTicketSelect,
        })
      : [];

  const hasFilters = Boolean(art || suche || firma);
  const multipleCompanies = ctx.scopeCompanyIds.length > 1;
  const description = ctx.isAdmin
    ? multipleCompanies
      ? `Alle Tickets von ${ctx.root.name} und den Unterkunden.`
      : `Alle Tickets von ${ctx.company.name}.`
    : "Die Tickets, die Sie selbst gemeldet haben.";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Übersicht", href: "/" }, { label: "Tickets" }]}
        title="Tickets"
        description={description}
        actions={<ButtonLink href="/tickets/neu">Neues Ticket</ButtonLink>}
      />

      <div className="space-y-4">
        {counts.wartet > 0 && status !== "wartet" ? (
          <Alert tone="warning" title={counts.wartet === 1 ? "Bei einem Ticket wartet eine Rückfrage auf Sie" : `Bei ${counts.wartet} Tickets warten Rückfragen auf Sie`}>
            Sobald Sie geantwortet haben, machen wir weiter.{" "}
            <Link href={ticketListHref({ art, suche, firma, status: "wartet" })} className="font-semibold underline underline-offset-2">
              {counts.wartet === 1 ? "Rückfrage ansehen" : "Rückfragen ansehen"}
            </Link>
          </Alert>
        ) : null}
        <TicketStatusTabs active={status} counts={counts} query={{ art, suche, firma }} />
        <TicketFilterForm status={status} art={art} suche={suche} firma={firma} companies={companies} />
      </div>

      <div className="mt-6">
        {tickets.length > 0 ? (
          <>
            <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
              {total === 1 ? "1 Ticket" : `${total} Tickets`}
              {hasFilters ? " passend zu Ihrer Auswahl" : null}
            </p>
            <TicketTable tickets={tickets} showCompany={multipleCompanies} showCreator={ctx.isAdmin} />
            <Pagination
              page={page}
              pageCount={pageCount}
              basePath="/tickets"
              baseQuery={{
                status: status === "offen" ? undefined : status,
                art,
                suche: suche || undefined,
                firma,
              }}
            />
          </>
        ) : (
          <EmptyResult
            status={status}
            hasFilters={hasFilters}
            anyInScope={counts.alle > 0}
            query={{ art, suche, firma }}
          />
        )}
      </div>
    </>
  );
}

function EmptyResult({
  status,
  hasFilters,
  anyInScope,
  query,
}: {
  status: StatusFilterKey;
  hasFilters: boolean;
  /** Gibt es mit den übrigen Filtern Tickets in irgendeinem Status? */
  anyInScope: boolean;
  query: { art?: TypeFilterKey; suche?: string; firma?: string };
}) {
  if (hasFilters) {
    // Unter einem anderen Status gibt es Treffer: dorthin verweisen statt nur „nichts gefunden“
    if (anyInScope && status !== "alle") {
      return (
        <EmptyState
          title="In dieser Ansicht nichts gefunden"
          action={
            <ButtonLink href={ticketListHref({ ...query, status: "alle" })} variant="secondary" size="sm">
              Unter „Alle“ suchen
            </ButtonLink>
          }
        >
          Unter einem anderen Status gibt es passende Tickets.
        </EmptyState>
      );
    }
    return (
      <EmptyState
        title="Keine passenden Tickets"
        action={
          <ButtonLink href={ticketListHref({ status })} variant="secondary" size="sm">
            Filter zurücksetzen
          </ButtonLink>
        }
      >
        Mit diesen Filtern finden wir nichts. Probieren Sie einen anderen Begriff oder suchen Sie nach der Ticketnummer, z. B.
        T-00042.
      </EmptyState>
    );
  }

  if (!anyInScope && status === "offen") {
    return (
      <EmptyState
        title="Noch keine Tickets"
        action={<ButtonLink href="/tickets/neu">Erstes Ticket anlegen</ButtonLink>}
      >
        Hier erscheinen Ihre Störungen und Anfragen – mit dem aktuellen Stand und allen Antworten von uns.
      </EmptyState>
    );
  }

  if (status === "offen") {
    return (
      <EmptyState
        title="Gerade ist nichts offen"
        action={
          <ButtonLink href={ticketListHref({ ...query, status: "erledigt" })} variant="secondary" size="sm">
            Erledigte Tickets ansehen
          </ButtonLink>
        }
      >
        Alle Tickets sind erledigt. Wenn etwas Neues ansteht, legen Sie einfach ein neues Ticket an.
      </EmptyState>
    );
  }

  if (status === "wartet") {
    return (
      <EmptyState title="Keine offenen Rückfragen">
        Wir warten gerade bei keinem Ticket auf eine Antwort von Ihnen. Sobald wir etwas wissen müssen, bekommen Sie eine
        E-Mail.
      </EmptyState>
    );
  }

  if (status === "erledigt") {
    return (
      <EmptyState title="Noch nichts erledigt">
        Hier stehen Tickets, sobald sie gelöst oder abgeschlossen sind.
      </EmptyState>
    );
  }

  return (
    <EmptyState title="Noch keine Tickets" action={<ButtonLink href="/tickets/neu">Neues Ticket anlegen</ButtonLink>}>
      Hier erscheinen Ihre Störungen und Anfragen – mit dem aktuellen Stand und allen Antworten von uns.
    </EmptyState>
  );
}

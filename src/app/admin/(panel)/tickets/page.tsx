import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { isAdmin, requireStaff } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import {
  findTicketPage,
  loadCostSums,
  loadCustomerGroups,
  loadStaffOptions,
  staffTicketRowSelect,
  ticketListWhere,
} from "@/components/admin/tickets/data";
import {
  TICKET_VIEWS,
  VIEW_LABELS,
  hasActiveFilters,
  parseTicketListFilters,
  ticketListHref,
  ticketListQuery,
} from "@/components/admin/tickets/filters";
import { TicketFilterForm } from "@/components/admin/tickets/ticket-filter-form";
import { StaffTicketTable } from "@/components/admin/tickets/ticket-table";

export const metadata: Metadata = { title: "Tickets" };

const PAGE_SIZE = 25;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminTicketsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaff();
  const filters = parseTicketListFilters(await searchParams);
  const where = ticketListWhere(filters, user.id);

  const [result, staff, customers, locations, viewCounts] = await Promise.all([
    findTicketPage({ where, sort: filters.sortierung, page: filters.seite, pageSize: PAGE_SIZE, select: staffTicketRowSelect }),
    loadStaffOptions({ includeInactive: true }),
    loadCustomerGroups({ activeOnly: false, withUsers: false }),
    // Auch deaktivierte Standorte, damit ältere Tickets auffindbar bleiben
    db.location.findMany({
      orderBy: [{ active: "desc" }, { isMain: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    // Zahlen an den Reitern: gleiche Filter, nur ohne Einzelstatus
    Promise.all(
      TICKET_VIEWS.map((view) =>
        db.ticket.count({ where: ticketListWhere({ ...filters, ansicht: view, status: undefined }, user.id) }),
      ),
    ),
  ]);

  // Kosten nur für Administratoren laden – Techniker bekommen keine Spalte und keine Daten
  const costs = isAdmin(user) ? await loadCostSums(result.rows.map((t) => t.id)) : undefined;
  const filtered = hasActiveFilters(filters);
  // Standort erst zeigen, wenn es mehr als einen gibt – sonst steht überall dasselbe
  const showLocation = locations.length > 1;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Übersicht", href: "/admin" }, { label: "Tickets" }]}
        title="Tickets"
        description="Störungen und Anfragen von Firmen- und Privatkunden."
        actions={
          <ButtonLink href="/admin/tickets/neu">
            <Plus className="size-4" aria-hidden />
            Ticket anlegen
          </ButtonLink>
        }
      />

      <nav aria-label="Ansicht" className="mb-4 flex flex-wrap gap-2">
        {TICKET_VIEWS.map((view, i) => {
          const active = filters.ansicht === view;
          return (
            <Link
              key={view}
              href={ticketListHref({ ...filters, ansicht: view, status: undefined, sortierung: undefined, seite: 1 })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-inset transition-colors",
                active ? "bg-brand-100 text-ink ring-brand-300" : "bg-white text-ink-soft ring-line-strong hover:bg-brand-50 hover:text-ink",
              )}
            >
              {VIEW_LABELS[view]}
              <span className={cn("tabular-nums", active ? "text-ink-soft" : "text-ink-muted")}>{viewCounts[i]}</span>
            </Link>
          );
        })}
      </nav>

      <TicketFilterForm
        filters={filters}
        staff={staff.map((s) => ({ id: s.id, name: s.name, active: s.active }))}
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          active: c.active,
          children: c.children.map((child) => ({ id: child.id, name: child.name, active: child.active })),
        }))}
        locations={showLocation || filters.standort ? locations : []}
      />

      <div className="mt-6">
        {result.rows.length > 0 ? (
          <>
            <p className="mb-3 text-sm text-ink-muted" aria-live="polite">
              {result.total === 1 ? "1 Ticket" : `${result.total} Tickets`}
              {filters.suche ? ` für „${filters.suche}“` : null}
            </p>
            <StaffTicketTable tickets={result.rows} currentUserId={user.id} costs={costs} showLocation={showLocation} />
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              basePath="/admin/tickets"
              baseQuery={ticketListQuery(filters)}
            />
          </>
        ) : filtered ? (
          <EmptyState
            title="Keine Tickets zu diesen Filtern"
            action={
              <ButtonLink href={ticketListHref({ ansicht: filters.ansicht })} variant="secondary" size="sm">
                Filter zurücksetzen
              </ButtonLink>
            }
          >
            Prüfen Sie die Schreibweise oder lockern Sie die Auswahl. Gesucht wird in Ticketnummer, Betreff,
            Kontaktname, E-Mail-Adresse und Firmenname.
          </EmptyState>
        ) : filters.ansicht === "offen" ? (
          <EmptyState title="Gerade ist nichts offen">
            Neue Tickets aus dem Kundenportal und dem Formular für Privatkunden erscheinen hier automatisch.
          </EmptyState>
        ) : filters.ansicht === "erledigt" ? (
          <EmptyState title="Noch keine erledigten Tickets">
            Gelöste und geschlossene Tickets landen in dieser Ansicht.
          </EmptyState>
        ) : (
          <EmptyState
            title="Es gibt noch keine Tickets"
            action={
              <ButtonLink href="/admin/tickets/neu" size="sm">
                Ticket anlegen
              </ButtonLink>
            }
          >
            Tickets entstehen im Kundenportal, über das Formular für Privatkunden oder hier in der Verwaltung.
          </EmptyState>
        )}
      </div>
    </>
  );
}

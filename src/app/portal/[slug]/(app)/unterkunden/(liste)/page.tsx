import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalRootAdmin } from "@/lib/auth";
import { portalHost } from "@/lib/hosts";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { TD, TH, THead, Table } from "@/components/ui/table";
import { ListNavigation, ListResults } from "@/components/portal/list-navigation";
import { ListFilter } from "@/components/portal/admin/list-filter";
import { CompanyStatusBadge } from "@/components/portal/admin/status-badges";
import { SubCustomerExplainer } from "@/components/portal/admin/sub-customer-explainer";
import { firstParam, listSubCustomers, searchKey } from "@/components/portal/admin/data";

export const metadata: Metadata = { title: "Unterkunden" };

const PAGE_SIZE = 25;

const STATUS_FILTERS = [
  { value: "", label: "Alle Unterkunden" },
  { value: "aktiv", label: "Nur aktive" },
  { value: "deaktiviert", label: "Nur deaktivierte" },
];

/** Ganze Zeile klickbar: Der Namens-Link spannt sich über die Zeile (tr ist relativ positioniert). */
const STRETCHED_LINK =
  "outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-600";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SubCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePortalRootAdmin();
  const sp = await searchParams;

  const query = firstParam(sp.q).slice(0, 100);
  const statusParam = firstParam(sp.status);
  const status = statusParam === "aktiv" || statusParam === "deaktiviert" ? statusParam : "";

  const all = await listSubCustomers(ctx);
  const host = portalHost(ctx.root.slug);
  const description = `Filialen, Standorte oder Abteilungen von ${ctx.root.name} mit eigenen Benutzern und Tickets.`;

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="Unterkunden" description={description} />
        <div className="space-y-6">
          <EmptyState
            title="Noch keine Unterkunden angelegt"
            action={<ButtonLink href="/unterkunden/neu">Erste Unterkunde anlegen</ButtonLink>}
          >
            Brauchen Sie keine Unterteilung, ignorieren Sie diese Seite einfach. Alle Tickets laufen dann direkt unter{" "}
            {ctx.root.name}.
          </EmptyState>
          <SubCustomerExplainer rootName={ctx.root.name} portalHost={host} defaultOpen />
        </div>
      </>
    );
  }

  const key = searchKey(query);
  const filtered = all.filter((c) => {
    if (status === "aktiv" && !c.active) return false;
    if (status === "deaktiviert" && c.active) return false;
    if (!key) return true;
    return searchKey([c.name, c.city ?? "", c.zip ?? "", c.street ?? ""].join(" ")).includes(key);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(parsePage(sp.seite), pageCount);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inactiveCount = all.filter((c) => !c.active).length;
  const filterActive = Boolean(query || status);

  return (
    <>
      <PageHeader
        title="Unterkunden"
        description={description}
        meta={
          <span className="text-sm text-ink-muted">
            {all.length === 1 ? "1 Unterkunde" : `${all.length} Unterkunden`}
            {inactiveCount > 0 ? `, davon ${inactiveCount} deaktiviert` : ""}
          </span>
        }
        actions={<ButtonLink href="/unterkunden/neu">Unterkunde anlegen</ButtonLink>}
      />

      <ListNavigation>
        <ListFilter
          action="/unterkunden"
          query={query}
          searchLabel="Unterkunden durchsuchen"
          placeholder="Name oder Ort suchen"
          selects={[{ name: "status", label: "Status", value: status, options: STATUS_FILTERS }]}
          active={filterActive}
        />

        <ListResults>
          {rows.length === 0 ? (
            <EmptyState
              title="Keine passende Unterkunde gefunden"
              action={
                <ButtonLink href="/unterkunden" variant="secondary">
                  Alle Unterkunden zeigen
                </ButtonLink>
              }
            >
              Prüfen Sie die Schreibweise oder suchen Sie nach einem Teil des Namens, z. B. nur nach dem Ort.
            </EmptyState>
          ) : (
            <>
              <Table stack>
                <caption className="sr-only">Unterkunden von {ctx.root.name}</caption>
                <THead>
                  <tr>
                    <TH>Unterkunde</TH>
                    <TH className="text-right">Aktive Benutzer</TH>
                    <TH className="text-right">Offene Tickets</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {rows.map((c) => {
                    const address = [c.street, [c.zip, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "relative border-b border-line transition-colors last:border-0 hover:bg-brand-50/60",
                          !c.active && "bg-mist/60",
                        )}
                      >
                        <TD>
                          <span className="block min-w-0">
                            <Link
                              href={`/unterkunden/${c.id}`}
                              className={cn("font-semibold text-ink hover:text-brand-700", STRETCHED_LINK)}
                            >
                              {c.name}
                            </Link>
                            {address ? <span className="mt-0.5 block text-xs text-ink-muted">{address}</span> : null}
                          </span>
                        </TD>
                        <TD label="Aktive Benutzer" className="text-right tabular-nums">
                          {c.activeUsers}
                        </TD>
                        <TD label="Offene Tickets" className="text-right tabular-nums">
                          {c.openTickets > 0 ? (
                            <Link
                              href={`/tickets?firma=${c.id}`}
                              className="relative z-10 font-semibold text-brand-700 hover:underline"
                              aria-label={`${c.openTickets} offene Tickets von ${c.name} ansehen`}
                            >
                              {c.openTickets}
                            </Link>
                          ) : (
                            <span className="text-ink-muted">0</span>
                          )}
                        </TD>
                        <TD label="Status">
                          <CompanyStatusBadge active={c.active} />
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination
                page={page}
                pageCount={pageCount}
                basePath="/unterkunden"
                baseQuery={{ q: query || undefined, status: status || undefined }}
              />
            </>
          )}
        </ListResults>
      </ListNavigation>

      <SubCustomerExplainer rootName={ctx.root.name} portalHost={host} className="mt-10" />
    </>
  );
}

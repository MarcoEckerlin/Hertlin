import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { ListFilters, ListResults, ListSearchForm } from "@/components/admin/companies/list-filters";
import { aboveRowLinkClass, cleanId, firstParam, rowLinkClass } from "@/components/admin/companies/list-tools";
import { requireStaff } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { CUSTOMER_ROLES, OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { portalHost, portalUrl } from "@/lib/hosts";

export const metadata: Metadata = { title: "Kunden" };

const PAGE_SIZE = 50;

const STATUS_FILTERS = [
  { key: "", label: "Alle" },
  { key: "aktiv", label: "Aktiv" },
  { key: "deaktiviert", label: "Deaktiviert" },
] as const;
type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

/** Filterwert „ohne Standort“ (Query-Parameter standort) */
const NO_LOCATION = "ohne";

/** standort: "" = alle, "ohne" oder die ID eines Standorts */
type Filters = { status: StatusKey; q: string; standort: string };

function filterHref(filters: Filters, change: Partial<Filters>): string {
  const f = { ...filters, ...change };
  const params = new URLSearchParams();
  if (f.status) params.set("status", f.status);
  if (f.standort) params.set("standort", f.standort);
  if (f.q) params.set("q", f.q);
  const s = params.toString();
  return s ? `/admin/kunden?${s}` : "/admin/kunden";
}

type LocationRef = { id: string; name: string } | null;

/** Standort des Firmenkunden, darunter abweichende Standorte seiner Unterkunden. */
function LocationCell({ company }: { company: { location: LocationRef; children: { location: LocationRef }[] } }) {
  const others = [
    ...new Map(
      company.children
        .map((child) => child.location)
        .filter((l): l is { id: string; name: string } => l !== null && l.id !== company.location?.id)
        .map((l) => [l.id, l.name]),
    ).values(),
  ];
  return (
    <span>
      {company.location ? <span className="text-ink">{company.location.name}</span> : <span className="text-ink-muted">–</span>}
      {others.length > 0 ? <span className="block text-xs text-ink-muted">Unterkunden: {others.join(", ")}</span> : null}
    </span>
  );
}

function Count({ value }: { value: number }) {
  return <span className={value === 0 ? "text-ink-muted" : "font-semibold text-ink"}>{value}</span>;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const sp = await searchParams;

  const statusParam = firstParam(sp.status);
  const standortParam = firstParam(sp.standort);
  const filters: Filters = {
    status: STATUS_FILTERS.find((f) => f.key === statusParam)?.key ?? "",
    q: firstParam(sp.q).slice(0, 80),
    standort: standortParam === NO_LOCATION ? NO_LOCATION : (cleanId(standortParam) ?? ""),
  };
  const page = parsePage(sp.seite);

  // Alles außer dem Status – daraus zählen die Reiter
  const base: Prisma.CompanyWhereInput[] = [{ parentId: null }];
  // Ein Firmenkunde zählt zu einem Standort, wenn er selbst oder eine seiner Unterkunden dort betreut wird
  if (filters.standort === NO_LOCATION) base.push({ locationId: null });
  else if (filters.standort) {
    base.push({ OR: [{ locationId: filters.standort }, { children: { some: { locationId: filters.standort } } }] });
  }
  if (filters.q) {
    base.push({
      OR: [
        { name: { contains: filters.q } },
        { customerNumber: { contains: filters.q } },
        { slug: { contains: filters.q.toLowerCase() } },
        { city: { contains: filters.q } },
        { email: { contains: filters.q } },
        // Treffer in Unterkunden zeigen den Firmenkunden
        { children: { some: { name: { contains: filters.q } } } },
        { children: { some: { customerNumber: { contains: filters.q } } } },
      ],
    });
  }
  const and = [...base];
  if (filters.status === "aktiv") and.push({ active: true });
  if (filters.status === "deaktiviert") and.push({ active: false });
  const where: Prisma.CompanyWhereInput = { AND: and };

  const [total, companies, anyCompany, locations, statusGroups] = await Promise.all([
    db.company.count({ where }),
    db.company.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        customerNumber: true,
        city: true,
        active: true,
        location: { select: { id: true, name: true } },
        children: { select: { id: true, location: { select: { id: true, name: true } } } },
      },
    }),
    db.company.count({ where: { parentId: null }, take: 1 }),
    db.location.findMany({
      orderBy: [{ active: "desc" }, { isMain: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, active: true },
    }),
    db.company.groupBy({ by: ["active"], where: { AND: base }, _count: { _all: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeCount = statusGroups.find((g) => g.active)?._count._all ?? 0;
  const inactiveCount = statusGroups.find((g) => !g.active)?._count._all ?? 0;
  const statusCounts: Record<StatusKey, number> = {
    "": activeCount + inactiveCount,
    aktiv: activeCount,
    deaktiviert: inactiveCount,
  };

  // Zahlen je Firmenkunde inkl. Unterkunden
  const rootOf = new Map<string, string>();
  for (const c of companies) {
    rootOf.set(c.id, c.id);
    for (const child of c.children) rootOf.set(child.id, c.id);
  }
  const companyIds = [...rootOf.keys()];
  const [userGroups, ticketGroups] = companyIds.length
    ? await Promise.all([
        db.user.groupBy({
          by: ["companyId"],
          where: { companyId: { in: companyIds }, active: true, role: { in: [...CUSTOMER_ROLES] } },
          _count: { _all: true },
        }),
        db.ticket.groupBy({
          by: ["companyId"],
          where: { companyId: { in: companyIds }, status: { in: [...OPEN_STATUSES] } },
          _count: { _all: true },
        }),
      ])
    : [[], []];
  const activeUsers = new Map<string, number>();
  const openTickets = new Map<string, number>();
  for (const g of userGroups) {
    const root = g.companyId ? rootOf.get(g.companyId) : undefined;
    if (root) activeUsers.set(root, (activeUsers.get(root) ?? 0) + g._count._all);
  }
  for (const g of ticketGroups) {
    const root = g.companyId ? rootOf.get(g.companyId) : undefined;
    if (root) openTickets.set(root, (openTickets.get(root) ?? 0) + g._count._all);
  }

  const filtered = filters.status !== "" || filters.q !== "" || filters.standort !== "";
  // Standortspalte und -filter erst ab mehreren Standorten (oder wenn ein Standortfilter in der Adresse steht)
  const showLocations = locations.length > 1 || filters.standort !== "";

  return (
    <div>
      <PageHeader
        title="Kunden"
        description="Firmenkunden mit eigenem Kundenportal. Unterkunden und Benutzer stehen beim jeweiligen Kunden."
        actions={isAdmin ? <ButtonLink href="/admin/kunden/neu">Firmenkunde anlegen</ButtonLink> : null}
      />

      <ListFilters>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SegmentedTabs
            label="Status"
            tabs={STATUS_FILTERS.map((f) => ({
              href: filterHref(filters, { status: f.key }),
              label: f.label,
              active: filters.status === f.key,
              count: statusCounts[f.key],
            }))}
          />
          <ListSearchForm
            action="/admin/kunden"
            id="kunden-suche"
            value={filters.q}
            label="Kunden durchsuchen"
            placeholder="Name, Kundennummer, Kürzel oder Ort"
            keep={{ status: filters.status || undefined }}
          >
            {showLocations ? (
              <div className="w-full sm:w-52">
                <label htmlFor="kunden-standort" className="sr-only">
                  Standort
                </label>
                <Select id="kunden-standort" name="standort" defaultValue={filters.standort} className="h-9 text-sm">
                  <option value="">Alle Standorte</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.active ? l.name : `${l.name} (deaktiviert)`}
                    </option>
                  ))}
                  <option value={NO_LOCATION}>Ohne Standort</option>
                </Select>
              </div>
            ) : null}
          </ListSearchForm>
        </div>

        <ListResults>
          {companies.length === 0 ? (
            anyCompany === 0 ? (
              <EmptyState
                title="Noch keine Firmenkunden"
                action={isAdmin ? <ButtonLink href="/admin/kunden/neu">Ersten Firmenkunden anlegen</ButtonLink> : null}
              >
                {isAdmin
                  ? "Legen Sie einen Firmenkunden an. Er bekommt eine eigene Portal-Adresse, unter der sich seine Mitarbeiter anmelden."
                  : "Firmenkunden legt ein Administrator an."}
              </EmptyState>
            ) : (
              <EmptyState
                title="Keine Kunden für diese Auswahl"
                action={
                  filtered ? (
                    <ButtonLink href="/admin/kunden" variant="secondary">
                      Alle Kunden anzeigen
                    </ButtonLink>
                  ) : null
                }
              >
                {filters.q
                  ? `Zu „${filters.q}“ gibt es keinen Kunden. Prüfen Sie die Schreibweise.`
                  : "Ändern Sie den Filter oben."}
              </EmptyState>
            )
          ) : (
            <>
              <Table stack>
                <THead>
                  <tr>
                    <TH>Firmenkunde</TH>
                    <TH>Kundenportal</TH>
                    {showLocations ? <TH>Standort</TH> : null}
                    <TH className="text-right">Unterkunden</TH>
                    <TH className="text-right">Aktive Benutzer</TH>
                    <TH className="text-right">Offene Tickets</TH>
                  </tr>
                </THead>
                <tbody>
                  {companies.map((c) => {
                    const open = openTickets.get(c.id) ?? 0;
                    return (
                      <TR key={c.id} className={cn("relative", !c.active && "bg-mist/60")}>
                        <TD className="min-w-[13rem]">
                          <span className="min-w-0">
                            <Link
                              href={`/admin/kunden/${c.id}`}
                              className={cn("font-semibold break-words text-ink hover:underline", rowLinkClass)}
                            >
                              {c.name}
                            </Link>
                            {!c.active ? (
                              <Badge tone="gray" className="ml-2 align-middle">
                                Deaktiviert
                              </Badge>
                            ) : null}
                            {c.customerNumber || c.city ? (
                              <span className="block text-xs text-ink-muted">
                                {[c.customerNumber, c.city].filter(Boolean).join(" · ")}
                              </span>
                            ) : null}
                          </span>
                        </TD>
                        <TD label="Kundenportal" className="whitespace-nowrap">
                          {c.slug ? (
                            <a
                              href={portalUrl(c.slug, "/login")}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn("text-brand-700 hover:underline", aboveRowLinkClass)}
                            >
                              {portalHost(c.slug)}
                            </a>
                          ) : (
                            <span className="text-ink-muted">–</span>
                          )}
                        </TD>
                        {showLocations ? (
                          <TD label="Standort" className="min-w-[9rem]">
                            <LocationCell company={c} />
                          </TD>
                        ) : null}
                        <TD label="Unterkunden" className="text-right tabular-nums">
                          <Count value={c.children.length} />
                        </TD>
                        <TD label="Aktive Benutzer" className="text-right tabular-nums">
                          <Count value={activeUsers.get(c.id) ?? 0} />
                        </TD>
                        <TD label="Offene Tickets" className="text-right tabular-nums">
                          {open > 0 ? (
                            <Link
                              href={`/admin/tickets?kunde=${c.id}`}
                              className={cn("font-semibold text-brand-700 hover:underline", aboveRowLinkClass)}
                              aria-label={`Offene Tickets von ${c.name}: ${open}`}
                            >
                              {open}
                            </Link>
                          ) : (
                            <Count value={0} />
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination
                page={Math.min(page, pageCount)}
                pageCount={pageCount}
                basePath="/admin/kunden"
                baseQuery={{
                  status: filters.status || undefined,
                  standort: filters.standort || undefined,
                  q: filters.q || undefined,
                }}
              />
            </>
          )}
        </ListResults>
      </ListFilters>
    </div>
  );
}

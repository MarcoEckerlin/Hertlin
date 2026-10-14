import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalAdmin } from "@/lib/auth";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { RoleBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TD, TH, THead, Table } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { Disclosure } from "@/components/portal/disclosure";
import { ListNavigation, ListResults } from "@/components/portal/list-navigation";
import { ListFilter, type FilterSelect } from "@/components/portal/admin/list-filter";
import { adminRoleDescription } from "@/components/portal/admin/role-choice";
import { UserStatusBadge } from "@/components/portal/admin/status-badges";
import { accessStatus } from "@/components/portal/admin/types";
import {
  cleanId,
  firstParam,
  listManageableUsers,
  manageableCompanies,
  searchKey,
  type PortalUserRow,
} from "@/components/portal/admin/data";

export const metadata: Metadata = { title: "Benutzer" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_FILTERS = [
  { value: "", label: "Alle Status" },
  { value: "aktiv", label: "Aktiv" },
  { value: "eingeladen", label: "Einladung offen" },
  { value: "deaktiviert", label: "Deaktiviert" },
];

const STATUS_BY_FILTER = { aktiv: "ACTIVE", eingeladen: "INVITED", deaktiviert: "INACTIVE" } as const;

/** Ganze Zeile klickbar: Der Namens-Link spannt sich über die Zeile (tr ist relativ positioniert). */
const STRETCHED_LINK =
  "outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-600";

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePortalAdmin();
  const sp = await searchParams;

  const companies = await manageableCompanies(ctx);
  const hasSubCustomers = ctx.isRootAdmin && companies.some((c) => !c.isRoot);

  const query = firstParam(sp.q).slice(0, 100);
  const statusParam = firstParam(sp.status);
  const status = Object.hasOwn(STATUS_BY_FILTER, statusParam) ? (statusParam as keyof typeof STATUS_BY_FILTER) : "";
  const firmaParam = cleanId(sp.firma);
  const firma = hasSubCustomers && companies.some((c) => c.id === firmaParam) ? firmaParam : null;

  const allUsers = await listManageableUsers(ctx);
  const key = searchKey(query);
  const users = allUsers.filter((u) => {
    if (firma && u.companyId !== firma) return false;
    if (status && accessStatus(u, u.invited) !== STATUS_BY_FILTER[status]) return false;
    if (!key) return true;
    return searchKey([u.name, u.email, u.position ?? ""].join(" ")).includes(key);
  });

  const groups = companies
    .map((company) => ({ company, users: users.filter((u) => u.companyId === company.id) }))
    .filter((g) => g.users.length > 0);

  const openInvites = allUsers.filter((u) => u.active && u.invited).length;
  const filterActive = Boolean(query || status || firma);
  const ownArea = ctx.isRootAdmin ? `${ctx.root.name}${hasSubCustomers ? " und Unterkunden" : ""}` : ctx.company.name;

  const selects: FilterSelect[] = [{ name: "status", label: "Status", value: status, options: STATUS_FILTERS }];
  if (hasSubCustomers) {
    selects.push({
      name: "firma",
      label: "Firma oder Unterkunde",
      value: firma ?? "",
      options: [{ value: "", label: "Alle Firmen" }, ...companies.map((c) => ({ value: c.id, label: c.name }))],
    });
  }

  return (
    <>
      <PageHeader
        title="Benutzer"
        description={`Zugänge zum Kundenportal für ${ownArea}.`}
        meta={
          <span className="text-sm text-ink-muted">
            {allUsers.length === 1 ? "1 Benutzer" : `${allUsers.length} Benutzer`}
            {openInvites > 0 ? `, ${openInvites} ${openInvites === 1 ? "Einladung" : "Einladungen"} offen` : ""}
          </span>
        }
        actions={<ButtonLink href={firma ? `/benutzer/neu?firma=${firma}` : "/benutzer/neu"}>Benutzer anlegen</ButtonLink>}
      />

      <ListNavigation>
        <ListFilter
          action="/benutzer"
          query={query}
          searchLabel="Benutzer durchsuchen"
          placeholder="Name, E-Mail oder Position"
          selects={selects}
          active={filterActive}
        />

        <ListResults>
          {groups.length === 0 ? (
            <EmptyState
              title={filterActive ? "Kein passender Benutzer gefunden" : "Noch keine Benutzer"}
              action={
                filterActive ? (
                  <ButtonLink href="/benutzer" variant="secondary">
                    Alle Benutzer zeigen
                  </ButtonLink>
                ) : (
                  <ButtonLink href="/benutzer/neu">Ersten Benutzer anlegen</ButtonLink>
                )
              }
            >
              {filterActive
                ? "Prüfen Sie die Schreibweise oder lockern Sie die Filter."
                : "Legen Sie die Kolleginnen und Kollegen an, die Störungen melden oder Anfragen stellen sollen. Sie bekommen eine Einladung per E-Mail."}
            </EmptyState>
          ) : (
            <div className="space-y-8">
              {groups.map(({ company, users: groupUsers }) => (
                <section key={company.id} aria-labelledby={`gruppe-${company.id}`} className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 id={`gruppe-${company.id}`} className="text-lg font-bold tracking-tight text-ink">
                        {company.name}
                      </h2>
                      <span className="text-sm text-ink-muted">
                        {company.isRoot ? "Firmenkunde" : "Unterkunde"} · {groupUsers.length} Benutzer
                      </span>
                    </div>
                    {!company.isRoot && ctx.isRootAdmin ? (
                      <Link href={`/unterkunden/${company.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                        Unterkunde öffnen
                      </Link>
                    ) : null}
                  </div>
                  {!company.active ? (
                    <Alert tone="warning">
                      {company.name} ist deaktiviert. Die Benutzer dort können sich zurzeit nicht anmelden.
                    </Alert>
                  ) : null}
                  <UserTable users={groupUsers} currentUserId={ctx.user.id} caption={`Benutzer von ${company.name}`} />
                </section>
              ))}
            </div>
          )}
        </ListResults>
      </ListNavigation>

      <Disclosure
        summary="Rollen und Status erklärt"
        className="mt-10 rounded-2xl border border-line bg-mist px-5 py-4 sm:px-6"
        summaryClassName="text-base font-bold text-ink"
      >
        <dl className="mt-4 grid gap-x-8 gap-y-4 pb-1 text-sm md:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">{ROLE_LABELS.CUSTOMER_ADMIN}</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-soft">
              {ctx.isRootAdmin
                ? `Beim Firmenkunden: ${ROLE_DESCRIPTIONS.CUSTOMER_ADMIN}${hasSubCustomers ? ` Bei einer Unterkunde: ${adminRoleDescription({ isRoot: false })}` : ""}`
                : adminRoleDescription({ isRoot: false, companyName: ctx.company.name })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">{ROLE_LABELS.CUSTOMER_USER}</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-soft">{ROLE_DESCRIPTIONS.CUSTOMER_USER}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Einladung offen</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-soft">
              Die Person hat ihr Passwort noch nicht festgelegt. Die Einladung ist 7 Tage gültig; auf der Seite des
              Benutzers können Sie sie erneut senden.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Deaktiviert</dt>
            <dd className="mt-0.5 leading-relaxed text-ink-soft">
              Kein Zugriff mehr aufs Kundenportal. Tickets und Nachrichten bleiben erhalten – deshalb lassen sich Benutzer
              nicht löschen.
            </dd>
          </div>
        </dl>
      </Disclosure>
    </>
  );
}

/** Benutzerliste: Name mit E-Mail darunter; auf dem Handy wird jede Zeile zur Karte. */
function UserTable({ users, currentUserId, caption }: { users: PortalUserRow[]; currentUserId: string; caption: string }) {
  return (
    // Feste Spaltenbreiten, damit die Tabellen der einzelnen Firmen untereinander bündig stehen
    <Table stack className="sm:table-fixed">
      <caption className="sr-only">{caption}</caption>
      <THead>
        <tr>
          <TH>Name</TH>
          <TH className="w-56">Rolle</TH>
          <TH className="w-40">Status</TH>
          <TH className="w-48">Letzte Anmeldung</TH>
        </tr>
      </THead>
      <tbody>
        {users.map((u) => (
          <tr
            key={u.id}
            className={cn(
              "relative border-b border-line transition-colors last:border-0 hover:bg-brand-50/60",
              !u.active && "bg-mist/60",
            )}
          >
            <TD>
              <span className="block min-w-0">
                <Link href={`/benutzer/${u.id}`} className={cn("font-semibold text-ink hover:text-brand-700", STRETCHED_LINK)}>
                  {u.name}
                </Link>
                {u.id === currentUserId ? <span className="ml-1.5 text-xs font-semibold text-ink-muted">(Sie)</span> : null}
                <span className="mt-0.5 block text-xs text-ink-muted [overflow-wrap:anywhere]">
                  {[u.email, u.position].filter(Boolean).join(" · ")}
                </span>
              </span>
            </TD>
            <TD label="Rolle">
              <RoleBadge role={u.role} />
            </TD>
            <TD label="Status">
              <UserStatusBadge status={accessStatus(u, u.invited)} />
            </TD>
            <TD label="Letzte Anmeldung" className="whitespace-nowrap">
              {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="text-ink-muted">noch nie</span>}
            </TD>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, PriorityBadge, RoleBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { FlashToast } from "@/components/ui/toaster";
import { Detail, DetailList, Missing } from "@/components/admin/companies/detail-list";
import { aboveRowLinkClass, cleanId, firstParam, rowLinkClass } from "@/components/admin/companies/list-tools";
import { AccessBadge, CompanyActiveBadge } from "@/components/admin/companies/status-badges";
import { RecentCallsCard, recentCallSelect } from "@/components/admin/companies/recent-calls-card";
import { InvoiceStatusBadge } from "@/components/admin/invoices/invoice-badges";
import { getStaffUser, requireStaff } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { CUSTOMER_ROLES, OPEN_STATUSES } from "@/lib/constants";
import { getCompanyCostSummary } from "@/lib/costs";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatInquiryNumber, formatMoney, formatRelative, formatTicketNumber } from "@/lib/format";
import { portalHost, portalUrl } from "@/lib/hosts";
import { billingAddressLines } from "@/lib/invoices/recipients";

/** Titel mit Firmennamen, damit mehrere offene Kunden-Tabs unterscheidbar sind */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const staff = await getStaffUser();
  const id = cleanId((await params).id);
  const company = staff && id ? await db.company.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: company ? `${company.name} | Kunden` : "Kunde" };
}

/** Reiter der Kundenseite (Query-Parameter tab); „uebersicht“ steht nicht in der Adresse */
const TABS = ["uebersicht", "tickets", "benutzer", "abrechnung"] as const;
type TabKey = (typeof TABS)[number];

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function Count({ value }: { value: number }) {
  return <span className={value === 0 ? "text-ink-muted" : "font-semibold text-ink"}>{value}</span>;
}

type TicketRow = {
  id: number;
  subject: string;
  status: string;
  priority?: string;
  updatedAt: Date;
  company: { name: string; parentId: string | null } | null;
  assignee?: { name: string } | null;
};

/** Ticket als Listenzeile: ganze Zeile klickbar, Status rechts (mobil unter dem Betreff). */
function TicketList({ tickets, showCompany }: { tickets: TicketRow[]; showCompany: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {tickets.map((t) => {
        const meta = [
          formatTicketNumber(t.id),
          showCompany && t.company?.parentId ? t.company.name : null,
          t.assignee !== undefined ? (t.assignee ? `bei ${t.assignee.name}` : "nicht zugewiesen") : null,
        ].filter(Boolean);
        const urgent = t.priority === "HIGH" || t.priority === "CRITICAL";
        return (
          <li key={t.id} className="relative flex items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-50/50 sm:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <Link
                  href={`/admin/tickets/${t.id}`}
                  className={cn("font-semibold break-words text-ink hover:underline", rowLinkClass)}
                >
                  {t.subject}
                </Link>
                <p className="text-xs text-ink-muted">
                  {meta.join(" · ")} ·{" "}
                  <time dateTime={t.updatedAt.toISOString()} title={formatDateTime(t.updatedAt)}>
                    {formatRelative(t.updatedAt)}
                  </time>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {urgent && t.priority ? <PriorityBadge priority={t.priority} /> : null}
                <StatusBadge status={t.status} audience="staff" />
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </li>
        );
      })}
    </ul>
  );
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const id = cleanId((await params).id);
  if (!id) notFound();
  const sp = await searchParams;
  const tabParam = firstParam(sp.tab);
  let tab: TabKey = (TABS as readonly string[]).includes(tabParam) ? (tabParam as TabKey) : "uebersicht";
  // Abrechnung sehen nur Administratoren
  if (tab === "abrechnung" && !isAdmin) tab = "uebersicht";

  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      customerNumber: true,
      street: true,
      zip: true,
      city: true,
      phone: true,
      email: true,
      internalNote: true,
      active: true,
      createdAt: true,
      billingEmail: true,
      billingName: true,
      billingStreet: true,
      billingZip: true,
      billingCity: true,
      vatId: true,
      invoiceSeparately: true,
      location: { select: { id: true, name: true, city: true, active: true } },
      parent: {
        select: {
          id: true,
          name: true,
          slug: true,
          active: true,
          vatId: true,
          location: { select: { id: true, name: true, city: true, active: true } },
        },
      },
      children: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, city: true, customerNumber: true, active: true },
      },
      inquiries: { orderBy: { id: "asc" }, select: { id: true } },
    },
  });
  if (!company) notFound();

  const isSub = company.parentId !== null;
  const rootId = company.parent?.id ?? company.id;
  const slug = company.parent?.slug ?? company.slug;
  const treeIds = isSub ? [company.id] : [company.id, ...company.children.map((c) => c.id)];
  const ticketWhere = { companyId: { in: treeIds } };
  const openWhere = { ...ticketWhere, status: { in: [...OPEN_STATUSES] } };
  const hasChildren = company.children.length > 0;
  const showCompany = !isSub && hasChildren;

  const ticketSelect = {
    id: true,
    subject: true,
    status: true,
    priority: true,
    updatedAt: true,
    company: { select: { name: true, parentId: true } },
    assignee: { select: { name: true } },
  } as const;

  // Zahlen für Reiter und Hinweise – immer
  const [openCount, rootAdmins] = await Promise.all([
    db.ticket.count({ where: openWhere }),
    isSub ? Promise.resolve(1) : db.user.count({ where: { companyId: company.id, active: true, role: "CUSTOMER_ADMIN" } }),
  ]);

  // Daten je Reiter
  const overview =
    tab === "uebersicht"
      ? await Promise.all([
          db.ticket.findMany({ where: openWhere, orderBy: { updatedAt: "desc" }, take: 5, select: ticketSelect }),
          db.phoneCall.findMany({ where: ticketWhere, orderBy: { startedAt: "desc" }, take: 5, select: recentCallSelect }),
          db.phoneCall.count({ where: ticketWhere }),
          isAdmin ? getCompanyCostSummary(treeIds) : Promise.resolve(null),
        ]).then(([openTickets, recentCalls, callTotal, costs]) => ({ openTickets, recentCalls, callTotal, costs }))
      : null;

  const tickets =
    tab === "tickets"
      ? await Promise.all([
          db.ticket.findMany({ where: openWhere, orderBy: { updatedAt: "desc" }, take: 25, select: ticketSelect }),
          db.ticket.findMany({
            where: { ...ticketWhere, status: { notIn: [...OPEN_STATUSES] } },
            orderBy: { updatedAt: "desc" },
            take: 5,
            select: {
              id: true,
              subject: true,
              status: true,
              updatedAt: true,
              company: { select: { name: true, parentId: true } },
            },
          }),
          db.ticket.count({ where: ticketWhere }),
        ]).then(([open, done, total]) => ({ open, done, total }))
      : null;

  const people =
    tab === "benutzer"
      ? await Promise.all([
          db.user.findMany({
            where: { companyId: { in: treeIds }, role: { in: [...CUSTOMER_ROLES] } },
            orderBy: [{ active: "desc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              position: true,
              role: true,
              active: true,
              lastLoginAt: true,
              company: { select: { id: true, name: true, parentId: true } },
            },
          }),
          db.user.findMany({ where: { companyId: { in: treeIds }, passwordHash: null }, select: { id: true } }),
          isSub
            ? Promise.resolve([])
            : db.user.groupBy({
                by: ["companyId"],
                where: { companyId: { in: treeIds }, active: true, role: { in: [...CUSTOMER_ROLES] } },
                _count: { _all: true },
              }),
          isSub ? Promise.resolve([]) : db.ticket.groupBy({ by: ["companyId"], where: openWhere, _count: { _all: true } }),
        ]).then(([users, invitedIds, userGroups, ticketGroups]) => ({
          users,
          invited: new Set(invitedIds.map((u) => u.id)),
          usersByCompany: new Map(userGroups.map((g) => [g.companyId, g._count._all])),
          openByCompany: new Map(ticketGroups.map((g) => [g.companyId, g._count._all])),
        }))
      : null;

  const billing =
    tab === "abrechnung"
      ? await Promise.all([
          getCompanyCostSummary(treeIds),
          db.invoice.findMany({
            where: { companyId: { in: treeIds } },
            orderBy: [{ year: "desc" }, { sequence: "desc" }],
            take: 10,
            select: { id: true, number: true, kind: true, status: true, issueDate: true, dueDate: true, grossCents: true },
          }),
          db.invoice.count({ where: { companyId: { in: treeIds } } }),
        ]).then(([costs, invoices, invoiceTotal]) => ({ costs, invoices, invoiceTotal }))
      : null;

  const portalBlocked = !company.active || (company.parent ? !company.parent.active : false);
  const newUserHref = `/admin/kunden/${rootId}/benutzer/neu${isSub ? `?firma=${company.id}` : ""}`;
  const allTicketsHref = `/admin/tickets?kunde=${company.id}&ansicht=alle`;
  const tabHref = (key: TabKey) =>
    key === "uebersicht" ? `/admin/kunden/${company.id}` : `/admin/kunden/${company.id}?tab=${key}`;

  const tabs = [
    { href: tabHref("uebersicht"), label: "Übersicht", active: tab === "uebersicht" },
    { href: tabHref("tickets"), label: "Tickets", active: tab === "tickets", count: openCount },
    { href: tabHref("benutzer"), label: isSub ? "Benutzer" : "Unterkunden & Benutzer", active: tab === "benutzer" },
    ...(isAdmin ? [{ href: tabHref("abrechnung"), label: "Abrechnung", active: tab === "abrechnung" }] : []),
  ];

  return (
    <div>
      <FlashToast
        param="angelegt"
        value={firstParam(sp.angelegt) || undefined}
        messages={{ "1": isSub ? "Unterkunde angelegt." : "Firmenkunde angelegt." }}
      />
      <PageHeader
        breadcrumbs={[
          { label: "Kunden", href: "/admin/kunden" },
          ...(company.parent ? [{ label: company.parent.name, href: `/admin/kunden/${company.parent.id}` }] : []),
          { label: company.name },
        ]}
        title={<span className="break-words">{company.name}</span>}
        description={
          company.parent ? (
            <>
              Unterkunde von{" "}
              <Link href={`/admin/kunden/${company.parent.id}`} className="font-semibold text-brand-700 hover:underline">
                {company.parent.name}
              </Link>
              . Die Benutzer melden sich im Kundenportal des Firmenkunden an.
            </>
          ) : undefined
        }
        meta={
          <>
            <CompanyActiveBadge active={company.active} />
            {company.customerNumber ? (
              <span className="text-sm text-ink-muted">Kundennummer {company.customerNumber}</span>
            ) : null}
            {slug && !isSub ? (
              <a
                href={portalUrl(slug, "/login")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
              >
                {portalHost(slug)}
                <ExternalLink className="size-3.5" aria-hidden />
                <span className="sr-only">(öffnet in neuem Tab)</span>
              </a>
            ) : null}
          </>
        }
        actions={
          <>
            {isAdmin ? (
              <ButtonLink href={`/admin/kunden/${company.id}/bearbeiten`} variant="secondary">
                Bearbeiten
              </ButtonLink>
            ) : null}
            <ButtonLink href={`/admin/tickets/neu?firma=${company.id}`}>Ticket anlegen</ButtonLink>
          </>
        }
      />

      <div className="mb-6 space-y-3 empty:hidden">
        {!company.active ? (
          <Alert tone="warning" title={isSub ? "Unterkunde deaktiviert" : "Kunde deaktiviert – Kundenportal gesperrt"}>
            {isSub
              ? "Die Benutzer dieser Unterkunde können sich nicht anmelden."
              : "Niemand vom Kunden kann sich anmelden, auch nicht aus den Unterkunden."}
            {isAdmin ? (
              <>
                {" "}
                <Link href={`/admin/kunden/${company.id}/bearbeiten#status`} className="font-semibold underline">
                  Wieder aktivieren
                </Link>
              </>
            ) : null}
          </Alert>
        ) : company.parent && !company.parent.active ? (
          <Alert tone="warning" title="Firmenkunde deaktiviert">
            {company.parent.name} ist gesperrt. Solange kann sich auch hier niemand anmelden.
          </Alert>
        ) : null}
        {!isSub && company.active && rootAdmins === 0 ? (
          <Alert tone="info" title="Noch kein Hauptansprechpartner">
            Ohne aktiven Hauptansprechpartner kann beim Kunden niemand Benutzer oder Unterkunden verwalten.
            {isAdmin ? (
              <>
                {" "}
                <Link href={newUserHref} className="font-semibold underline">
                  Jetzt anlegen
                </Link>
              </>
            ) : null}
          </Alert>
        ) : null}
      </div>

      <SegmentedTabs label="Bereiche des Kunden" tabs={tabs} className="mb-6" />

      {/* Übersicht */}
      {overview ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <Card>
              <CardHeader
                title="Offene Tickets"
                description={
                  openCount === 0
                    ? "Zurzeit ist nichts offen."
                    : `${openCount === 1 ? "1 offenes Ticket" : `${openCount} offene Tickets`}${showCompany ? " inkl. Unterkunden" : ""}`
                }
                actions={
                  openCount > overview.openTickets.length ? (
                    <Link href={tabHref("tickets")} className="text-sm font-semibold text-brand-700 hover:underline">
                      Alle {openCount}
                    </Link>
                  ) : null
                }
              />
              {overview.openTickets.length > 0 ? (
                <TicketList tickets={overview.openTickets} showCompany={showCompany} />
              ) : (
                <CardBody>
                  <ButtonLink href={`/admin/tickets/neu?firma=${company.id}`} variant="secondary" size="sm">
                    Ticket anlegen
                  </ButtonLink>
                </CardBody>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Stammdaten"
                actions={
                  isAdmin ? (
                    <Link
                      href={`/admin/kunden/${company.id}/bearbeiten`}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Ändern
                    </Link>
                  ) : null
                }
              />
              <CardBody>
                <DetailList>
                  {!isSub ? (
                    <Detail label="Kundenportal">
                      {slug ? (
                        <a
                          href={portalUrl(slug, "/login")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-700 hover:underline"
                        >
                          {portalHost(slug)}
                        </a>
                      ) : (
                        <Missing />
                      )}
                      {portalBlocked ? <span className="block text-xs font-normal text-warning-ink">gesperrt</span> : null}
                    </Detail>
                  ) : null}
                  <Detail label="Anschrift">
                    {company.street || company.zip || company.city ? (
                      <>
                        {company.street ? <span className="block">{company.street}</span> : null}
                        <span className="block">{[company.zip, company.city].filter(Boolean).join(" ")}</span>
                      </>
                    ) : (
                      <Missing />
                    )}
                  </Detail>
                  <Detail label="Telefon">
                    {company.phone ? (
                      <a href={telHref(company.phone)} className="text-brand-700 hover:underline">
                        {company.phone}
                      </a>
                    ) : (
                      <Missing />
                    )}
                  </Detail>
                  <Detail label="E-Mail">
                    {company.email ? (
                      <a href={`mailto:${company.email}`} className="text-brand-700 hover:underline">
                        {company.email}
                      </a>
                    ) : (
                      <Missing />
                    )}
                  </Detail>
                  <LocationDetail company={company} />
                  <Detail label={isSub ? "Angelegt am" : "Kunde seit"}>{formatDate(company.createdAt)}</Detail>
                  {company.inquiries.length > 0 ? (
                    <Detail label="Anfrage">
                      {company.inquiries.map((i, idx) => (
                        <span key={i.id}>
                          {idx > 0 ? ", " : null}
                          <Link href={`/admin/anfragen/${i.id}`} className="text-brand-700 hover:underline">
                            {formatInquiryNumber(i.id)}
                          </Link>
                        </span>
                      ))}
                    </Detail>
                  ) : null}
                </DetailList>
              </CardBody>
            </Card>
          </div>

          <aside className="min-w-0 space-y-6">
            <Card>
              <CardHeader
                title="Interne Notiz"
                actions={
                  isAdmin ? (
                    <Link
                      href={`/admin/kunden/${company.id}/bearbeiten#notiz`}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Ändern
                    </Link>
                  ) : null
                }
              />
              <CardBody>
                {company.internalNote ? (
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink">{company.internalNote}</p>
                ) : (
                  <p className="text-sm text-ink-muted">Keine Notiz. Nur Hertlin sieht diesen Bereich, nie der Kunde.</p>
                )}
              </CardBody>
            </Card>

            {overview.costs ? (
              <Card className="relative transition-colors hover:border-brand-300">
                <CardBody className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={tabHref("abrechnung")} className={cn("text-sm font-semibold text-ink-muted", rowLinkClass)}>
                      Noch nicht abgerechnet
                    </Link>
                    <p className="mt-0.5 text-xl font-bold text-ink tabular-nums">{formatMoney(overview.costs.openCents)}</p>
                    <p className="text-xs text-ink-muted">
                      {overview.costs.openEntries === 1 ? "1 Position" : `${overview.costs.openEntries} Positionen`}
                      {showCompany ? " inkl. Unterkunden" : ""}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-ink-muted" aria-hidden />
                </CardBody>
              </Card>
            ) : null}

            <RecentCallsCard
              calls={overview.recentCalls}
              total={overview.callTotal}
              showCompany={showCompany}
              searchHref={`/admin/anrufe?zeitraum=alle&q=${encodeURIComponent(company.name.slice(0, 80))}`}
            />
          </aside>
        </div>
      ) : null}

      {/* Tickets */}
      {tickets ? (
        <div className="space-y-6">
          {tickets.open.length === 0 ? (
            <EmptyState
              title={tickets.total === 0 ? "Noch keine Tickets" : "Alles erledigt"}
              action={
                <ButtonLink href={`/admin/tickets/neu?firma=${company.id}`} variant="secondary" size="sm">
                  Ticket anlegen
                </ButtonLink>
              }
            >
              {tickets.total === 0
                ? "Tickets entstehen, wenn jemand vom Kunden im Portal eine Störung meldet oder Sie eines anlegen, z. B. nach einem Anruf."
                : "Zurzeit ist nichts offen."}
            </EmptyState>
          ) : (
            <Card>
              <CardHeader
                title="Offene Tickets"
                description={`${openCount === 1 ? "1 offenes Ticket" : `${openCount} offene Tickets`}${showCompany ? " inkl. Unterkunden" : ""}`}
                actions={
                  <ButtonLink href={allTicketsHref} variant="secondary" size="sm">
                    In der Ticketliste
                  </ButtonLink>
                }
              />
              <TicketList tickets={tickets.open} showCompany={showCompany} />
              {openCount > tickets.open.length ? (
                <p className="border-t border-line px-5 py-3 text-sm text-ink-muted sm:px-6">
                  Die {tickets.open.length} zuletzt bearbeiteten von {openCount}.{" "}
                  <Link href={`/admin/tickets?kunde=${company.id}`} className="font-semibold text-brand-700 hover:underline">
                    Alle offenen anzeigen
                  </Link>
                </p>
              ) : null}
            </Card>
          )}

          {tickets.done.length > 0 ? (
            <Card>
              <CardHeader
                title="Zuletzt erledigt"
                description={`${tickets.total === 1 ? "1 Ticket" : `${tickets.total} Tickets`} insgesamt`}
                actions={
                  <Link href={allTicketsHref} className="text-sm font-semibold text-brand-700 hover:underline">
                    Alle Tickets
                  </Link>
                }
              />
              <TicketList tickets={tickets.done} showCompany={showCompany} />
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Unterkunden und Benutzer */}
      {people ? (
        <div className="space-y-8">
          {!isSub ? (
            <section aria-labelledby="sub-heading" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="sub-heading" className="text-lg font-bold text-ink">
                    Unterkunden
                  </h2>
                  <p className="text-sm text-ink-muted">
                    Standorte, Tochterfirmen oder Abteilungen mit eigenen Benutzern im selben Portal.
                  </p>
                </div>
                {isAdmin ? (
                  <ButtonLink href={`/admin/kunden/${company.id}/unterkunden/neu`} variant="secondary" size="sm">
                    Unterkunde anlegen
                  </ButtonLink>
                ) : null}
              </div>
              {company.children.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line-strong bg-mist px-5 py-4 text-sm text-ink-soft">
                  Keine Unterkunden. Der Hauptansprechpartner kann sie auch selbst im Portal anlegen.
                </p>
              ) : (
                <Table stack className="min-w-[32rem]">
                  <THead>
                    <tr>
                      <TH>Unterkunde</TH>
                      <TH className="text-right">Aktive Benutzer</TH>
                      <TH className="text-right">Offene Tickets</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {company.children.map((c) => (
                      <TR key={c.id} className={cn("relative", !c.active && "bg-mist/60")}>
                        <TD>
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
                            {c.city || c.customerNumber ? (
                              <span className="block text-xs text-ink-muted">
                                {[c.customerNumber, c.city].filter(Boolean).join(" · ")}
                              </span>
                            ) : null}
                          </span>
                        </TD>
                        <TD label="Aktive Benutzer" className="text-right tabular-nums">
                          <Count value={people.usersByCompany.get(c.id) ?? 0} />
                        </TD>
                        <TD label="Offene Tickets" className="text-right tabular-nums">
                          <Count value={people.openByCompany.get(c.id) ?? 0} />
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          ) : null}

          <section aria-labelledby="users-heading" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="users-heading" className="text-lg font-bold text-ink">
                  Benutzer
                </h2>
                <UserSummary users={people.users} includesSubs={showCompany} />
              </div>
              {isAdmin ? (
                <ButtonLink href={newUserHref} variant="secondary" size="sm">
                  Benutzer anlegen
                </ButtonLink>
              ) : null}
            </div>
            {people.users.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong bg-mist px-5 py-4 text-sm text-ink-soft">
                {isAdmin
                  ? "Legen Sie einen Benutzer an. Er bekommt eine Einladung per E-Mail und legt sein Passwort selbst fest."
                  : "Benutzer legt ein Administrator oder der Hauptansprechpartner des Kunden an."}
              </p>
            ) : (
              <Table stack>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    {showCompany ? <TH>Firma</TH> : null}
                    <TH>Rolle</TH>
                    <TH>Zugang</TH>
                    <TH className="text-right">Letzte Anmeldung</TH>
                  </tr>
                </THead>
                <tbody>
                  {people.users.map((u) => (
                    <TR key={u.id} className={cn(isAdmin && "relative", !u.active && "text-ink-muted")}>
                      <TD className="min-w-[15rem]">
                        <span className="min-w-0">
                          {isAdmin ? (
                            <Link
                              href={`/admin/kunden/${rootId}/benutzer/${u.id}`}
                              className={cn("font-semibold break-words text-ink hover:underline", rowLinkClass)}
                            >
                              {u.name}
                            </Link>
                          ) : (
                            <span className="font-semibold break-words text-ink">{u.name}</span>
                          )}
                          {u.position ? <span className="text-xs text-ink-muted"> · {u.position}</span> : null}
                          <span className="block text-xs text-ink-muted">
                            <a
                              href={`mailto:${u.email}`}
                              className={cn("break-words hover:text-ink hover:underline", aboveRowLinkClass)}
                            >
                              {u.email}
                            </a>
                            {u.phone ? (
                              <>
                                {" · "}
                                <a
                                  href={telHref(u.phone)}
                                  className={cn("whitespace-nowrap hover:text-ink hover:underline", aboveRowLinkClass)}
                                >
                                  {u.phone}
                                </a>
                              </>
                            ) : null}
                          </span>
                        </span>
                      </TD>
                      {showCompany ? (
                        <TD label="Firma">
                          {u.company?.parentId ? u.company.name : <span className="text-ink-muted">Firmenkunde</span>}
                        </TD>
                      ) : null}
                      <TD label="Rolle">
                        <RoleBadge role={u.role} />
                      </TD>
                      <TD label="Zugang">
                        <AccessBadge active={u.active} invited={people.invited.has(u.id)} />
                      </TD>
                      <TD label="Letzte Anmeldung" className="text-right whitespace-nowrap">
                        {u.lastLoginAt ? (
                          <time dateTime={u.lastLoginAt.toISOString()} title={formatDateTime(u.lastLoginAt)}>
                            {formatRelative(u.lastLoginAt)}
                          </time>
                        ) : (
                          <span className="text-ink-muted">noch nie</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        </div>
      ) : null}

      {/* Abrechnung (nur Administratoren) */}
      {billing ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader
                title="Kosten"
                description={isSub ? "Nur diese Unterkunde, gesamter Zeitraum" : "Inkl. Unterkunden, gesamter Zeitraum"}
              />
              <CardBody className="space-y-4">
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-semibold text-ink-muted">Noch nicht abgerechnet</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink tabular-nums">{formatMoney(billing.costs.openCents)}</dd>
                    <dd className="text-xs text-ink-muted tabular-nums">
                      {billing.costs.openEntries === 1 ? "1 Position" : `${billing.costs.openEntries} Positionen`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-muted">Abgerechnet</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink tabular-nums">{formatMoney(billing.costs.billedCents)}</dd>
                    <dd className="text-xs text-ink-muted">
                      {billing.costs.lastPerformedAt
                        ? `letzte Leistung ${formatDate(billing.costs.lastPerformedAt)}`
                        : "noch keine Leistungen"}
                    </dd>
                  </div>
                </dl>
                <ButtonLink
                  href={`/admin/kosten/konto/${rootId}`}
                  variant={billing.costs.openEntries > 0 ? "primary" : "secondary"}
                  size="sm"
                >
                  {billing.costs.openEntries > 0 ? "Kosten ansehen und abrechnen" : "Kosten im Detail"}
                </ButtonLink>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Rechnungen"
                description={isSub ? "Nur diese Unterkunde" : hasChildren ? "Inkl. Unterkunden mit eigener Rechnung" : undefined}
                actions={
                  billing.invoiceTotal > billing.invoices.length ? (
                    <Link
                      href={`/admin/rechnungen?kunde=${company.id}`}
                      className="text-sm font-semibold text-brand-700 hover:underline"
                    >
                      Alle {billing.invoiceTotal}
                    </Link>
                  ) : null
                }
              />
              {billing.invoices.length === 0 ? (
                <CardBody>
                  <p className="text-sm text-ink-muted">Noch keine Rechnungen.</p>
                </CardBody>
              ) : (
                <ul className="divide-y divide-line">
                  {billing.invoices.map((inv) => (
                    <li
                      key={inv.id}
                      className="relative flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm transition-colors hover:bg-brand-50/50 sm:px-6"
                    >
                      <span className="min-w-0">
                        <Link
                          href={`/admin/rechnungen/${inv.id}`}
                          className={cn("font-semibold text-ink hover:underline", rowLinkClass)}
                        >
                          {inv.number}
                        </Link>
                        <span className="block text-xs text-ink-muted">{formatDate(inv.issueDate)}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-ink tabular-nums">{formatMoney(inv.grossCents)}</span>
                        <InvoiceStatusBadge invoice={inv} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card id="rechnungsdaten" className="scroll-mt-24">
            <CardHeader
              title="Rechnungsdaten"
              actions={
                <Link
                  href={`/admin/kunden/${company.id}/bearbeiten#rechnungsdaten`}
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  Ändern
                </Link>
              }
            />
            <CardBody>
              <BillingDetails company={company} isSub={isSub} />
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

type CompanyForDetails = {
  name: string;
  email: string | null;
  billingEmail: string | null;
  billingName: string | null;
  billingStreet: string | null;
  billingZip: string | null;
  billingCity: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  vatId: string | null;
  invoiceSeparately: boolean;
  location: { name: string; active: boolean } | null;
  parent: { name: string; vatId: string | null; location: { name: string; active: boolean } | null } | null;
};

/** Zuständiger Standort; eine Unterkunde ohne eigenen Standort übernimmt den des Firmenkunden. */
function LocationDetail({ company }: { company: CompanyForDetails }) {
  const location = company.location ?? company.parent?.location ?? null;
  const inherited = !company.location && Boolean(company.parent?.location);
  return (
    <Detail label="Standort">
      {location ? (
        <>
          {location.name}
          {!location.active ? <span className="font-normal text-ink-muted"> (deaktiviert)</span> : null}
          {inherited ? <span className="block text-xs font-normal text-ink-muted">vom Firmenkunden übernommen</span> : null}
        </>
      ) : (
        <Missing>kein bestimmter</Missing>
      )}
    </Detail>
  );
}

function BillingDetails({ company, isSub }: { company: CompanyForDetails; isSub: boolean }) {
  const billingAddress = billingAddressLines(company);
  const hasOwnBillingAddress = [company.billingStreet, company.billingZip, company.billingCity].some(Boolean);
  const billsSeparately = !isSub || company.invoiceSeparately;
  return (
    <DetailList>
      {isSub ? (
        <Detail label="Abrechnung">
          {company.invoiceSeparately ? "Eigene Rechnung" : `Über ${company.parent?.name ?? "den Firmenkunden"}`}
        </Detail>
      ) : null}
      {billsSeparately ? (
        <>
          <Detail label="Rechnungs-E-Mail">
            {company.billingEmail ? (
              company.billingEmail
            ) : company.email ? (
              <>
                {company.email}
                <span className="block text-xs font-normal text-ink-muted">E-Mail der Firma</span>
              </>
            ) : (
              <Missing>keine – Rechnungen nur als PDF</Missing>
            )}
          </Detail>
          <Detail label="Empfänger">
            {company.billingName ?? (isSub && company.parent ? `${company.parent.name}, ${company.name}` : company.name)}
            {billingAddress.length > 0 ? (
              billingAddress.map((line) => (
                <span key={line} className="block font-normal">
                  {line}
                </span>
              ))
            ) : (
              <span className="block text-xs font-normal text-danger-ink">Anschrift fehlt</span>
            )}
            {hasOwnBillingAddress ? (
              <span className="block text-xs font-normal text-ink-muted">abweichende Rechnungsanschrift</span>
            ) : null}
          </Detail>
          <Detail label="USt-IdNr.">
            {company.vatId ?? (isSub && company.parent?.vatId ? company.parent.vatId : <Missing />)}
          </Detail>
        </>
      ) : null}
    </DetailList>
  );
}

function UserSummary({ users, includesSubs }: { users: { active: boolean }[]; includesSubs: boolean }) {
  const active = users.filter((u) => u.active).length;
  return (
    <p className="text-sm text-ink-muted">
      {users.length === 0
        ? "Noch niemand hat einen Zugang."
        : `${active} aktiv${users.length > active ? `, ${users.length - active} deaktiviert` : ""}${includesSubs ? " · inkl. Unterkunden" : ""}`}
    </p>
  );
}

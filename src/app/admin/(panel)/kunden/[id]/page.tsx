import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PriorityBadge, RoleBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { Detail, DetailList, Missing } from "@/components/admin/companies/detail-list";
import { cleanId, firstParam } from "@/components/admin/companies/list-tools";
import { AccessBadge, CompanyActiveBadge } from "@/components/admin/companies/status-badges";
import { RecentCallsCard, recentCallSelect } from "@/components/admin/companies/recent-calls-card";
import { getStaffUser, requireStaff } from "@/lib/auth";
import { CUSTOMER_ROLES, OPEN_STATUSES } from "@/lib/constants";
import { getCompanyCostSummary } from "@/lib/costs";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatInquiryNumber, formatMoney, formatRelative, formatTicketNumber } from "@/lib/format";
import { portalHost, portalUrl } from "@/lib/hosts";

/** Titel mit Firmennamen, damit mehrere offene Kunden-Tabs unterscheidbar sind */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const staff = await getStaffUser();
  const id = cleanId((await params).id);
  const company = staff && id ? await db.company.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: company ? `${company.name} | Kunden` : "Kunde" };
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function Count({ value }: { value: number }) {
  return <span className={value === 0 ? "text-ink-muted" : "font-semibold text-ink"}>{value}</span>;
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
  const justCreated = firstParam(sp.angelegt) === "1";

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
      parent: { select: { id: true, name: true, slug: true, active: true } },
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
  const callWhere = { companyId: { in: treeIds } };

  const [
    users,
    invitedIds,
    openTickets,
    openCount,
    doneTickets,
    ticketTotal,
    userGroups,
    ticketGroups,
    costs,
    recentCalls,
    callTotal,
  ] = await Promise.all([
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
    db.ticket.findMany({
      where: { ...ticketWhere, status: { in: [...OPEN_STATUSES] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        updatedAt: true,
        company: { select: { name: true, parentId: true } },
        assignee: { select: { name: true } },
      },
    }),
    db.ticket.count({ where: { ...ticketWhere, status: { in: [...OPEN_STATUSES] } } }),
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
    isSub
      ? Promise.resolve([])
      : db.user.groupBy({
          by: ["companyId"],
          where: { companyId: { in: treeIds }, active: true, role: { in: [...CUSTOMER_ROLES] } },
          _count: { _all: true },
        }),
    isSub
      ? Promise.resolve([])
      : db.ticket.groupBy({
          by: ["companyId"],
          where: { ...ticketWhere, status: { in: [...OPEN_STATUSES] } },
          _count: { _all: true },
        }),
    // Kosten nur für Administratoren laden
    isAdmin ? getCompanyCostSummary(treeIds) : Promise.resolve(null),
    // Anrufe des Kunden (bei Firmenkunden inklusive Unterkunden)
    db.phoneCall.findMany({ where: callWhere, orderBy: { startedAt: "desc" }, take: 5, select: recentCallSelect }),
    db.phoneCall.count({ where: callWhere }),
  ]);

  const invited = new Set(invitedIds.map((u) => u.id));
  const usersByCompany = new Map(userGroups.map((g) => [g.companyId, g._count._all]));
  const openByCompany = new Map(ticketGroups.map((g) => [g.companyId, g._count._all]));
  const hasChildren = company.children.length > 0;
  const activeUsers = users.filter((u) => u.active).length;
  const rootAdmins = users.filter((u) => u.active && u.role === "CUSTOMER_ADMIN" && u.company?.id === company.id);
  const portalBlocked = !company.active || (company.parent ? !company.parent.active : false);

  const newUserHref = `/admin/kunden/${rootId}/benutzer/neu${isSub ? `?firma=${company.id}` : ""}`;
  const allTicketsHref = `/admin/tickets?kunde=${company.id}&ansicht=alle`;
  const address = [company.street, [company.zip, company.city].filter(Boolean).join(" ")].filter(Boolean);

  return (
    <div>
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
        {justCreated ? (
          <Alert tone="success" title={isSub ? "Unterkunde angelegt" : "Firmenkunde angelegt"}>
            {isSub
              ? "Legen Sie jetzt die Benutzer der Unterkunde an – oder überlassen Sie das dem Hauptansprechpartner im Portal."
              : "Legen Sie jetzt einen Hauptansprechpartner an. Er bekommt eine Einladung und kann danach selbst weitere Benutzer anlegen."}
          </Alert>
        ) : null}
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
        {!isSub && company.active && rootAdmins.length === 0 ? (
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Tickets */}
          <section aria-labelledby="tickets-heading" className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="tickets-heading" className="text-lg font-bold text-ink">
                  Offene Tickets
                </h2>
                <p className="text-sm text-ink-muted">
                  {openCount === 0
                    ? "Keine offenen Tickets"
                    : openCount === 1
                      ? "1 offenes Ticket"
                      : `${openCount} offene Tickets`}
                  {!isSub && hasChildren ? " inkl. Unterkunden" : ""}
                  {ticketTotal > 0 ? ` · ${ticketTotal} insgesamt` : ""}
                </p>
              </div>
              {ticketTotal > 0 ? (
                <ButtonLink href={allTicketsHref} variant="secondary" size="sm">
                  Alle Tickets
                </ButtonLink>
              ) : null}
            </div>
            {openTickets.length === 0 ? (
              <EmptyState
                title={ticketTotal === 0 ? "Noch keine Tickets" : "Alles erledigt"}
                action={
                  <ButtonLink href={`/admin/tickets/neu?firma=${company.id}`} variant="secondary" size="sm">
                    Ticket anlegen
                  </ButtonLink>
                }
              >
                {ticketTotal === 0
                  ? "Tickets entstehen, wenn jemand vom Kunden im Portal eine Störung meldet oder Sie eines anlegen, z. B. nach einem Anruf."
                  : "Zurzeit ist nichts offen."}
              </EmptyState>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Ticket</TH>
                    <TH>Betreff</TH>
                    <TH>Status</TH>
                    <TH>Priorität</TH>
                    <TH className="text-right">Aktualisiert</TH>
                  </tr>
                </THead>
                <tbody>
                  {openTickets.map((t) => (
                    <TR key={t.id}>
                      <TD className="whitespace-nowrap">
                        <Link href={`/admin/tickets/${t.id}`} className="font-semibold text-brand-700 hover:underline">
                          {formatTicketNumber(t.id)}
                        </Link>
                      </TD>
                      <TD className="min-w-[14rem]">
                        <Link href={`/admin/tickets/${t.id}`} className="font-medium break-words text-ink hover:underline">
                          {t.subject}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {[
                            !isSub && t.company?.parentId ? t.company.name : null,
                            t.assignee ? `bei ${t.assignee.name}` : "nicht zugewiesen",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </TD>
                      <TD>
                        <StatusBadge status={t.status} audience="staff" />
                      </TD>
                      <TD>
                        <PriorityBadge priority={t.priority} />
                      </TD>
                      <TD className="text-right whitespace-nowrap">
                        <time dateTime={t.updatedAt.toISOString()} title={formatDateTime(t.updatedAt)}>
                          {formatRelative(t.updatedAt)}
                        </time>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
            {openCount > openTickets.length ? (
              <p className="text-sm text-ink-muted">
                Die {openTickets.length} zuletzt bearbeiteten von {openCount} offenen Tickets.{" "}
                <Link href={`/admin/tickets?kunde=${company.id}`} className="font-semibold text-brand-700 hover:underline">
                  Alle offenen anzeigen
                </Link>
              </p>
            ) : null}
            {doneTickets.length > 0 ? (
              <details className="group rounded-2xl border border-line bg-white shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                  Zuletzt erledigt
                  <span className="text-ink-muted group-open:hidden">anzeigen</span>
                  <span className="hidden text-ink-muted group-open:inline">ausblenden</span>
                </summary>
                <ul className="divide-y divide-line border-t border-line">
                  {doneTickets.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                      <span className="min-w-0">
                        <Link href={`/admin/tickets/${t.id}`} className="font-semibold text-brand-700 hover:underline">
                          {formatTicketNumber(t.id)}
                        </Link>{" "}
                        <span className="break-words text-ink">{t.subject}</span>
                        {!isSub && t.company?.parentId ? <span className="text-ink-muted"> · {t.company.name}</span> : null}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-xs text-ink-muted">{formatDate(t.updatedAt)}</span>
                        <StatusBadge status={t.status} audience="staff" />
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          {/* Unterkunden */}
          {!isSub ? (
            <section aria-labelledby="sub-heading" className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="sub-heading" className="text-lg font-bold text-ink">
                    Unterkunden
                  </h2>
                  <p className="text-sm text-ink-muted">
                    Standorte, Tochterfirmen oder Abteilungen. Sie nutzen das Portal des Firmenkunden mit eigenen Benutzern.
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
                <Table>
                  <THead>
                    <tr>
                      <TH>Unterkunde</TH>
                      <TH className="text-right">Aktive Benutzer</TH>
                      <TH className="text-right">Offene Tickets</TH>
                      <TH>Status</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {company.children.map((c) => (
                      <TR key={c.id}>
                        <TD className="min-w-[14rem]">
                          <Link href={`/admin/kunden/${c.id}`} className="font-semibold break-words text-ink hover:underline">
                            {c.name}
                          </Link>
                          {c.city || c.customerNumber ? (
                            <p className="text-xs text-ink-muted">{[c.city, c.customerNumber].filter(Boolean).join(" · ")}</p>
                          ) : null}
                        </TD>
                        <TD className="text-right tabular-nums">
                          <Count value={usersByCompany.get(c.id) ?? 0} />
                        </TD>
                        <TD className="text-right tabular-nums">
                          <Count value={openByCompany.get(c.id) ?? 0} />
                        </TD>
                        <TD>
                          <CompanyActiveBadge active={c.active} />
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </section>
          ) : null}

          {/* Benutzer */}
          <section id="benutzer" aria-labelledby="users-heading" className="scroll-mt-24 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="users-heading" className="text-lg font-bold text-ink">
                  Benutzer
                </h2>
                <p className="text-sm text-ink-muted">
                  {users.length === 0
                    ? "Noch niemand hat einen Zugang."
                    : `${activeUsers} aktiv${users.length > activeUsers ? `, ${users.length - activeUsers} deaktiviert` : ""}${
                        !isSub && hasChildren ? " · inkl. Unterkunden" : ""
                      }`}
                </p>
              </div>
              {isAdmin ? (
                <ButtonLink href={newUserHref} variant="secondary" size="sm">
                  Benutzer anlegen
                </ButtonLink>
              ) : null}
            </div>
            {users.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line-strong bg-mist px-5 py-4 text-sm text-ink-soft">
                {isAdmin
                  ? "Legen Sie einen Benutzer an. Er bekommt eine Einladung per E-Mail und legt sein Passwort selbst fest."
                  : "Benutzer legt ein Administrator oder der Hauptansprechpartner des Kunden an."}
              </p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Name</TH>
                    <TH>Kontakt</TH>
                    {!isSub && hasChildren ? <TH>Firma</TH> : null}
                    <TH>Rolle</TH>
                    <TH>Zugang</TH>
                    <TH className="text-right">Letzte Anmeldung</TH>
                  </tr>
                </THead>
                <tbody>
                  {users.map((u) => (
                    <TR key={u.id} className={u.active ? undefined : "text-ink-muted"}>
                      <TD className="min-w-[11rem]">
                        {isAdmin ? (
                          <Link
                            href={`/admin/kunden/${rootId}/benutzer/${u.id}`}
                            className="font-semibold break-words text-ink hover:underline"
                          >
                            {u.name}
                          </Link>
                        ) : (
                          <span className="font-semibold break-words text-ink">{u.name}</span>
                        )}
                        {u.position ? <p className="text-xs text-ink-muted">{u.position}</p> : null}
                      </TD>
                      <TD className="min-w-[12rem]">
                        <a href={`mailto:${u.email}`} className="break-all hover:underline">
                          {u.email}
                        </a>
                        {u.phone ? (
                          <p className="text-xs">
                            <a href={telHref(u.phone)} className="hover:underline">
                              {u.phone}
                            </a>
                          </p>
                        ) : null}
                      </TD>
                      {!isSub && hasChildren ? (
                        <TD className="min-w-[8rem]">
                          {u.company?.parentId ? u.company.name : <span className="text-ink-muted">Firmenkunde</span>}
                        </TD>
                      ) : null}
                      <TD>
                        <RoleBadge role={u.role} />
                      </TD>
                      <TD>
                        <AccessBadge active={u.active} invited={invited.has(u.id)} />
                      </TD>
                      <TD className="text-right whitespace-nowrap">
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

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Stammdaten" />
            <CardBody>
              <DetailList>
                {!isSub ? (
                  <Detail label="Kundenportal">
                    {slug ? (
                      <a
                        href={portalUrl(slug, "/login")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-brand-700 hover:underline"
                      >
                        {portalHost(slug)}
                      </a>
                    ) : (
                      <Missing />
                    )}
                    {portalBlocked ? <span className="block text-xs font-normal text-amber-800">gesperrt</span> : null}
                  </Detail>
                ) : null}
                <Detail label="Kundennummer">{company.customerNumber ?? <Missing />}</Detail>
                <Detail label="Anschrift">
                  {address.length > 0 ? (
                    address.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))
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
                    <a href={`mailto:${company.email}`} className="break-all text-brand-700 hover:underline">
                      {company.email}
                    </a>
                  ) : (
                    <Missing />
                  )}
                </Detail>
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

          <RecentCallsCard
            calls={recentCalls}
            total={callTotal}
            showCompany={!isSub && hasChildren}
            searchHref={`/admin/anrufe?zeitraum=alle&q=${encodeURIComponent(company.name.slice(0, 80))}`}
          />

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

          {costs ? (
            <Card>
              <CardHeader
                title="Kosten"
                description={isSub ? "Nur diese Unterkunde, gesamter Zeitraum" : "Inkl. Unterkunden, gesamter Zeitraum"}
              />
              <CardBody className="space-y-4">
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs font-semibold text-ink-muted">Noch nicht abgerechnet</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink tabular-nums">{formatMoney(costs.openCents)}</dd>
                    <dd className="text-xs text-ink-muted tabular-nums">
                      {costs.openEntries === 1 ? "1 Position" : `${costs.openEntries} Positionen`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-muted">Abgerechnet</dt>
                    <dd className="mt-0.5 text-lg font-bold text-ink tabular-nums">{formatMoney(costs.billedCents)}</dd>
                    <dd className="text-xs text-ink-muted">
                      {costs.lastPerformedAt ? `letzte Leistung ${formatDate(costs.lastPerformedAt)}` : "noch keine Leistungen"}
                    </dd>
                  </div>
                </dl>
                <ButtonLink href={`/admin/kosten/konto/${rootId}`} variant="secondary" size="sm">
                  Kosten im Detail
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

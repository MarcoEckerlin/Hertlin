import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalContext, requirePortalRootAdmin } from "@/lib/auth";
import { formatDate, formatRelative, formatTicketNumber } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { RoleBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyStatusBadge, UserStatusBadge } from "@/components/portal/admin/status-badges";
import { SubCustomerForm } from "@/components/portal/admin/sub-customer-form";
import { SubCustomerStatusForm } from "@/components/portal/admin/sub-customer-status-form";
import { accessStatus } from "@/components/portal/admin/types";
import { cleanId, firstParam, getSubCustomer, listManageableUsers, recentTicketsOf } from "@/components/portal/admin/data";

type Params = Promise<{ slug: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getPortalContext();
  const companyId = cleanId(id);
  if (!ctx?.isRootAdmin || !companyId) return { title: "Unterkunde" };
  const company = await getSubCustomer(ctx.root.id, companyId);
  return { title: company?.name ?? "Unterkunde" };
}

export default async function SubCustomerPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const ctx = await requirePortalRootAdmin();
  const { id } = await params;
  const companyId = cleanId(id);
  if (!companyId) notFound();

  // Nur Unterkunden dieses Firmenkunden – alles andere gibt es hier nicht
  const company = await getSubCustomer(ctx.root.id, companyId);
  if (!company) notFound();

  const sp = await searchParams;
  const justCreated = firstParam(sp.angelegt) === "1";

  const [users, recent] = await Promise.all([
    listManageableUsers(ctx, { companyId: company.id }),
    recentTicketsOf(ctx, company.id),
  ]);

  const activeUsers = users.filter((u) => u.active).length;
  const openInvites = users.filter((u) => u.active && u.invited).length;
  const address = [company.street, [company.zip, company.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const newUserHref = `/benutzer/neu?firma=${company.id}`;
  const ticketsHref = `/tickets?firma=${company.id}`;

  return (
    <>
      <PageHeader
        title={company.name}
        breadcrumbs={[{ label: "Unterkunden", href: "/unterkunden" }, { label: company.name }]}
        description={address || `Unterkunde von ${ctx.root.name}`}
        meta={
          <>
            <CompanyStatusBadge active={company.active} />
            <span className="text-sm text-ink-muted">Angelegt am {formatDate(company.createdAt)}</span>
          </>
        }
        actions={company.active ? <ButtonLink href={newUserHref}>Benutzer anlegen</ButtonLink> : null}
      />

      <div className="mb-6 space-y-3 empty:hidden">
        {justCreated && company.active ? (
          <Alert tone="success" title="Die Unterkunde ist angelegt">
            Legen Sie jetzt die Benutzer an, die dort arbeiten. Jeder bekommt eine Einladung per E-Mail und legt sein
            Passwort selbst fest.
          </Alert>
        ) : null}
        {!company.active ? (
          <Alert tone="warning" title="Diese Unterkunde ist deaktiviert">
            Ihre Benutzer können sich nicht anmelden und neue Benutzer lassen sich nicht anlegen. Die bisherigen Tickets
            sehen Sie weiterhin.
          </Alert>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Benutzer"
              description={
                users.length === 0
                  ? "Noch niemand angelegt"
                  : `${activeUsers} aktiv${openInvites > 0 ? `, davon ${openInvites} mit offener Einladung` : ""}${
                      users.length > activeUsers ? `, ${users.length - activeUsers} deaktiviert` : ""
                    }`
              }
            />
            {users.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-soft">
                  Für {company.name} gibt es noch keine Zugänge.
                  {company.active
                    ? " Legen Sie die Personen an, die von dort aus Störungen melden oder Anfragen stellen sollen."
                    : ""}
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {users.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6">
                    <div className="min-w-0">
                      <Link href={`/benutzer/${u.id}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">
                        {u.name}
                      </Link>
                      <p className="truncate text-sm text-ink-muted">
                        {u.email}
                        {u.position ? ` · ${u.position}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={u.role} />
                      <UserStatusBadge status={accessStatus(u, u.invited)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Letzte Tickets"
              description={
                recent.total === 0
                  ? "Noch keine Tickets"
                  : `${recent.open} offen, ${recent.total} insgesamt`
              }
              actions={
                recent.total > 0 ? (
                  <Link href={ticketsHref} className="text-sm font-semibold text-brand-700 hover:underline">
                    Alle Tickets
                  </Link>
                ) : null
              }
            />
            {recent.tickets.length === 0 ? (
              <CardBody>
                <p className="text-sm text-ink-soft">
                  Von {company.name} kam bisher kein Ticket. Sobald jemand von dort eine Störung meldet oder eine Anfrage
                  stellt, sehen Sie es hier.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {recent.tickets.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6">
                    <div className="min-w-0">
                      <Link href={`/tickets/${t.id}`} className="font-semibold text-ink hover:text-brand-700 hover:underline">
                        <span className="mr-2 font-mono text-xs text-ink-muted">{formatTicketNumber(t.id)}</span>
                        {t.subject}
                      </Link>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {t.createdBy?.name ? `${t.createdBy.name} · ` : ""}
                        aktualisiert {formatRelative(t.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Stammdaten" />
            <CardBody>
              <SubCustomerForm
                mode="edit"
                id={company.id}
                initial={{
                  name: company.name,
                  street: company.street ?? "",
                  zip: company.zip ?? "",
                  city: company.city ?? "",
                  phone: company.phone ?? "",
                  email: company.email ?? "",
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={company.active ? "Unterkunde deaktivieren" : "Unterkunde aktivieren"} />
            <CardBody>
              <SubCustomerStatusForm id={company.id} name={company.name} active={company.active} userCount={activeUsers} />
              <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
                Löschen ist bewusst nicht vorgesehen. So bleiben alte Tickets der Unterkunde zugeordnet und später
                nachvollziehbar.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

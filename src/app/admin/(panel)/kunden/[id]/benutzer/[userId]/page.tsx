import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { RoleBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyUserEditForm, type CompanyOption } from "@/components/admin/companies/company-user-form";
import { cleanId } from "@/components/admin/companies/list-tools";
import { ResendAccessForm } from "@/components/admin/companies/resend-access-form";
import { AccessBadge } from "@/components/admin/companies/status-badges";
import { resendCompanyAccessAction } from "@/lib/actions/admin-companies";
import { requireAdmin } from "@/lib/auth";
import { CUSTOMER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Benutzer bearbeiten" };

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

export default async function EditCompanyUserPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  await requireAdmin();
  const p = await params;
  const id = cleanId(p.id);
  const userId = cleanId(p.userId);
  if (!id || !userId) notFound();

  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      parentId: true,
      children: { select: { id: true, name: true, active: true } },
    },
  });
  if (!company) notFound();
  if (company.parentId) redirect(`/admin/kunden/${company.parentId}/benutzer/${userId}`);

  const companies: CompanyOption[] = [
    { id: company.id, name: company.name, isRoot: true, active: company.active },
    ...company.children
      .map((c) => ({ id: c.id, name: c.name, isRoot: false, active: c.active }))
      .sort((a, b) => collator.compare(a.name, b.name)),
  ];

  const user = await db.user.findFirst({
    where: { id: userId, companyId: { in: companies.map((c) => c.id) }, role: { in: [...CUSTOMER_ROLES] } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      position: true,
      role: true,
      active: true,
      companyId: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user || !user.companyId) notFound();

  const [pending, openInvite, ticketCount] = await Promise.all([
    db.user.count({ where: { id: user.id, passwordHash: null } }),
    db.authToken.findFirst({
      where: { userId: user.id, purpose: "INVITE", usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { expiresAt: true },
    }),
    db.ticket.count({ where: { createdById: user.id } }),
  ]);
  const invited = pending > 0;
  const userCompany = companies.find((c) => c.id === user.companyId);
  const companyInactive = !company.active || (userCompany ? !userCompany.active : false);

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Kunden", href: "/admin/kunden" },
          { label: company.name, href: `/admin/kunden/${company.id}` },
          { label: user.name },
        ]}
        title={<span className="break-words">{user.name}</span>}
        description={userCompany && !userCompany.isRoot ? `${userCompany.name} · Unterkunde von ${company.name}` : company.name}
        meta={
          <>
            <RoleBadge role={user.role} />
            <AccessBadge active={user.active} invited={invited} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card>
            <CardBody className="sm:p-8">
              <CompanyUserEditForm
                rootId={company.id}
                companies={companies}
                invited={invited}
                user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  phone: user.phone ?? "",
                  position: user.position ?? "",
                  role: user.role === "CUSTOMER_ADMIN" ? "CUSTOMER_ADMIN" : "CUSTOMER_USER",
                  companyId: user.companyId,
                  active: user.active,
                }}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title={invited ? "Einladung" : "Passwort"}
              description={
                invited
                  ? openInvite
                    ? `Offen, gültig bis ${formatDateTime(openInvite.expiresAt)}.`
                    : "Die letzte Einladung ist abgelaufen."
                  : "Die Person hat ein Passwort festgelegt."
              }
            />
            <CardBody className="space-y-3">
              {!user.active ? (
                <p className="text-sm text-ink-soft">Der Zugang ist deaktiviert. Aktivieren Sie ihn zuerst.</p>
              ) : companyInactive ? (
                <Alert tone="warning">Die Firma ist deaktiviert. Solange kann sich niemand anmelden.</Alert>
              ) : (
                <>
                  <p className="text-sm text-ink-soft">
                    {invited
                      ? "Neue Einladung per E-Mail. Ältere Einladungslinks werden dabei ungültig."
                      : "Schickt einen Link zum Zurücksetzen, z. B. wenn die Person ihr Passwort vergessen hat. Er ist eine Stunde gültig."}
                  </p>
                  <ResendAccessForm
                    action={resendCompanyAccessAction}
                    hidden={{ id: user.id, rootId: company.id }}
                    invited={invited}
                    name={user.name}
                  />
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Konto" />
            <CardBody>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Angelegt</dt>
                  <dd className="text-ink">{formatDate(user.createdAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Letzte Anmeldung</dt>
                  <dd className="text-ink">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "noch nie"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Gemeldete Tickets</dt>
                  <dd className="text-ink tabular-nums">{ticketCount}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

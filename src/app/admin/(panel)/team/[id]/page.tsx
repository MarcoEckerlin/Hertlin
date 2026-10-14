import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { RoleBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cleanId } from "@/components/admin/companies/list-tools";
import { ResendAccessForm } from "@/components/admin/companies/resend-access-form";
import { AccessBadge } from "@/components/admin/companies/status-badges";
import { StaffEditForm } from "@/components/admin/team/staff-form";
import { resendStaffAccessAction } from "@/lib/actions/admin-team";
import { requireAdmin } from "@/lib/auth";
import { OPEN_STATUSES, STAFF_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Teammitglied" };

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const id = cleanId((await params).id);
  if (!id) notFound();

  const user = await db.user.findFirst({
    where: { id, role: { in: [...STAFF_ROLES] } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      position: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user) notFound();

  const [pending, openInvite, assignedOpen] = await Promise.all([
    db.user.count({ where: { id: user.id, passwordHash: null } }),
    db.authToken.findFirst({
      where: { userId: user.id, purpose: "INVITE", usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { expiresAt: true },
    }),
    db.ticket.count({ where: { assigneeId: user.id, status: { in: [...OPEN_STATUSES] } } }),
  ]);
  const invited = pending > 0;
  const isSelf = user.id === me.id;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Team", href: "/admin/team" }, { label: user.name }]}
        title={<span className="break-words">{user.name}</span>}
        description={user.position ?? undefined}
        meta={
          <>
            <RoleBadge role={user.role} />
            <AccessBadge active={user.active} invited={invited} />
            {isSelf ? <span className="text-sm text-ink-muted">Ihr eigenes Konto</span> : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card>
            <CardBody className="sm:p-8">
              <StaffEditForm
                isSelf={isSelf}
                invited={invited}
                user={{
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  phone: user.phone ?? "",
                  position: user.position ?? "",
                  role: user.role === "ADMIN" ? "ADMIN" : "TECHNICIAN",
                  active: user.active,
                }}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          {isSelf ? (
            <Card>
              <CardHeader title="Passwort" />
              <CardBody className="space-y-3 text-sm text-ink-soft">
                <p>Ihr eigenes Passwort ändern Sie in Ihrem Profil.</p>
                <ButtonLink href="/admin/profil" variant="secondary" size="sm">
                  Zum Profil
                </ButtonLink>
              </CardBody>
            </Card>
          ) : (
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
                {user.active ? (
                  <>
                    <p className="text-sm text-ink-soft">
                      {invited
                        ? "Neue Einladung per E-Mail. Ältere Einladungslinks werden dabei ungültig."
                        : "Schickt einen Link zum Zurücksetzen, z. B. wenn die Person ihr Passwort vergessen hat. Er ist eine Stunde gültig."}
                    </p>
                    <ResendAccessForm action={resendStaffAccessAction} hidden={{ id: user.id }} invited={invited} name={user.name} />
                  </>
                ) : (
                  <p className="text-sm text-ink-soft">Der Zugang ist deaktiviert. Aktivieren Sie ihn zuerst.</p>
                )}
              </CardBody>
            </Card>
          )}

          {!user.active && assignedOpen > 0 ? (
            <Alert tone="warning" title="Noch offene Tickets zugewiesen">
              {assignedOpen === 1 ? "Ein offenes Ticket ist" : `${assignedOpen} offene Tickets sind`} noch dieser Person
              zugewiesen. Bitte neu verteilen.
            </Alert>
          ) : null}

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
                  <dt className="text-ink-muted">Offene Tickets zugewiesen</dt>
                  <dd className="text-ink tabular-nums">{assignedOpen}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

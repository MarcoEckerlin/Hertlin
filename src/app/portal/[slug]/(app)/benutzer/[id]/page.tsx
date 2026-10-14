import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPortalContext, requirePortalAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { Alert } from "@/components/ui/alert";
import { RoleBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ResendAccessForm } from "@/components/portal/admin/resend-access-form";
import { UserStatusBadge } from "@/components/portal/admin/status-badges";
import { UserEditForm } from "@/components/portal/admin/user-edit-form";
import { accessStatus } from "@/components/portal/admin/types";
import { cleanId, getManageableUser, manageableCompanies, ticketCountsOf } from "@/components/portal/admin/data";

type Params = Promise<{ slug: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ctx = await getPortalContext();
  const userId = cleanId(id);
  if (!ctx?.isAdmin || !userId) return { title: "Benutzer" };
  const user = await getManageableUser(ctx, userId);
  return { title: user?.name ?? "Benutzer" };
}

export default async function UserPage({ params }: { params: Params }) {
  const ctx = await requirePortalAdmin();
  const { id } = await params;
  const userId = cleanId(id);
  if (!userId) notFound();

  // Nur Benutzer im eigenen Verwaltungsbereich
  const user = await getManageableUser(ctx, userId);
  if (!user) notFound();

  const [allCompanies, tickets] = await Promise.all([manageableCompanies(ctx), ticketCountsOf(ctx, user.id)]);
  const company = allCompanies.find((c) => c.id === user.companyId);
  const companies = allCompanies.filter((c) => c.active || c.id === user.companyId);
  const isSelf = user.id === ctx.user.id;
  const status = accessStatus(user, user.invited);
  const companyActive = company?.active ?? true;
  const canSendLink = !isSelf && user.active && companyActive;

  return (
    <>
      <PageHeader
        title={user.name}
        breadcrumbs={[{ label: "Benutzer", href: "/benutzer" }, { label: user.name }]}
        description={[user.position, user.email].filter(Boolean).join(" · ")}
        meta={
          <>
            <RoleBadge role={user.role} />
            <UserStatusBadge status={status} />
            {company ? (
              company.isRoot || !ctx.isRootAdmin ? (
                <span className="text-sm text-ink-muted">{company.name}</span>
              ) : (
                <Link href={`/unterkunden/${company.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                  {company.name}
                </Link>
              )
            ) : null}
          </>
        }
      />

      <div className="mb-6 space-y-3 empty:hidden">
        {isSelf ? (
          <Alert tone="info" title="Das ist Ihr eigenes Konto">
            Rolle, Zuordnung und Status sind gesperrt, damit Sie sich nicht versehentlich selbst aussperren. Ihr Passwort
            ändern Sie unter{" "}
            <Link href="/profil" className="font-semibold underline underline-offset-2">
              Profil
            </Link>
            .
          </Alert>
        ) : null}
        {company && !company.active ? (
          <Alert tone="warning" title={`${company.name} ist deaktiviert`}>
            {user.name} kann sich deshalb zurzeit nicht anmelden, auch wenn der Zugang hier als aktiv markiert ist.
            {ctx.isRootAdmin ? (
              <>
                {" "}
                Aktivieren können Sie die Unterkunde auf ihrer{" "}
                <Link href={`/unterkunden/${company.id}`} className="font-semibold underline underline-offset-2">
                  Detailseite
                </Link>
                .
              </>
            ) : null}
          </Alert>
        ) : null}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,42rem)_24rem]">
        <Card className="max-w-2xl">
          <CardHeader title="Angaben" />
          <CardBody>
            <UserEditForm
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone ?? "",
                position: user.position ?? "",
                role: user.role,
                companyId: user.companyId,
                active: user.active,
              }}
              invited={user.invited}
              companies={companies}
              canChangeCompany={ctx.isRootAdmin && !isSelf}
              isSelf={isSelf}
            />
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Zugang" />
            <CardBody className="space-y-5">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-muted">Status</dt>
                <dd>
                  <UserStatusBadge status={status} />
                </dd>
                <dt className="text-ink-muted">Angelegt am</dt>
                <dd className="text-ink">{formatDate(user.createdAt)}</dd>
                <dt className="text-ink-muted">Letzte Anmeldung</dt>
                <dd className="text-ink">{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "noch nie"}</dd>
                <dt className="text-ink-muted">Tickets</dt>
                <dd className="text-ink">
                  {tickets.total === 0
                    ? "noch keine erstellt"
                    : `${tickets.total} erstellt${tickets.open > 0 ? `, ${tickets.open} davon offen` : ""}`}
                </dd>
              </dl>

              <div className="border-t border-line pt-5">
                {isSelf ? (
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Ihr eigenes Passwort ändern Sie unter{" "}
                    <Link href="/profil" className="font-semibold text-brand-700 hover:underline">
                      Profil
                    </Link>
                    .
                  </p>
                ) : !user.active ? (
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Der Zugang ist deaktiviert. Soll {user.name} wieder ins Kundenportal, setzen Sie im Formular den Haken
                    bei „Zugang aktiv“ und speichern.
                  </p>
                ) : !companyActive ? (
                  <p className="text-sm leading-relaxed text-ink-soft">
                    Solange {company?.name} deaktiviert ist, lassen sich keine Einladungen oder Passwortlinks verschicken.
                  </p>
                ) : user.invited ? (
                  <p className="mb-4 text-sm leading-relaxed text-ink-soft">
                    {user.name} hat das Passwort noch nicht festgelegt. Ist die Einladung abgelaufen oder nicht angekommen
                    (auch im Spam-Ordner nachsehen), senden Sie sie hier erneut.
                  </p>
                ) : (
                  <p className="mb-4 text-sm leading-relaxed text-ink-soft">
                    Passwort vergessen? Dann schicken wir {user.name} einen Link für ein neues Passwort. Aus
                    Sicherheitsgründen geht der Link nur an {user.email} und wird Ihnen nicht angezeigt.
                  </p>
                )}
                {canSendLink ? <ResendAccessForm userId={user.id} name={user.name} invited={user.invited} /> : null}
              </div>
            </CardBody>
          </Card>

          <p className="px-1 text-xs leading-relaxed text-ink-muted">
            Benutzer lassen sich nicht löschen, damit ihre Tickets und Nachrichten nachvollziehbar bleiben. Deaktivieren
            sperrt den Zugang vollständig.
          </p>
        </div>
      </div>
    </>
  );
}

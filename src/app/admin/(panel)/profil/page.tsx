import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { isLangCode } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { RoleBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StaffLanguageForm, StaffPasswordForm, StaffProfileForm } from "@/components/admin/profile/profile-forms";
import { NotificationPermission } from "@/components/admin/calls/notification-permission";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function StaffProfilePage() {
  const user = await requireStaff();
  const [account, sessionCount] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        phone: true,
        position: true,
        role: true,
        language: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    db.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
  ]);
  if (!account) return null;
  // Die Spracheinstellung zeigen wir nur, wenn ein Übersetzungsdienst eingerichtet ist
  const translate = translationEnabled();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Übersicht", href: "/admin" }, { label: "Mein Profil" }]}
        title="Mein Profil"
        description="Ihre Kontaktdaten, Einstellungen und Ihr Passwort für die Verwaltung."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Angaben" />
            <CardBody>
              <StaffProfileForm name={account.name} phone={account.phone} position={account.position} />
            </CardBody>
          </Card>

          {translate ? (
            <Card>
              <CardHeader title="Übersetzung" />
              <CardBody>
                <StaffLanguageForm language={isLangCode(account.language) ? account.language : "de"} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Desktop-Hinweise"
              description="Für eingehende Anrufe und neue Tickets. Die Erlaubnis gilt nur für diesen Browser."
            />
            <CardBody>
              <NotificationPermission />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Passwort ändern"
              description="Danach werden Sie auf allen anderen Geräten abgemeldet. Diese Sitzung bleibt bestehen."
            />
            <CardBody>
              <StaffPasswordForm email={account.email} />
            </CardBody>
          </Card>
        </div>

        <aside aria-label="Zugang">
          <Card>
            <CardHeader title="Zugang" />
            <CardBody>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold text-ink-muted">Anmeldung mit</dt>
                  <dd className="mt-0.5 break-words text-ink">{account.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-muted">Rolle</dt>
                  <dd className="mt-1">
                    <RoleBadge role={account.role} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-muted">Letzte Anmeldung</dt>
                  <dd className="mt-0.5 text-ink">{formatDateTime(account.lastLoginAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-muted">Aktive Anmeldungen</dt>
                  <dd className="mt-0.5 text-ink">
                    {sessionCount <= 1 ? "nur diese" : `${sessionCount} Geräte bzw. Browser, inklusive diesem`}
                  </dd>
                </div>
              </dl>
              <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">
                Die E-Mail-Adresse und die Rolle ändert ein Administrator
                {user.role === "ADMIN" ? (
                  <>
                    {" "}
                    unter{" "}
                    <Link href="/admin/team" className="font-semibold text-brand-700 hover:underline">
                      Team
                    </Link>
                  </>
                ) : null}
                .
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

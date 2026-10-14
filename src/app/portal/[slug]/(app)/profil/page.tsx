import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePortalContext } from "@/lib/auth";
import { ROLE_DESCRIPTIONS } from "@/lib/constants";
import { portalHost, portalUrl } from "@/lib/hosts";
import { RoleBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { PasswordForm, ProfileForm } from "@/components/portal/profile-forms";

export const metadata: Metadata = { title: "Mein Profil" };

export default async function PortalProfilePage() {
  const ctx = await requirePortalContext();

  // Frisch aus der Datenbank, damit nach dem Speichern die neuen Werte im Formular stehen
  const user = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: { name: true, email: true, phone: true, position: true },
  });
  if (!user) notFound();

  const role = ctx.user.role;
  const isSubCustomer = ctx.company.parentId !== null;
  const address = portalHost(ctx.root.slug);
  const addressUrl = portalUrl(ctx.root.slug, "/");

  // Hauptansprechpartner einer Unterkunde verwalten nur deren Benutzer, keine weiteren Unterkunden
  const roleDescription =
    role === "CUSTOMER_ADMIN" && isSubCustomer
      ? `Sieht alle Tickets von ${ctx.company.name} und verwaltet dort die Benutzer.`
      : role === "CUSTOMER_USER"
        ? `${ROLE_DESCRIPTIONS[role]} Zugänge verwaltet Ihr Hauptansprechpartner.`
        : ROLE_DESCRIPTIONS[role];

  const emailHint = ctx.isRootAdmin
    ? "Die Adresse ist gleichzeitig Ihr Anmeldename. Ändert sie sich, sagen Sie uns bitte Bescheid – wir tragen sie um."
    : `Die Adresse ist gleichzeitig Ihr Anmeldename. Ändern kann sie ${
        isSubCustomer && ctx.isAdmin ? `der Hauptansprechpartner von ${ctx.root.name}` : "Ihr Hauptansprechpartner"
      } oder Hertlin.`;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Übersicht", href: "/" }, { label: "Mein Profil" }]}
        title="Mein Profil"
        description="Ihre Kontaktdaten und Ihr Passwort für das Kundenportal."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Ihre Angaben"
              description="So sehen wir Sie in Ihren Tickets. Die Telefonnummer hilft uns bei Rückfragen."
            />
            <CardBody>
              <ProfileForm name={user.name} phone={user.phone} position={user.position} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Passwort ändern"
              description="Zur Sicherheit brauchen wir Ihr aktuelles Passwort. Auf anderen Geräten werden Sie danach abgemeldet."
            />
            <CardBody>
              <PasswordForm email={user.email} />
            </CardBody>
          </Card>
        </div>

        <aside aria-label="Ihr Zugang">
          <Card>
            <CardHeader title="Ihr Zugang" />
            <CardBody>
              <dl className="space-y-5 text-sm">
                <Item label="Firma">
                  <span className="font-medium text-ink">{ctx.company.name}</span>
                  {isSubCustomer ? <span className="block text-ink-muted">Unterkunde von {ctx.root.name}</span> : null}
                </Item>
                <Item label="Rolle">
                  <RoleBadge role={role} />
                  <span className="mt-1.5 block leading-relaxed text-ink-soft">{roleDescription}</span>
                </Item>
                <Item label="E-Mail-Adresse">
                  <span className="block font-medium break-all text-ink">{user.email}</span>
                  <span className="mt-1 block leading-relaxed text-ink-muted">{emailHint}</span>
                </Item>
                <Item label="Adresse Ihres Kundenportals">
                  <a href={addressUrl} className="block font-medium break-all text-brand-700 hover:underline">
                    {address}
                  </a>
                  <span className="mt-1 block leading-relaxed text-ink-muted">
                    Am besten als Lesezeichen speichern. Kolleginnen und Kollegen melden sich hier ebenfalls an.
                  </span>
                  <div className="mt-2">
                    <CopyButton value={addressUrl} label="Adresse kopieren" />
                  </div>
                </Item>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

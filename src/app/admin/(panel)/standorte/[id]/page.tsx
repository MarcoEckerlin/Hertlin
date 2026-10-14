import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cleanId } from "@/components/admin/companies/list-tools";
import { countsOf, loadLocationCounts, locationRowSelect } from "@/components/admin/locations/data";
import { LocationDeleteForm } from "@/components/admin/locations/location-delete-form";
import { LocationEditForm } from "@/components/admin/locations/location-form";
import { assignmentSummary, hasAssignments } from "@/components/admin/locations/rules";
import { getStaffUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const me = await getStaffUser();
  const id = cleanId((await params).id);
  const location =
    me?.role === "ADMIN" && id ? await db.location.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: location ? `${location.name} | Standorte` : "Standort" };
}

function CountRow({ label, value, href }: { label: string; value: number; href?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink tabular-nums">
        {href && value > 0 ? (
          <Link href={href} className="font-semibold text-brand-700 hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = cleanId((await params).id);
  if (!id) notFound();

  const location = await db.location.findUnique({ where: { id }, select: locationRowSelect });
  if (!location) notFound();

  const [countMap, otherMain, otherActive] = await Promise.all([
    loadLocationCounts([location.id]),
    db.location.findFirst({ where: { isMain: true, active: true, id: { not: location.id } }, select: { name: true } }),
    db.location.count({ where: { active: true, id: { not: location.id } } }),
  ]);
  const counts = countsOf(countMap, location.id);
  const assigned = hasAssignments(counts);
  const mainBlocksDelete = location.isMain && otherActive > 0;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Standorte", href: "/admin/standorte" }, { label: location.name }]}
        title={<span className="break-words">{location.name}</span>}
        description={`${location.street}, ${location.zip} ${location.city}`}
        meta={
          <>
            {location.isMain ? <Badge tone="blue">Hauptsitz</Badge> : null}
            {location.active ? (
              location.showOnWebsite ? (
                <Badge tone="green">Auf der Website</Badge>
              ) : (
                <Badge tone="amber">Nicht auf der Website</Badge>
              )
            ) : (
              <Badge tone="gray">Deaktiviert</Badge>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <Card>
            <CardBody className="sm:p-8">
              <LocationEditForm
                currentMain={otherMain?.name ?? null}
                location={{
                  id: location.id,
                  name: location.name,
                  street: location.street,
                  zip: location.zip,
                  city: location.city,
                  phone: location.phone ?? "",
                  email: location.email ?? "",
                  openingHours: location.openingHours ?? "",
                  note: location.note ?? "",
                  isMain: location.isMain,
                  showOnWebsite: location.showOnWebsite,
                  active: location.active,
                }}
              />
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Zugeordnet" />
            <CardBody>
              <dl className="space-y-2 text-sm">
                <CountRow label="Kunden" value={counts.companies} href={`/admin/kunden?standort=${location.id}`} />
                <CountRow label="Mitarbeiter" value={counts.staff} href="/admin/team" />
                {counts.customers > 0 ? <CountRow label="Kundenbenutzer" value={counts.customers} /> : null}
                <CountRow
                  label="Offene Tickets"
                  value={counts.openTickets}
                  href={`/admin/tickets?standort=${location.id}`}
                />
                <CountRow
                  label="Tickets insgesamt"
                  value={counts.tickets}
                  href={`/admin/tickets?ansicht=alle&standort=${location.id}`}
                />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Löschen" />
            <CardBody className="space-y-3 text-sm text-ink-soft">
              {assigned ? (
                <p>
                  Dem Standort sind noch {assignmentSummary(counts)} zugeordnet. Löschen geht erst ohne Zuordnungen –
                  deaktivieren Sie den Standort stattdessen (Haken „Standort aktiv“ entfernen).
                </p>
              ) : mainBlocksDelete ? (
                <p>Der Hauptsitz kann nicht gelöscht werden. Machen Sie zuerst einen anderen Standort zum Hauptsitz.</p>
              ) : (
                <>
                  <p>Dem Standort ist nichts zugeordnet. Er kann gelöscht werden.</p>
                  <LocationDeleteForm id={location.id} name={location.name} />
                </>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

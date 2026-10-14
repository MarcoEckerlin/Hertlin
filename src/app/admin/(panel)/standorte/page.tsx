import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone, Plus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cleanId, firstParam } from "@/components/admin/companies/list-tools";
import { countsOf, loadLocationCounts, loadLocations, type LocationCounts } from "@/components/admin/locations/data";
import { LocationMoveButtons } from "@/components/admin/locations/location-move-buttons";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Standorte" };

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Counts({ id, counts }: { id: string; counts: LocationCounts }) {
  const link = "font-semibold text-brand-700 hover:underline";
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-muted">
      <li>
        {counts.companies > 0 ? (
          <Link href={`/admin/kunden?standort=${id}`} className={link}>
            {plural(counts.companies, "Kunde", "Kunden")}
          </Link>
        ) : (
          "keine Kunden"
        )}
      </li>
      <li>{counts.staff > 0 ? plural(counts.staff, "Mitarbeiter", "Mitarbeiter") : "keine Mitarbeiter"}</li>
      <li>
        {counts.openTickets > 0 ? (
          <Link href={`/admin/tickets?standort=${id}`} className={link}>
            {plural(counts.openTickets, "offenes Ticket", "offene Tickets")}
          </Link>
        ) : (
          "keine offenen Tickets"
        )}
      </li>
    </ul>
  );
}

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [locations, counts] = await Promise.all([loadLocations(), loadLocationCounts()]);

  const createdId = cleanId(sp.neu);
  const created = createdId ? locations.find((l) => l.id === createdId) : undefined;
  const deleted = firstParam(sp.geloescht) === "1";
  const lastIndex = locations.length - 1;
  // Verschieben lohnt sich erst ab zwei Standorten neben dem Hauptsitz
  const movable = locations.filter((l) => !l.isMain).length > 1;

  return (
    <div>
      <PageHeader
        title="Standorte"
        description="Büros und Filialen von Hertlin. Kunden, Mitarbeiter und Tickets lassen sich einem Standort zuordnen; auf der Website erscheinen die Standorte im Modul „Standorte“ und in der Fußzeile."
        actions={
          locations.length > 0 ? (
            <ButtonLink href="/admin/standorte/neu">
              <Plus className="size-4" aria-hidden />
              Standort anlegen
            </ButtonLink>
          ) : null
        }
      />

      {created ? (
        <Alert tone="success" title="Standort angelegt" className="mb-5">
          {created.name} steht jetzt zur Auswahl{created.showOnWebsite ? " und erscheint auf der Website" : ""}.
        </Alert>
      ) : null}
      {deleted ? (
        <Alert tone="success" className="mb-5">
          Der Standort ist gelöscht.
        </Alert>
      ) : null}

      {locations.length === 0 ? (
        <EmptyState
          title="Noch keine Standorte"
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/admin/standorte/neu?vorlage=firmendaten">Hauptsitz aus den Firmendaten übernehmen</ButtonLink>
              <ButtonLink href="/admin/standorte/neu" variant="secondary">
                Standort von Hand anlegen
              </ButtonLink>
            </div>
          }
        >
          Solange es keinen Standort gibt, zeigen Website und Fußzeile die Anschrift aus den Firmendaten. Mit Standorten ordnen Sie
          Kunden, Mitarbeiter und Tickets einem Büro zu und zeigen auf der Website alle Anschriften.
        </EmptyState>
      ) : (
        <>
          <ol aria-label="Standorte" className="space-y-3">
            {locations.map((l, i) => {
              const place = [l.zip, l.city].filter(Boolean).join(" ");
              return (
                <li
                  key={l.id}
                  className={cn(
                    "rounded-2xl border p-4 shadow-card sm:p-5",
                    l.active ? "border-line bg-white" : "border-dashed border-line-strong bg-mist",
                    l.id === createdId && "ring-2 ring-brand-300",
                  )}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 sm:flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold break-words text-ink sm:text-lg">
                          <Link href={`/admin/standorte/${l.id}`} className="hover:underline">
                            {l.name}
                          </Link>
                        </h2>
                        {l.isMain ? <Badge tone="blue">Hauptsitz</Badge> : null}
                        {!l.active ? <Badge tone="gray">Deaktiviert</Badge> : null}
                        {l.active && !l.showOnWebsite ? <Badge tone="amber">Nicht auf der Website</Badge> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <MapPin className="size-4 shrink-0 text-ink-muted" aria-hidden />
                          <span className="sr-only">Anschrift: </span>
                          <span className="break-words">
                            {l.street}, {place}
                          </span>
                        </span>
                        {l.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="size-4 shrink-0 text-ink-muted" aria-hidden />
                            <span className="sr-only">Telefon: </span>
                            {l.phone}
                          </span>
                        ) : null}
                        {l.email ? (
                          <span className="inline-flex min-w-0 items-center gap-1.5">
                            <Mail className="size-4 shrink-0 text-ink-muted" aria-hidden />
                            <span className="sr-only">E-Mail: </span>
                            <span className="break-words">{l.email}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {l.isMain || !movable ? null : (
                        <LocationMoveButtons
                          id={l.id}
                          name={l.name}
                          canMoveUp={i > 0 && !locations[i - 1].isMain}
                          canMoveDown={i < lastIndex}
                        />
                      )}
                      <ButtonLink href={`/admin/standorte/${l.id}`} variant="secondary" size="sm">
                        Bearbeiten
                      </ButtonLink>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Counts id={l.id} counts={countsOf(counts, l.id)} />
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 max-w-3xl text-sm text-ink-muted">
            Auf der Website erscheinen aktive Standorte mit „Auf der Website zeigen“ – im Modul „Standorte“ (z. B. auf der
            Kontaktseite) und ab zwei Standorten auch in der Fußzeile. Der Hauptsitz steht immer zuerst, die übrigen in der
            Reihenfolge dieser Liste.
          </p>
        </>
      )}
    </div>
  );
}

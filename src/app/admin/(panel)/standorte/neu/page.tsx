import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { firstParam } from "@/components/admin/companies/list-tools";
import { LocationCreateForm } from "@/components/admin/locations/location-form";
import { EMPTY_LOCATION_DRAFT, locationDraftFromSettings } from "@/components/admin/locations/rules";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Standort anlegen" };

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const fromSettings = firstParam((await searchParams).vorlage) === "firmendaten";

  const [main, settings] = await Promise.all([
    db.location.findFirst({ where: { isMain: true, active: true }, select: { name: true } }),
    fromSettings ? getSiteSettings() : null,
  ]);
  const draft = settings ? locationDraftFromSettings(settings) : EMPTY_LOCATION_DRAFT;
  const missing = settings ? [draft.street, draft.zip, draft.city].some((v) => !v) : false;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Standorte", href: "/admin/standorte" }, { label: "Standort anlegen" }]}
        title={fromSettings ? "Hauptsitz aus den Firmendaten" : "Standort anlegen"}
        description="Büro oder Filiale mit Anschrift, Kontakt und Öffnungszeiten."
      />
      <Card className="max-w-3xl">
        <CardBody className="space-y-6 sm:p-8">
          {fromSettings ? (
            <Alert tone={missing ? "warning" : "info"} title="Angaben aus den Firmendaten übernommen">
              {missing
                ? "In den Firmendaten fehlt noch ein Teil der Anschrift (Platzhalter wie „TODO“ sind weggelassen). Bitte ergänzen Sie die leeren Felder und speichern Sie dann."
                : "Prüfen Sie die Angaben und speichern Sie dann. Spätere Änderungen an den Firmendaten ändern den Standort nicht."}
            </Alert>
          ) : null}
          <LocationCreateForm initial={draft} currentMain={main?.name ?? null} suggestMain={fromSettings} />
        </CardBody>
      </Card>
    </div>
  );
}

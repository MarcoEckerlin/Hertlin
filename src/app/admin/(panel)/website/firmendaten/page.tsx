import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getSiteSettings, unfinishedSettings } from "@/lib/settings";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { DisclosureCard } from "@/components/admin/companies/disclosure";
import { SiteSettingsForm } from "@/components/admin/website/site-settings-form";
import { settingsLabelList } from "@/components/admin/website/settings-labels";

export const metadata: Metadata = { title: "Firmendaten" };

export default async function CompanySettingsPage() {
  await requireAdmin();
  const settings = await getSiteSettings();
  const unfinished = unfinishedSettings(settings);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Website", href: "/admin/website" }, { label: "Firmendaten" }]}
        title="Firmendaten"
        description="Einmal hier pflegen, überall aktuell. Änderungen gelten sofort nach dem Speichern – ohne Veröffentlichen."
      />

      <div className="max-w-4xl space-y-6">
        <DisclosureCard title="Wo erscheinen diese Angaben?" summary="Impressum, Fußzeile, Kontaktseite, E-Mails und Platzhalter in Texten">
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-soft">
            <li>im Impressum (Modul „Firmenangaben“) und in der Fußzeile jeder Seite,</li>
            <li>auf der Kontaktseite und in den Modulen „Kontaktangaben“ und „Reaktionszeiten“,</li>
            <li>in E-Mails an Kunden und Interessenten,</li>
            <li>überall dort, wo in Texten Platzhalter wie {"{telefon}"} oder {"{email}"} stehen.</li>
          </ul>
        </DisclosureCard>

        {unfinished.length > 0 ? (
          <Alert tone="warning" title="Noch Platzhalter vorhanden">
            Bitte vor dem Livegang ersetzen: {settingsLabelList(unfinished)}.
          </Alert>
        ) : null}

        <SiteSettingsForm initial={settings} />
      </div>
    </>
  );
}

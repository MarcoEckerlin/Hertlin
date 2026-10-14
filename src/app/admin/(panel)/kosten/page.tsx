import type { Metadata } from "next";
import { Download } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CostFilterForm } from "@/components/admin/costs/cost-filter-form";
import { CostOverviewTable } from "@/components/admin/costs/cost-overview-table";
import { CostSummary } from "@/components/admin/costs/cost-summary";
import { requireAdmin } from "@/lib/auth";
import {
  costAccountHref,
  costFilterFormProps,
  costFilterParams,
  getCostOverview,
  parseCostFilter,
  periodLabel,
  withCostFilter,
  type CostOverviewRow,
} from "@/lib/costs";

export const metadata: Metadata = { title: "Kosten pro Konto" };

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const filter = parseCostFilter(await searchParams);
  const overview = await getCostOverview(filter);

  const label = periodLabel(filter.period);
  const accounts = overview.companies.length + overview.privates.length;
  const showOpen = filter.billing === "alle";
  const sumLabel = filter.billing === "offen" ? "Summe offen" : filter.billing === "abgerechnet" ? "Summe abgerechnet" : "Summe";
  const hrefOf = (row: CostOverviewRow) => costAccountHref(row.account, filter);
  const exportHref = withCostFilter("/admin/kosten/export", filter);
  const filtered = Object.keys(costFilterParams(filter)).length > 0;

  return (
    <div>
      <PageHeader
        title="Kosten pro Konto"
        description="Erfasste Kosten je Kunde. Öffnen Sie ein Konto, um aus offenen Positionen eine Rechnung zu erstellen."
        actions={
          <>
            <ButtonLink href="/admin/rechnungen" variant="ghost">
              Rechnungen
            </ButtonLink>
            {accounts > 0 ? (
              <a href={exportHref} className={buttonClasses("secondary")} download>
                <Download className="size-4" aria-hidden />
                CSV exportieren
              </a>
            ) : null}
          </>
        }
      />

      <div className="space-y-6">
        <CostFilterForm key={JSON.stringify(costFilterParams(filter))} action="/admin/kosten" {...costFilterFormProps(filter)} />

        {accounts === 0 ? (
          <EmptyState
            title={filter.billing === "offen" ? "Nichts offen" : "Keine Kosten für diese Auswahl"}
            action={
              filtered || filter.billing === "offen" ? (
                <ButtonLink href="/admin/kosten?abrechnung=alle" variant="secondary">
                  Alle Positionen anzeigen
                </ButtonLink>
              ) : null
            }
          >
            {filter.billing === "offen"
              ? `Für „${label}“ ist alles abgerechnet. Kosten erfassen Sie im jeweiligen Ticket.`
              : "Kosten erfassen Sie im jeweiligen Ticket. Wählen Sie einen anderen Zeitraum oder Abrechnungsstand."}
          </EmptyState>
        ) : (
          <>
            <CostSummary totals={overview.totals} billing={filter.billing} periodLabel={label} accounts={accounts} />
            <CostOverviewTable
              companies={overview.companies}
              privates={overview.privates}
              totals={overview.totals}
              showOpen={showOpen}
              sumLabel={sumLabel}
              hrefOf={hrefOf}
            />
            <p className="text-sm text-ink-muted">
              Zeitraum nach Leistungsdatum der Position. Arbeitszeit zählt Positionen der Art „Arbeitszeit“ mit der Einheit Std.
              oder Min. Privatkunden sind über ihre E-Mail-Adresse zusammengefasst.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

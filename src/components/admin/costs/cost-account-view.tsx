import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CostEntriesForm, type CostTicketGroup } from "@/components/admin/costs/cost-entries-form";
import { CostFilterForm } from "@/components/admin/costs/cost-filter-form";
import { CostSummary } from "@/components/admin/costs/cost-summary";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import {
  costAccountHref,
  costAccountParams,
  costFilterFormProps,
  costFilterParams,
  getAccountCostDetail,
  periodLabel,
  type CostFilter,
  type ResolvedCostAccount,
} from "@/lib/costs";
import { formatDate, formatMoney, formatQuantity, formatTicketNumber } from "@/lib/format";

/**
 * Positionen eines Kontos mit Filter, Kennzahlen und Sammelaktion.
 * Nur nach requireAdmin() verwenden.
 */
export async function CostAccountView({ resolved, filter }: { resolved: ResolvedCostAccount; filter: CostFilter }) {
  const detail = await getAccountCostDetail(resolved, filter);
  const label = periodLabel(filter.period);
  const basePath = costAccountHref(resolved.account);
  const [actionPath] = basePath.split("?");
  const hidden = resolved.account.kind === "company" ? {} : costAccountParams(resolved.account);

  const tickets: CostTicketGroup[] = detail.tickets.map((t) => ({
    id: t.id,
    number: formatTicketNumber(t.id),
    subject: t.subject,
    status: t.status,
    subCompany: t.subCompanyName,
    contactName: resolved.account.kind === "company" ? null : t.contactName,
    subtotal: formatMoney(t.totals.totalCents),
    entries: t.entries.map((e) => ({
      id: e.id,
      date: formatDate(e.performedAt),
      kind: labelOf(COST_KIND_LABELS, e.kind),
      description: e.description,
      quantity: `${formatQuantity(e.quantityHundredths)} ${e.unit}`,
      unitPrice: formatMoney(e.unitPriceCents),
      total: formatMoney(e.totalCents),
      totalCents: e.totalCents,
      billed: e.billed,
      billedLabel: e.billedAt ? formatDate(e.billedAt) : null,
      createdBy: e.createdByName,
    })),
  }));

  return (
    <div className="space-y-6">
      <CostFilterForm
        key={JSON.stringify(costFilterParams(filter))}
        action={actionPath}
        hidden={hidden}
        {...costFilterFormProps(filter)}
      />

      {tickets.length === 0 ? (
        <EmptyState
          title={filter.billing === "offen" ? "Nichts offen" : "Keine Positionen für diese Auswahl"}
          action={
            <ButtonLink
              href={costAccountHref(resolved.account, { period: { kind: "all" }, billing: "alle" })}
              variant="secondary"
            >
              Alle Positionen dieses Kontos
            </ButtonLink>
          }
        >
          {filter.billing === "offen"
            ? `Für „${label}“ ist bei ${resolved.label} alles abgerechnet.`
            : `${resolved.label} hat für „${label}“ keine Kostenpositionen.`}
        </EmptyState>
      ) : (
        <>
          <CostSummary totals={detail.totals} billing={filter.billing} periodLabel={label} />
          <CostEntriesForm
            tickets={tickets}
            account={costAccountParams(resolved.account)}
            total={formatMoney(detail.totals.totalCents)}
          />
          <p className="text-sm text-ink-muted">
            Positionen ändern oder löschen Sie im jeweiligen Ticket. „Abgerechnet“ markiert nur den Stand hier, eine Rechnung wird
            dabei nicht erstellt.
          </p>
        </>
      )}
    </div>
  );
}

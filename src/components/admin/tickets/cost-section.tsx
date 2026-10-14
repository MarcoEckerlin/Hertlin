import Link from "next/link";
import { Lock } from "lucide-react";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { deleteCostAction, markAllCostsBilledAction, toggleCostBilledAction } from "@/lib/actions/admin-costs";
import { COST_DEFAULTS, LABOR_BILLING_HINT } from "@/config/pricing";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmSubmitButton } from "@/components/admin/tickets/confirm-submit-button";
import { CostForm } from "@/components/admin/tickets/cost-form";
import { newCostValues } from "@/components/admin/tickets/cost-values";
import type { CostEntryRow } from "@/components/admin/tickets/data";

/**
 * Kosten eines Tickets. NUR rendern, wenn der angemeldete Benutzer Administrator ist –
 * die Seite entscheidet das (user.role === "ADMIN"), die Actions prüfen es erneut.
 */
export function CostSection({
  ticketId,
  costs,
  flash,
}: {
  ticketId: number;
  costs: CostEntryRow[];
  /** Rückmeldung nach Bearbeiten/Löschen (Query-Parameter „kosten“) */
  flash?: string;
}) {
  const total = costs.reduce((sum, c) => sum + c.totalCents, 0);
  const open = costs.filter((c) => !c.billed).reduce((sum, c) => sum + c.totalCents, 0);
  const openCount = costs.filter((c) => !c.billed).length;

  return (
    <section
      id="kosten"
      aria-labelledby="kosten-titel"
      className="scroll-mt-24 rounded-2xl border border-line bg-white shadow-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="kosten-titel" className="text-base font-bold text-ink">
            Kosten
          </h2>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <Lock className="size-3.5" aria-hidden />
            Nur für Administratoren sichtbar – Kunden und Techniker sehen diesen Abschnitt nicht.
          </p>
        </div>
        {openCount > 0 ? (
          <form action={markAllCostsBilledAction.bind(null, ticketId)}>
            <SubmitButton variant="secondary" size="sm" pendingText="Wird gespeichert …">
              {openCount === 1 ? "Als abgerechnet markieren" : `Alle ${openCount} als abgerechnet markieren`}
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {flash === "gespeichert" ? <Alert tone="success">Die Position ist gespeichert.</Alert> : null}
        {flash === "geloescht" ? <Alert tone="success">Die Position ist gelöscht.</Alert> : null}

        {costs.length > 0 ? (
          <Table>
            <THead>
              <tr>
                <TH>Datum</TH>
                <TH>Art</TH>
                <TH>Beschreibung</TH>
                <TH className="text-right">Menge</TH>
                <TH className="text-right">Einzelpreis</TH>
                <TH className="text-right">Gesamt</TH>
                <TH>Abgerechnet</TH>
                <TH>
                  <span className="sr-only">Aktionen</span>
                </TH>
              </tr>
            </THead>
            <tbody>
              {costs.map((cost) => (
                <TR key={cost.id}>
                  <TD className="whitespace-nowrap tabular-nums">{formatDate(cost.performedAt)}</TD>
                  <TD className="whitespace-nowrap">{labelOf(COST_KIND_LABELS, cost.kind)}</TD>
                  <TD>
                    <span className="block max-w-[18rem] break-words text-ink">{cost.description}</span>
                    {cost.createdBy ? <span className="block text-xs text-ink-muted">erfasst von {cost.createdBy.name}</span> : null}
                  </TD>
                  <TD className="text-right whitespace-nowrap tabular-nums">
                    {formatQuantity(cost.quantityHundredths)} {cost.unit}
                  </TD>
                  <TD className="text-right whitespace-nowrap tabular-nums">{formatMoney(cost.unitPriceCents)}</TD>
                  <TD className="text-right font-semibold whitespace-nowrap text-ink tabular-nums">
                    {formatMoney(cost.totalCents)}
                  </TD>
                  <TD className="whitespace-nowrap">
                    <form action={toggleCostBilledAction.bind(null, ticketId, cost.id)}>
                      <button
                        type="submit"
                        title={
                          cost.billed
                            ? `Abgerechnet${cost.billedAt ? ` am ${formatDate(cost.billedAt)}` : ""} – klicken, um auf „offen“ zurückzusetzen`
                            : "Als abgerechnet markieren"
                        }
                        aria-label={
                          cost.billed
                            ? `Abgerechnet. Auf „offen“ zurücksetzen: ${cost.description}`
                            : `Offen. Als abgerechnet markieren: ${cost.description}`
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset transition-colors",
                          cost.billed
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100",
                        )}
                      >
                        <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
                        {cost.billed ? "ja" : "offen"}
                      </button>
                    </form>
                  </TD>
                  <TD className="whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/tickets/${ticketId}/kosten/${cost.id}`}
                        className={buttonClasses("ghost", "sm")}
                        aria-label={`Bearbeiten: ${cost.description}`}
                      >
                        Bearbeiten
                      </Link>
                      <form action={deleteCostAction.bind(null, ticketId, cost.id)}>
                        <ConfirmSubmitButton
                          variant="ghost"
                          size="sm"
                          className="text-red-700 hover:bg-red-50 hover:text-red-800"
                          confirmText={`Position „${cost.description}“ (${formatMoney(cost.totalCents)}) wirklich löschen?`}
                          pendingText="…"
                          aria-label={`Löschen: ${cost.description}`}
                        >
                          Löschen
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
            <tfoot className="border-t border-line-strong bg-mist text-sm">
              <tr>
                <td colSpan={5} className="px-4 py-2.5 pl-5 text-right font-semibold text-ink">
                  Summe
                </td>
                <td className="px-4 py-2.5 text-right font-bold whitespace-nowrap text-ink tabular-nums">{formatMoney(total)}</td>
                <td colSpan={2} className="px-4 py-2.5 pr-5 text-xs whitespace-nowrap text-ink-muted">
                  {open > 0 ? (
                    <span className="font-semibold text-amber-800">davon offen {formatMoney(open)}</span>
                  ) : (
                    "alles abgerechnet"
                  )}
                </td>
              </tr>
            </tfoot>
          </Table>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong bg-mist px-4 py-5 text-sm text-ink-soft">
            Noch keine Kosten erfasst. Arbeitszeit, Anfahrt und Material tragen Sie unten ein – die Übersicht pro Kunde
            finden Sie unter{" "}
            <Link href="/admin/kosten" className="font-semibold text-brand-700 hover:underline">
              Kosten pro Konto
            </Link>
            .
          </p>
        )}

        <div className="rounded-xl bg-mist p-4 ring-1 ring-line ring-inset sm:p-5">
          <h3 className="mb-4 text-sm font-bold text-ink">Position hinzufügen</h3>
          <CostForm
            mode="add"
            ticketId={ticketId}
            initial={newCostValues(COST_DEFAULTS)}
            defaults={COST_DEFAULTS}
            laborHint={LABOR_BILLING_HINT}
          />
        </div>
      </div>
    </section>
  );
}

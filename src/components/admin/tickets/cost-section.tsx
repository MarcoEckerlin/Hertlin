import Link from "next/link";
import type { ReactNode } from "react";
import { Lock, Pencil, TriangleAlert } from "lucide-react";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { costEditBlock } from "@/lib/cost-catalog";
import { deleteCostAction, markAllCostsBilledAction } from "@/lib/actions/admin-costs";
import { LABOR_BILLING_HINT } from "@/config/pricing";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { FlashToast } from "@/components/ui/toaster";
import { CostBilledToggle } from "@/components/admin/tickets/cost-billed-toggle";
import { CostCapture } from "@/components/admin/tickets/cost-capture";
import { CostDeleteButton } from "@/components/admin/tickets/cost-delete-button";
import { CostPriceForm } from "@/components/admin/tickets/cost-price-form";
import type { PresetOption, StaffChoice } from "@/components/admin/tickets/cost-values";
import type { CostEntryRow, StaffCostEntryRow } from "@/components/admin/tickets/data";

type Viewer = { id: string; role: string };

type Common = {
  ticketId: number;
  viewer: Viewer;
  presets: PresetOption[];
  staff: StaffChoice[];
  /** YYYY-MM-DD (deutsche Zeit) */
  today: string;
  /** Rückmeldung nach Bearbeiten/Löschen (Query-Parameter „kosten“) */
  flash?: string;
};

/** Rückmeldungen nach einer Weiterleitung (?kosten=…) – erscheinen als kurze Meldung */
const FLASH_OK: Record<string, string> = {
  gespeichert: "Die Position ist gespeichert.",
  geloescht: "Die Position ist gelöscht.",
  preis: "Der Preis ist gespeichert.",
  "preis-katalog": "Der Preis ist gespeichert und gilt jetzt auch im Katalog.",
};

const FLASH_PROBLEM: Record<string, string> = {
  "preis-einheit": "Der Preis ist gespeichert. Im Katalog nicht, weil der Eintrag dort eine andere Einheit hat.",
  gesperrt: "Diese Position lässt sich nicht mehr ändern.",
  "preis-fehlt": "Ohne Preis kann die Position nicht als abgerechnet gelten. Tragen Sie zuerst den Preis ein.",
};

/**
 * „Leistungen und Material“ im Ticket – für alle Mitarbeiter.
 * Kompakte Liste (eine Zeile je Position, Details darunter), darunter „Position erfassen“ mit Schnellwahl.
 * Mit amounts (nur Administratoren) Preise, Summen und Abrechnung; sonst ausschließlich Mengen.
 * Die Seite entscheidet über canSeeCostAmounts() und lädt für Techniker gar keine Beträge.
 */
export function CostSection(props: Common & ({ amounts: true; costs: CostEntryRow[] } | { amounts: false; costs: StaffCostEntryRow[] })) {
  const { ticketId, viewer, presets, staff, today, flash } = props;
  const isAdmin = props.amounts;

  return (
    <section id="kosten" aria-labelledby="kosten-titel" className="scroll-mt-24 rounded-2xl border border-line bg-surface shadow-card">
      <FlashToast param="kosten" value={flash} messages={FLASH_OK} />
      <FlashToast param="kosten" value={flash} messages={FLASH_PROBLEM} tone="info" />

      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="kosten-titel" className="text-base font-bold text-ink">
            Leistungen und Material
          </h2>
          <p className="mt-0.5 flex items-start gap-1.5 text-xs text-ink-muted">
            <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
            {isAdmin
              ? "Intern – Kunden sehen diesen Abschnitt nicht. Preise und Summen sehen nur Administratoren."
              : "Intern – Kunden sehen diesen Abschnitt nicht. Tragen Sie ein, was Sie gebraucht haben; die Preise ergänzt die Verwaltung."}
          </p>
        </div>
        {props.amounts ? <MarkAllButton ticketId={ticketId} costs={props.costs} /> : null}
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-5">
        {props.amounts ? <MissingPrices ticketId={ticketId} costs={props.costs} /> : null}

        {props.costs.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Noch nichts erfasst.
            {isAdmin ? (
              <>
                {" "}
                Die Übersicht pro Kunde steht unter{" "}
                <Link href="/admin/kosten" className="font-semibold text-brand-700 hover:underline">
                  Kosten pro Konto
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : props.amounts ? (
          <AdminTable ticketId={ticketId} viewer={viewer} costs={props.costs} />
        ) : (
          <StaffTable ticketId={ticketId} viewer={viewer} costs={props.costs} />
        )}

        <CostCapture
          ticketId={ticketId}
          presets={presets}
          staff={staff}
          currentUserId={viewer.id}
          canSetPrice={isAdmin}
          laborHint={LABOR_BILLING_HINT}
          today={today}
        />
      </div>
    </section>
  );
}

/** Zweite Zeile einer Position: Datum, Art, Menge (und Preis), wer sie erbracht bzw. erfasst hat */
function metaLine(cost: StaffCostEntryRow, amount?: string): string {
  const performer = cost.performedBy?.name;
  const creator = cost.createdBy?.name;
  const quantity = `${formatQuantity(cost.quantityHundredths)} ${cost.unit}`;
  const parts: string[] = [formatDate(cost.performedAt), labelOf(COST_KIND_LABELS, cost.kind), amount ? `${quantity} × ${amount}` : quantity];
  if (performer) parts.push(`erbracht von ${performer}`);
  if (creator && cost.createdBy?.id !== cost.performedBy?.id) parts.push(`erfasst von ${creator}`);
  return parts.join(" · ");
}

function EntryCell({ cost, amount, badge }: { cost: StaffCostEntryRow; amount?: string; badge?: ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block font-medium break-words text-ink">{cost.description}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
        <span className="tabular-nums">{metaLine(cost, amount)}</span>
        {badge}
      </span>
    </div>
  );
}

function RowActions({
  ticketId,
  cost,
  confirmText,
}: {
  ticketId: number;
  cost: { id: string; description: string };
  confirmText: string;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Link
        href={`/admin/tickets/${ticketId}/kosten/${cost.id}`}
        className="inline-flex size-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-brand-50 hover:text-ink"
        aria-label={`Bearbeiten: ${cost.description}`}
        title="Bearbeiten"
      >
        <Pencil className="size-4" aria-hidden />
      </Link>
      <form action={deleteCostAction.bind(null, ticketId, cost.id)}>
        <CostDeleteButton label={`Löschen: ${cost.description}`} confirmText={confirmText} />
      </form>
    </div>
  );
}

const descCell = "w-full min-w-[12rem] py-2.5";
const sideCell = "py-2.5 whitespace-nowrap";

/* ------------------------------------------------------------------ */
/* Techniker: Positionen ohne Beträge                                  */
/* ------------------------------------------------------------------ */

function StaffTable({ ticketId, viewer, costs }: { ticketId: number; viewer: Viewer; costs: StaffCostEntryRow[] }) {
  return (
    <Table stack aria-label="Erfasste Leistungen und Material" className="min-w-0">
      <THead>
        <tr>
          <TH>Leistung</TH>
          <TH>Stand</TH>
          <TH>
            <span className="sr-only">Aktionen</span>
          </TH>
        </tr>
      </THead>
      <tbody>
        {costs.map((cost) => {
          const locked = cost.billed || cost.invoiceId !== null;
          const editable = costEditBlock(viewer, cost) === null;
          return (
            <TR key={cost.id}>
              <TD className={descCell}>
                <EntryCell cost={cost} />
              </TD>
              <TD label="Stand" className={sideCell}>
                {locked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted">
                    <Lock className="size-3.5" aria-hidden />
                    abgerechnet
                  </span>
                ) : (
                  <span className="text-xs">erfasst</span>
                )}
              </TD>
              <TD className={sideCell}>
                {editable ? (
                  <RowActions ticketId={ticketId} cost={cost} confirmText={`Position „${cost.description}“ wirklich löschen?`} />
                ) : null}
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}

/* ------------------------------------------------------------------ */
/* Administratoren: mit Preisen, Summen und Abrechnung                 */
/* ------------------------------------------------------------------ */

function MarkAllButton({ ticketId, costs }: { ticketId: number; costs: CostEntryRow[] }) {
  const markable = costs.filter((c) => !c.billed && !c.invoiceId && !c.needsPrice).length;
  if (markable === 0) return null;
  return (
    <form action={markAllCostsBilledAction.bind(null, ticketId)}>
      <SubmitButton variant="secondary" size="sm" pendingText="Wird gespeichert …">
        {markable === 1 ? "Als abgerechnet markieren" : `Alle ${markable} als abgerechnet markieren`}
      </SubmitButton>
    </form>
  );
}

function MissingPrices({ ticketId, costs }: { ticketId: number; costs: CostEntryRow[] }) {
  const missing = costs.filter((c) => c.needsPrice && !c.invoiceId);
  if (missing.length === 0) return null;
  return (
    <div
      role="region"
      aria-labelledby="preis-fehlt-titel"
      className="rounded-xl bg-warning-soft p-4 ring-1 ring-warning-line ring-inset sm:p-5"
    >
      <h3 id="preis-fehlt-titel" className="flex items-center gap-2 text-sm font-bold text-warning-ink">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {missing.length === 1 ? "Preis fehlt bei 1 Position" : `Preis fehlt bei ${missing.length} Positionen`}
      </h3>
      <p className="mt-1 text-sm text-warning-ink">
        Ohne Katalogpreis erfasst. Bis der Preis eingetragen ist, zählt die Position in keiner Summe und kann nicht abgerechnet
        werden.
      </p>
      <ul className="mt-3 space-y-3">
        {missing.map((cost) => (
          <li key={cost.id} className="rounded-lg bg-surface p-3 ring-1 ring-warning-line ring-inset sm:p-4">
            <p className="text-sm font-semibold break-words text-ink">{cost.description}</p>
            <p className="mb-2.5 text-xs text-ink-muted">
              {formatQuantity(cost.quantityHundredths)} {cost.unit} · {formatDate(cost.performedAt)}
              {cost.performedBy ? ` · erbracht von ${cost.performedBy.name}` : ""}
            </p>
            <CostPriceForm
              ticketId={ticketId}
              costId={cost.id}
              description={cost.description}
              quantityHundredths={cost.quantityHundredths}
              unit={cost.unit}
              catalogName={cost.preset?.name ?? null}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminTable({ ticketId, viewer, costs }: { ticketId: number; viewer: Viewer; costs: CostEntryRow[] }) {
  const priced = costs.filter((c) => !c.needsPrice);
  const total = priced.reduce((sum, c) => sum + c.totalCents, 0);
  const open = priced.filter((c) => !c.billed).reduce((sum, c) => sum + c.totalCents, 0);
  const missing = costs.length - priced.length;

  return (
    <Table stack aria-label="Erfasste Leistungen und Material" className="min-w-0">
      <THead>
        <tr>
          <TH>Leistung</TH>
          <TH className="text-right">Gesamt</TH>
          <TH>Abgerechnet</TH>
          <TH>
            <span className="sr-only">Aktionen</span>
          </TH>
        </tr>
      </THead>
      <tbody>
        {costs.map((cost) => {
          const block = costEditBlock(viewer, cost);
          return (
            <TR key={cost.id} className={cost.needsPrice ? "bg-warning-soft/50" : undefined}>
              <TD className={descCell}>
                <EntryCell
                  cost={cost}
                  amount={cost.needsPrice ? undefined : formatMoney(cost.unitPriceCents)}
                  badge={cost.needsPrice ? <Badge tone="amber">Preis fehlt</Badge> : null}
                />
              </TD>
              <TD label="Gesamt" className={`${sideCell} text-right font-semibold text-ink tabular-nums`}>
                {cost.needsPrice ? <span className="font-normal text-ink-muted">–</span> : formatMoney(cost.totalCents)}
              </TD>
              <TD label="Abgerechnet" className={sideCell}>
                <BilledCell ticketId={ticketId} cost={cost} />
              </TD>
              <TD className={sideCell}>
                {block === null ? (
                  <RowActions
                    ticketId={ticketId}
                    cost={cost}
                    confirmText={
                      cost.needsPrice
                        ? `Position „${cost.description}“ wirklich löschen?`
                        : `Position „${cost.description}“ (${formatMoney(cost.totalCents)}) wirklich löschen?`
                    }
                  />
                ) : null}
              </TD>
            </TR>
          );
        })}
      </tbody>
      <tfoot className="border-t border-line-strong bg-mist text-sm max-sm:block">
        <tr className="max-sm:block">
          <td colSpan={4} className="px-4 py-2.5 first:pl-5 last:pr-5 max-sm:block">
            <div className="flex w-full flex-wrap items-baseline justify-end gap-x-4 gap-y-1 text-right">
              <span className="font-semibold text-ink">
                Summe <span className="ml-2 font-bold tabular-nums">{formatMoney(total)}</span>
              </span>
              <span className="text-xs text-ink-muted">
                {open > 0 ? (
                  <span className="font-semibold text-warning-ink">davon offen {formatMoney(open)}</span>
                ) : (
                  "alles abgerechnet"
                )}
                {missing > 0 ? (
                  <span className="block text-warning-ink">
                    {missing === 1 ? "1 Position ohne Preis nicht enthalten" : `${missing} Positionen ohne Preis nicht enthalten`}
                  </span>
                ) : null}
              </span>
            </div>
          </td>
        </tr>
      </tfoot>
    </Table>
  );
}

function BilledCell({ ticketId, cost }: { ticketId: number; cost: CostEntryRow }) {
  if (cost.invoice) {
    return (
      <Link
        href={`/admin/rechnungen/${cost.invoice.id}`}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
        title={`Steht auf Rechnung ${cost.invoice.number} – nur über die Rechnung änderbar`}
      >
        <Lock className="size-3.5" aria-hidden />
        {cost.invoice.number}
      </Link>
    );
  }
  if (cost.needsPrice) {
    return <span className="text-xs text-ink-muted">offen</span>;
  }
  return (
    <CostBilledToggle
      ticketId={ticketId}
      costId={cost.id}
      billed={cost.billed}
      billedAtLabel={cost.billedAt ? formatDate(cost.billedAt) : null}
      description={cost.description}
    />
  );
}

import Link from "next/link";
import { Lock, Pencil, TriangleAlert } from "lucide-react";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { costEditBlock } from "@/lib/cost-catalog";
import { deleteCostAction, markAllCostsBilledAction, toggleCostBilledAction } from "@/lib/actions/admin-costs";
import { LABOR_BILLING_HINT } from "@/config/pricing";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TR } from "@/components/ui/table";
import { CostDeleteButton } from "@/components/admin/tickets/cost-delete-button";
import { CostAddForm } from "@/components/admin/tickets/cost-add-form";
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

/**
 * „Leistungen und Material“ im Ticket – für alle Mitarbeiter.
 * Mit amounts (nur Administratoren) Preise, Summen und Abrechnung; sonst ausschließlich Mengen.
 * Die Seite entscheidet über canSeeCostAmounts() und lädt für Techniker gar keine Beträge.
 */
export function CostSection(props: Common & ({ amounts: true; costs: CostEntryRow[] } | { amounts: false; costs: StaffCostEntryRow[] })) {
  const { ticketId, viewer, presets, staff, today, flash } = props;
  const isAdmin = props.amounts;

  return (
    <section id="kosten" aria-labelledby="kosten-titel" className="scroll-mt-24 rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="kosten-titel" className="text-base font-bold text-ink">
            Leistungen und Material
          </h2>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-ink-muted">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {isAdmin
              ? "Intern – Kunden sehen diesen Abschnitt nicht. Preise und Summen sehen nur Administratoren."
              : "Intern – Kunden sehen diesen Abschnitt nicht. Tragen Sie ein, was Sie gebraucht haben; die Preise ergänzt die Verwaltung."}
          </p>
        </div>
        {props.amounts ? <MarkAllButton ticketId={ticketId} costs={props.costs} /> : null}
      </div>

      <div className="space-y-5 px-5 py-5 sm:px-6">
        <Flash flash={flash} />

        {props.amounts ? <MissingPrices ticketId={ticketId} costs={props.costs} /> : null}

        {props.costs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong bg-mist px-4 py-5 text-sm text-ink-soft">
            Noch nichts erfasst. Arbeitszeit, Anfahrt und Material tragen Sie unten ein
            {isAdmin ? (
              <>
                {" "}
                – die Übersicht pro Kunde finden Sie unter{" "}
                <Link href="/admin/kosten" className="font-semibold text-brand-700 hover:underline">
                  Kosten pro Konto
                </Link>
                .
              </>
            ) : (
              "."
            )}
          </p>
        ) : props.amounts ? (
          <AdminTable ticketId={ticketId} viewer={viewer} costs={props.costs} />
        ) : (
          <StaffTable ticketId={ticketId} viewer={viewer} costs={props.costs} />
        )}

        <div className="rounded-xl bg-mist p-4 ring-1 ring-line ring-inset sm:p-5">
          <h3 className="mb-4 text-sm font-bold text-ink">Position erfassen</h3>
          <CostAddForm
            ticketId={ticketId}
            presets={presets}
            staff={staff}
            currentUserId={viewer.id}
            canSetPrice={isAdmin}
            laborHint={LABOR_BILLING_HINT}
            today={today}
          />
        </div>
      </div>
    </section>
  );
}

const FLASH: Record<string, { tone: "success" | "warning"; text: string }> = {
  gespeichert: { tone: "success", text: "Die Position ist gespeichert." },
  geloescht: { tone: "success", text: "Die Position ist gelöscht." },
  preis: { tone: "success", text: "Der Preis ist gespeichert." },
  "preis-katalog": { tone: "success", text: "Der Preis ist gespeichert und gilt jetzt auch im Katalog." },
  "preis-einheit": {
    tone: "warning",
    text: "Der Preis ist gespeichert. Im Katalog nicht, weil der Eintrag dort eine andere Einheit hat.",
  },
  gesperrt: { tone: "warning", text: "Diese Position lässt sich nicht mehr ändern." },
  "preis-fehlt": { tone: "warning", text: "Ohne Preis kann die Position nicht als abgerechnet gelten. Tragen Sie zuerst den Preis ein." },
};

function Flash({ flash }: { flash?: string }) {
  const entry = flash ? FLASH[flash] : undefined;
  if (!entry) return null;
  return <Alert tone={entry.tone}>{entry.text}</Alert>;
}

/*
 * Kompakte Zellen: Der Abschnitt steht in der schmalen Hauptspalte des Tickets und soll dort ohne
 * seitliches Scrollen auskommen (auf dem Handy scrollt nur die Tabelle selbst).
 */
const th = "px-3 py-3 font-semibold whitespace-nowrap first:pl-5 last:pr-4";
const td = "px-3 py-3 align-middle text-ink-soft first:pl-5 last:pr-4";

/** Beschreibung mit Art, „erbracht von …“ und – falls jemand anderes erfasst hat – „erfasst von …“ */
function EntryCell({ cost }: { cost: StaffCostEntryRow }) {
  const performer = cost.performedBy?.name;
  const creator = cost.createdBy?.name;
  const parts: string[] = [labelOf(COST_KIND_LABELS, cost.kind)];
  if (performer) parts.push(`erbracht von ${performer}`);
  if (creator && cost.createdBy?.id !== cost.performedBy?.id) parts.push(`erfasst von ${creator}`);
  return (
    <>
      <span className="block min-w-[10rem] break-words text-ink">{cost.description}</span>
      <span className="block text-xs text-ink-muted">{parts.join(" · ")}</span>
    </>
  );
}

function LockedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted">
      <Lock className="size-3.5" aria-hidden />
      {label}
    </span>
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

/* ------------------------------------------------------------------ */
/* Techniker: Positionen ohne Beträge                                  */
/* ------------------------------------------------------------------ */

function StaffTable({ ticketId, viewer, costs }: { ticketId: number; viewer: Viewer; costs: StaffCostEntryRow[] }) {
  return (
    <Table aria-label="Erfasste Leistungen und Material">
      <THead>
        <tr>
          <th scope="col" className={th}>
            Datum
          </th>
          <th scope="col" className={th}>
            Leistung
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Menge
          </th>
          <th scope="col" className={th}>
            Stand
          </th>
          <th scope="col" className={th}>
            <span className="sr-only">Aktionen</span>
          </th>
        </tr>
      </THead>
      <tbody>
        {costs.map((cost) => {
          const locked = cost.billed || cost.invoiceId !== null;
          const editable = costEditBlock(viewer, cost) === null;
          return (
            <TR key={cost.id}>
              <td className={cn(td, "whitespace-nowrap tabular-nums")}>{formatDate(cost.performedAt)}</td>
              <td className={td}>
                <EntryCell cost={cost} />
              </td>
              <td className={cn(td, "text-right whitespace-nowrap tabular-nums")}>
                {formatQuantity(cost.quantityHundredths)} {cost.unit}
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
                {locked ? <LockedBadge label="abgerechnet" /> : <span className="text-xs">erfasst</span>}
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
                {editable ? (
                  <RowActions ticketId={ticketId} cost={cost} confirmText={`Position „${cost.description}“ wirklich löschen?`} />
                ) : null}
              </td>
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
    <div role="region" aria-labelledby="preis-fehlt-titel" className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 ring-inset sm:p-5">
      <h3 id="preis-fehlt-titel" className="flex items-center gap-2 text-sm font-bold text-amber-900">
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {missing.length === 1 ? "Preis fehlt bei 1 Position" : `Preis fehlt bei ${missing.length} Positionen`}
      </h3>
      <p className="mt-1 text-sm text-amber-900">
        Ohne Katalogpreis erfasst. Bis der Preis eingetragen ist, zählt die Position in keiner Summe und kann nicht abgerechnet
        werden.
      </p>
      <ul className="mt-3 space-y-3">
        {missing.map((cost) => (
          <li key={cost.id} className="rounded-lg bg-white p-3 ring-1 ring-amber-200 ring-inset sm:p-4">
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
    <Table aria-label="Erfasste Leistungen und Material">
      <THead>
        <tr>
          <th scope="col" className={th}>
            Datum
          </th>
          <th scope="col" className={th}>
            Leistung
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Menge
          </th>
          <th scope="col" className={cn(th, "text-right")}>
            Gesamt
          </th>
          <th scope="col" className={th}>
            Abgerechnet
          </th>
          <th scope="col" className={th}>
            <span className="sr-only">Aktionen</span>
          </th>
        </tr>
      </THead>
      <tbody>
        {costs.map((cost) => {
          const block = costEditBlock(viewer, cost);
          return (
            <TR key={cost.id} className={cost.needsPrice ? "bg-amber-50/40" : undefined}>
              <td className={cn(td, "whitespace-nowrap tabular-nums")}>{formatDate(cost.performedAt)}</td>
              <td className={td}>
                <EntryCell cost={cost} />
              </td>
              <td className={cn(td, "text-right whitespace-nowrap tabular-nums")}>
                <span className="block">
                  {formatQuantity(cost.quantityHundredths)} {cost.unit}
                </span>
                {cost.needsPrice ? (
                  <Badge tone="amber">Preis fehlt</Badge>
                ) : (
                  <span className="block text-xs text-ink-muted">je {formatMoney(cost.unitPriceCents)}</span>
                )}
              </td>
              <td className={cn(td, "text-right font-semibold whitespace-nowrap text-ink tabular-nums")}>
                {cost.needsPrice ? <span className="font-normal text-ink-muted">–</span> : formatMoney(cost.totalCents)}
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
                <BilledCell ticketId={ticketId} cost={cost} />
              </td>
              <td className={cn(td, "whitespace-nowrap")}>
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
              </td>
            </TR>
          );
        })}
      </tbody>
      <tfoot className="border-t border-line-strong bg-mist text-sm">
        <tr>
          <td colSpan={3} className="px-3 py-2.5 pl-5 text-right font-semibold text-ink">
            Summe
          </td>
          <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap text-ink tabular-nums">{formatMoney(total)}</td>
          <td colSpan={2} className="px-3 py-2.5 pr-4 text-xs text-ink-muted">
            <span className="block whitespace-nowrap">
              {open > 0 ? (
                <span className="font-semibold text-amber-800">davon offen {formatMoney(open)}</span>
              ) : (
                "alles abgerechnet"
              )}
            </span>
            {missing > 0 ? (
              <span className="block text-amber-800">
                {missing === 1 ? "1 Position ohne Preis nicht enthalten" : `${missing} Positionen ohne Preis nicht enthalten`}
              </span>
            ) : null}
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
    <form action={toggleCostBilledAction.bind(null, ticketId, cost.id)}>
      <button
        type="submit"
        title={
          cost.billed
            ? `Abgerechnet${cost.billedAt ? ` am ${formatDate(cost.billedAt)}` : ""} – klicken, um auf „offen“ zurückzusetzen`
            : "Als abgerechnet markieren"
        }
        aria-label={
          cost.billed ? `Abgerechnet. Auf „offen“ zurücksetzen: ${cost.description}` : `Offen. Als abgerechnet markieren: ${cost.description}`
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
  );
}

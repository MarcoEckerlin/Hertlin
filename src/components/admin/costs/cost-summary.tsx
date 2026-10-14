import type { ReactNode } from "react";
import { formatHours, type BillingFilter, type CostTotals } from "@/lib/costs";
import { formatMoney } from "@/lib/format";

function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1 text-xl font-bold tracking-tight text-ink tabular-nums sm:text-2xl">{value}</dd>
      {note ? <dd className="mt-0.5 text-xs text-ink-muted">{note}</dd> : null}
    </div>
  );
}

/** Kennzahlen über der Kostentabelle. Nur für Administratoren. */
export function CostSummary({
  totals,
  billing,
  periodLabel,
  accounts,
}: {
  totals: CostTotals;
  billing: BillingFilter;
  periodLabel: string;
  /** Anzahl Konten (nur Übersicht) */
  accounts?: number;
}) {
  const sumLabel = billing === "offen" ? "Noch nicht abgerechnet" : billing === "abgerechnet" ? "Abgerechnet" : "Summe";
  const hours = formatHours(totals.laborMinutes);
  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Tile label={sumLabel} value={formatMoney(totals.totalCents)} note={periodLabel} />
      {billing === "alle" ? (
        <Tile label="davon offen" value={formatMoney(totals.openCents)} note={`${formatMoney(totals.billedCents)} abgerechnet`} />
      ) : (
        <Tile
          label="Positionen"
          value={totals.entries}
          note={totals.tickets === 1 ? "aus 1 Ticket" : `aus ${totals.tickets} Tickets`}
        />
      )}
      <Tile label="Arbeitszeit" value={`${hours} Std.`} note="Positionen in Std. oder Min." />
      {accounts !== undefined ? (
        <Tile
          label="Konten"
          value={accounts}
          note={totals.tickets === 1 ? "1 Ticket mit Kosten" : `${totals.tickets} Tickets mit Kosten`}
        />
      ) : (
        <Tile label="Material" value={formatMoney(totals.materialCents)} />
      )}
    </dl>
  );
}

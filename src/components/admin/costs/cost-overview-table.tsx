import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatHours, type CostOverviewRow, type CostTotals } from "@/lib/costs";
import { formatMoney } from "@/lib/format";

/** Tabelle „Kosten pro Konto“: Firmenkunden (mit Aufschlüsselung nach Unterkunden) und Privatkunden. Nur für Administratoren. */

type Column = "tickets" | "hours" | "material" | "total" | "open";

const num = "px-4 py-3 text-right tabular-nums whitespace-nowrap";

function Cells({
  totals,
  showOpen,
  sumLabel,
  muted,
}: {
  totals: CostTotals;
  showOpen: boolean;
  sumLabel: string;
  muted?: boolean;
}) {
  const cls = cn(num, muted ? "text-ink-muted" : "text-ink-soft");
  return (
    <>
      <td data-label="Tickets mit Kosten" className={cls}>
        {totals.tickets}
      </td>
      <td data-label="Arbeitszeit (Std.)" className={cls}>
        {totals.laborMinutes > 0 ? formatHours(totals.laborMinutes) : "–"}
      </td>
      <td data-label="Material" className={cls}>
        {totals.materialCents > 0 ? formatMoney(totals.materialCents) : "–"}
      </td>
      <td data-label={sumLabel} className={cn(num, muted ? "text-ink-muted" : "font-semibold text-ink")}>
        {formatMoney(totals.totalCents)}
      </td>
      {showOpen ? (
        <td
          data-label="davon offen"
          className={cn(num, muted ? "text-ink-muted" : totals.openCents > 0 ? "font-semibold text-warning-ink" : "text-ink-muted")}
        >
          {totals.openCents > 0 ? formatMoney(totals.openCents) : "–"}
        </td>
      ) : null}
    </>
  );
}

function GroupHeader({ label, count, colSpan }: { label: string; count: number; colSpan: number }) {
  return (
    <tr className="border-b border-line bg-mist">
      <th
        scope="colgroup"
        colSpan={colSpan}
        className="px-5 py-2 text-left text-xs font-bold tracking-wide text-ink-muted uppercase"
      >
        {label} <span className="font-semibold normal-case">({count})</span>
      </th>
    </tr>
  );
}

export function CostOverviewTable({
  companies,
  privates,
  totals,
  showOpen,
  sumLabel,
  hrefOf,
}: {
  companies: CostOverviewRow[];
  privates: CostOverviewRow[];
  totals: CostTotals;
  showOpen: boolean;
  sumLabel: string;
  hrefOf: (row: CostOverviewRow) => string;
}) {
  const columns: Column[] = ["tickets", "hours", "material", "total", ...(showOpen ? (["open"] as const) : [])];
  const colSpan = columns.length + 2;

  const accountRow = (row: CostOverviewRow): ReactNode => {
    const href = hrefOf(row);
    return (
      <tr key={row.key} className="group relative border-b border-line hover:bg-brand-50/50">
        <td className="px-4 py-3 pl-5">
          <div className="min-w-0">
            {/* Die ganze Zeile führt zum Konto */}
            <Link
              href={href}
              className="font-semibold break-words text-ink after:absolute after:inset-0 group-hover:text-brand-700 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-600"
            >
              {row.label}
            </Link>
            <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
              {row.sublabel ? <span className="[overflow-wrap:anywhere]">{row.sublabel}</span> : null}
              {!row.active ? <Badge tone="gray">deaktiviert</Badge> : null}
              {row.totals.unpricedEntries > 0 ? (
                <Badge tone="orange">
                  {row.totals.unpricedEntries === 1 ? "1 Position ohne Preis" : `${row.totals.unpricedEntries} ohne Preis`}
                </Badge>
              ) : null}
            </span>
          </div>
        </td>
        <Cells totals={row.totals} showOpen={showOpen} sumLabel={sumLabel} />
        <td className="w-10 px-2 py-3 pr-4 text-right max-sm:hidden!" aria-hidden>
          <ChevronRight className="inline size-4 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5" />
        </td>
      </tr>
    );
  };

  return (
    // Auf dem Handy wird jedes Konto zur Karte (table-stack); die Aufschlüsselung nach Unterkunden steht dann im Konto
    <div className="scroll-shadow-x table-stack relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
        <caption className="sr-only">Kosten pro Konto</caption>
        <thead className="border-b border-line bg-mist text-xs text-ink-muted">
          <tr>
            <th scope="col" className="px-4 py-3 pl-5 font-semibold">
              Konto
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
              Tickets mit Kosten
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
              Arbeitszeit (Std.)
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
              Material
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
              {sumLabel}
            </th>
            {showOpen ? (
              <th scope="col" className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                davon offen
              </th>
            ) : null}
            <th scope="col" className="w-10 px-2 py-3 pr-4">
              <span className="sr-only">Öffnen</span>
            </th>
          </tr>
        </thead>

        {companies.length > 0 ? (
          <tbody>
            <GroupHeader label="Firmenkunden" count={companies.length} colSpan={colSpan} />
            {companies.flatMap((row) => [
              accountRow(row),
              ...row.breakdown.map((part) => (
                <tr key={`${row.key}:${part.companyId}`} className="border-b border-line bg-surface text-[0.8125rem] max-sm:hidden!">
                  <td className="py-2 pr-4 pl-10">
                    <span className="text-ink-soft">
                      <span aria-hidden className="mr-1.5 text-ink-muted">
                        └
                      </span>
                      {part.isRoot ? "Firmenkunde direkt" : part.label}
                    </span>
                  </td>
                  <Cells totals={part.totals} showOpen={showOpen} sumLabel={sumLabel} muted />
                  <td />
                </tr>
              )),
            ])}
          </tbody>
        ) : null}

        {privates.length > 0 ? (
          <tbody>
            <GroupHeader label="Privatkunden" count={privates.length} colSpan={colSpan} />
            {privates.map(accountRow)}
          </tbody>
        ) : null}

        <tfoot className="border-t-2 border-line-strong bg-mist max-sm:block">
          <tr>
            <th scope="row" className="px-4 py-3 pl-5 text-left font-bold text-ink max-sm:block max-sm:p-0 max-sm:pb-1">
              Gesamt
            </th>
            <td data-label="Tickets mit Kosten" className={cn(num, "font-semibold text-ink")}>
              {totals.tickets}
            </td>
            <td data-label="Arbeitszeit (Std.)" className={cn(num, "font-semibold text-ink")}>
              {totals.laborMinutes > 0 ? formatHours(totals.laborMinutes) : "–"}
            </td>
            <td data-label="Material" className={cn(num, "font-semibold text-ink")}>
              {totals.materialCents > 0 ? formatMoney(totals.materialCents) : "–"}
            </td>
            <td data-label={sumLabel} className={cn(num, "font-bold text-ink")}>
              {formatMoney(totals.totalCents)}
            </td>
            {showOpen ? (
              <td data-label="davon offen" className={cn(num, "font-bold", totals.openCents > 0 ? "text-warning-ink" : "text-ink-muted")}>
                {totals.openCents > 0 ? formatMoney(totals.openCents) : "–"}
              </td>
            ) : null}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

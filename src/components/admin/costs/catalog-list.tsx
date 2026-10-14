import Link from "next/link";
import { deletePresetAction, togglePresetActiveAction } from "@/lib/actions/admin-cost-catalog";
import { COST_KINDS, COST_KIND_LABELS } from "@/lib/constants";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { toCostKind } from "@/lib/cost-catalog";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmSubmitButton } from "@/components/admin/tickets/confirm-submit-button";

export type CatalogRow = {
  id: string;
  kind: string;
  name: string;
  unit: string;
  unitPriceCents: number | null;
  defaultQuantityHundredths: number;
  active: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  entryCount: number;
  createdByName: string | null;
};

/** Katalog nach Art gruppiert: je Art eine Tabelle mit Überschrift. */
export function CatalogList({ rows }: { rows: CatalogRow[] }) {
  const groups = COST_KINDS.map((kind) => ({
    kind,
    label: COST_KIND_LABELS[kind],
    rows: rows.filter((r) => toCostKind(r.kind) === kind),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.kind} aria-labelledby={`katalog-${group.kind}`}>
          <h2 id={`katalog-${group.kind}`} className="mb-3 flex items-baseline gap-2 text-lg font-bold text-ink">
            {group.label}
            <span className="text-sm font-semibold text-ink-muted tabular-nums">{group.rows.length}</span>
          </h2>
          <Table stack aria-labelledby={`katalog-${group.kind}`}>
            <THead>
              <tr>
                <TH>Bezeichnung</TH>
                <TH>Einheit</TH>
                <TH className="text-right">Preis netto</TH>
                <TH className="text-right">Standardmenge</TH>
                <TH className="text-right">Benutzt</TH>
                <TH>Status</TH>
                <TH>
                  <span className="sr-only">Aktionen</span>
                </TH>
              </tr>
            </THead>
            <tbody>
              {group.rows.map((row) => (
                <CatalogTableRow key={row.id} row={row} />
              ))}
            </tbody>
          </Table>
        </section>
      ))}
    </div>
  );
}

function CatalogTableRow({ row }: { row: CatalogRow }) {
  const deletable = row.usageCount === 0 && row.entryCount === 0;
  // Zähler oder – falls höher, z. B. bei importierten Daten – Zahl der Positionen mit diesem Eintrag
  const uses = Math.max(row.usageCount, row.entryCount);
  return (
    <TR className={row.active ? undefined : "bg-mist/60"}>
      <TD className="min-w-[14rem]">
        <div className="min-w-0">
          <Link href={`/admin/kosten/katalog/${row.id}`} className="font-semibold break-words text-ink hover:underline">
            {row.name}
          </Link>
          {row.createdByName ? <span className="block text-xs text-ink-muted">angelegt von {row.createdByName}</span> : null}
        </div>
      </TD>
      <TD label="Einheit" className="whitespace-nowrap">
        {row.unit}
      </TD>
      <TD label="Preis netto" className="text-right whitespace-nowrap tabular-nums">
        {row.unitPriceCents === null ? (
          <span className="text-ink-muted">je Position</span>
        ) : (
          <span className="font-semibold text-ink">{formatMoney(row.unitPriceCents)}</span>
        )}
      </TD>
      <TD label="Standardmenge" className="text-right whitespace-nowrap tabular-nums">
        {formatQuantity(row.defaultQuantityHundredths)} {row.unit}
      </TD>
      <TD label="Benutzt" className="text-right whitespace-nowrap tabular-nums">
        {uses === 0 ? (
          <span className="text-ink-muted">noch nie</span>
        ) : (
          <div>
            {uses}×
            {row.lastUsedAt ? <span className="block text-xs text-ink-muted">zuletzt {formatDate(row.lastUsedAt)}</span> : null}
          </div>
        )}
      </TD>
      <TD label="Status" className="whitespace-nowrap">
        {row.active ? <Badge tone="green">aktiv</Badge> : <Badge tone="gray">deaktiviert</Badge>}
      </TD>
      <TD className="whitespace-nowrap">
        <div className="-mx-2 flex flex-wrap items-center justify-end gap-1 sm:mx-0">
          <Link
            href={`/admin/kosten/katalog/${row.id}`}
            className={buttonClasses("ghost", "sm")}
            aria-label={`Bearbeiten: ${row.name}`}
          >
            Bearbeiten
          </Link>
          <form action={togglePresetActiveAction.bind(null, row.id)}>
            <SubmitButton
              variant="ghost"
              size="sm"
              pendingText="…"
              aria-label={row.active ? `Deaktivieren: ${row.name}` : `Aktivieren: ${row.name}`}
            >
              {row.active ? "Deaktivieren" : "Aktivieren"}
            </SubmitButton>
          </form>
          {deletable ? (
            <form action={deletePresetAction.bind(null, row.id)}>
              <ConfirmSubmitButton
                variant="ghost"
                size="sm"
                className="text-danger-ink hover:bg-danger-soft hover:text-danger-ink"
                confirmText={`„${row.name}“ aus dem Katalog löschen?`}
                pendingText="…"
                aria-label={`Löschen: ${row.name}`}
              >
                Löschen
              </ConfirmSubmitButton>
            </form>
          ) : null}
        </div>
      </TD>
    </TR>
  );
}

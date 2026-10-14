import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import { SMALL_BUSINESS_NOTE, formatTaxRate } from "@/lib/invoices/calc";

type Line = {
  id: string;
  position: number;
  description: string;
  reference: string | null;
  performedAt: Date | null;
  quantityHundredths: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
};

/** Positionen und Summen einer Rechnung, wie sie auf dem PDF stehen. */
export function InvoiceLines({
  lines,
  netCents,
  taxRateBasisPoints,
  taxCents,
  grossCents,
  smallBusiness,
}: {
  lines: Line[];
  netCents: number;
  taxRateBasisPoints: number;
  taxCents: number;
  grossCents: number;
  smallBusiness: boolean;
}) {
  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <caption className="sr-only">Positionen</caption>
          <thead className="border-b border-line bg-mist text-xs text-ink-muted">
            <tr>
              <th scope="col" className="w-12 py-2.5 pl-5 font-semibold">
                Pos.
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Beschreibung
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Menge
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Einzelpreis
              </th>
              <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-semibold">
                Gesamt
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="py-2.5 pl-5 align-top text-ink-muted tabular-nums">{l.position}</td>
                <td className="px-3 py-2.5 align-top text-ink">
                  <span className="break-words">{l.description}</span>
                  <span className="block text-xs text-ink-muted">
                    {[l.reference, l.performedAt ? formatDate(l.performedAt) : null].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right align-top whitespace-nowrap text-ink-soft tabular-nums">
                  {formatQuantity(l.quantityHundredths)} {l.unit}
                </td>
                <td className="px-3 py-2.5 text-right align-top whitespace-nowrap text-ink-soft tabular-nums">
                  {formatMoney(l.unitPriceCents)}
                </td>
                <td className="py-2.5 pr-5 pl-3 text-right align-top font-semibold whitespace-nowrap text-ink tabular-nums">
                  {formatMoney(l.totalCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line px-5 py-4 sm:px-6">
        <dl className="ml-auto max-w-sm space-y-1.5 text-sm">
          {smallBusiness ? null : (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">Nettobetrag</dt>
                <dd className="text-ink tabular-nums">{formatMoney(netCents)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-soft">zzgl. {formatTaxRate(taxRateBasisPoints)} Umsatzsteuer</dt>
                <dd className="text-ink tabular-nums">{formatMoney(taxCents)}</dd>
              </div>
            </>
          )}
          <div className="flex justify-between gap-4 border-t-2 border-brand-300 pt-2 text-base font-bold text-ink">
            <dt>Gesamtbetrag</dt>
            <dd className="tabular-nums">{formatMoney(grossCents)}</dd>
          </div>
          {smallBusiness ? <p className="text-xs text-ink-muted">{SMALL_BUSINESS_NOTE}</p> : null}
        </dl>
      </div>
    </div>
  );
}

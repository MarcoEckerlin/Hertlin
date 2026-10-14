import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { InvoiceStatusBadge, OverdueNote } from "@/components/admin/invoices/invoice-badges";
import { formatDate, formatMoney } from "@/lib/format";
import type { InvoiceRow } from "@/lib/invoices/queries";
import { isUnpaid } from "@/lib/invoices/status";

/**
 * Rechnungsliste der Verwaltung: Nummer, Datum, Empfänger, Betrag, Stand, Fälligkeit.
 * Die ganze Zeile führt zur Rechnung; auf dem Handy wird jede Rechnung zur Karte.
 */
export function InvoiceTable({ rows, caption = "Rechnungen" }: { rows: InvoiceRow[]; caption?: string }) {
  return (
    <Table stack>
      <caption className="sr-only">{caption}</caption>
      <THead>
        <tr>
          <TH>Nummer</TH>
          <TH>Datum</TH>
          <TH>Empfänger</TH>
          <TH className="text-right">Betrag</TH>
          <TH>Stand</TH>
          <TH>Fällig</TH>
        </tr>
      </THead>
      <tbody>
        {rows.map((r) => (
          <TR key={r.id} className="group relative">
            <TD className="whitespace-nowrap">
              <div>
                <Link
                  href={`/admin/rechnungen/${r.id}`}
                  className="font-semibold text-brand-700 after:absolute after:inset-0 group-hover:underline focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-600"
                >
                  {r.number}
                </Link>
                {r.kind === "CANCELLATION" && r.cancelsInvoice ? (
                  <span className="block text-xs text-ink-muted">Storno zu {r.cancelsInvoice.number}</span>
                ) : null}
                {r.cancelledBy ? <span className="block text-xs text-ink-muted">storniert durch {r.cancelledBy.number}</span> : null}
              </div>
            </TD>
            <TD label="Datum" className="whitespace-nowrap">
              {formatDate(r.issueDate)}
            </TD>
            <TD label="Empfänger" className="min-w-[12rem]">
              <div className="min-w-0">
                <span className="block font-medium break-words text-ink">{r.recipientName}</span>
                {r.recipientEmail ? (
                  <span className="block text-xs [overflow-wrap:anywhere] text-ink-muted">{r.recipientEmail}</span>
                ) : null}
              </div>
            </TD>
            <TD label="Betrag" className="text-right font-semibold whitespace-nowrap text-ink tabular-nums">
              {formatMoney(r.grossCents)}
            </TD>
            <TD label="Stand" className="whitespace-nowrap">
              <div>
                <InvoiceStatusBadge invoice={r} />
                {r.sentAt && r.status !== "PAID" ? (
                  <span className="mt-0.5 block text-xs text-ink-muted">versendet {formatDate(r.sentAt)}</span>
                ) : null}
                {r.paidAt ? <span className="mt-0.5 block text-xs text-ink-muted">bezahlt {formatDate(r.paidAt)}</span> : null}
              </div>
            </TD>
            <TD label="Fällig" className="whitespace-nowrap">
              {isUnpaid(r) ? (
                <div>
                  <span className="text-ink">{formatDate(r.dueDate)}</span>
                  <span className="block">
                    <OverdueNote invoice={r} />
                  </span>
                </div>
              ) : r.kind === "CANCELLATION" ? (
                <Badge tone="gray">entfällt</Badge>
              ) : (
                <span className="text-ink-muted">–</span>
              )}
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}

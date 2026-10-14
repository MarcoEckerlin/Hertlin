import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";
import { customerInvoiceStatus, daysOverdue, isUnpaid, overdueLabel } from "@/lib/invoices/status";

export type PortalInvoice = {
  id: string;
  number: string;
  kind: string;
  status: string;
  issueDate: Date;
  dueDate: Date;
  grossCents: number;
  recipientName: string;
  paidAt: Date | null;
  cancelsInvoice: { number: string } | null;
};

/**
 * Rechnungen im Kundenportal: Nummer, Datum, Betrag, Stand, Fälligkeit und PDF.
 * Auf dem Handy als Karten, ab Tablet als Tabelle. Keine Kostenpositionen außerhalb der Rechnungen.
 */
export function PortalInvoiceList({ invoices, showRecipient }: { invoices: PortalInvoice[]; showRecipient: boolean }) {
  return (
    <>
      {/* Handy: Karten */}
      <ul className="space-y-3 md:hidden">
        {invoices.map((inv) => (
          <li key={inv.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <InvoiceSummary invoice={inv} showRecipient={showRecipient} />
            <a
              href={`/rechnungen/${inv.id}/pdf`}
              download
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
            >
              <Download className="size-4" aria-hidden />
              PDF herunterladen<span className="sr-only"> ({inv.number})</span>
            </a>
          </li>
        ))}
      </ul>

      {/* Ab Tablet: Tabelle */}
      <div className="relative hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-card md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">Rechnungen</caption>
          <thead className="border-b border-line bg-mist text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3 pl-5 font-semibold">
                Rechnung
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Datum
              </th>
              {showRecipient ? (
                <th scope="col" className="px-4 py-3 font-semibold">
                  Empfänger
                </th>
              ) : null}
              <th scope="col" className="px-4 py-3 text-right font-semibold">
                Betrag
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Stand
              </th>
              <th scope="col" className="px-4 py-3 pr-5 text-right font-semibold">
                <span className="sr-only">PDF</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const status = customerInvoiceStatus(inv);
              const overdue = daysOverdue(inv);
              return (
                <tr key={inv.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 pl-5 align-top whitespace-nowrap">
                    <span className="font-semibold text-ink">{inv.number}</span>
                    {inv.cancelsInvoice ? (
                      <span className="block text-xs text-ink-muted">Storno zu {inv.cancelsInvoice.number}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-ink-soft">{formatDate(inv.issueDate)}</td>
                  {showRecipient ? <td className="px-4 py-3 align-top break-words text-ink-soft">{inv.recipientName}</td> : null}
                  <td className="px-4 py-3 text-right align-top font-semibold whitespace-nowrap text-ink tabular-nums">
                    {formatMoney(inv.grossCents)}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {isUnpaid(inv) ? (
                      <span className={overdue > 0 ? "block text-xs font-semibold text-danger-ink" : "block text-xs text-ink-muted"}>
                        {overdue > 0 ? overdueLabel(overdue) : `fällig am ${formatDate(inv.dueDate)}`}
                      </span>
                    ) : inv.paidAt ? (
                      <span className="block text-xs text-ink-muted">am {formatDate(inv.paidAt)}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 pr-5 text-right align-top whitespace-nowrap">
                    <a
                      href={`/rechnungen/${inv.id}/pdf`}
                      download
                      className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline"
                    >
                      <Download className="size-4" aria-hidden />
                      PDF<span className="sr-only"> von {inv.number} herunterladen</span>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InvoiceSummary({ invoice, showRecipient }: { invoice: PortalInvoice; showRecipient: boolean }) {
  const status = customerInvoiceStatus(invoice);
  const overdue = daysOverdue(invoice);
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{invoice.number}</p>
        <p className="text-sm text-ink-muted">
          {formatDate(invoice.issueDate)}
          {showRecipient ? ` · ${invoice.recipientName}` : ""}
        </p>
        {invoice.cancelsInvoice ? <p className="text-xs text-ink-muted">Storno zu {invoice.cancelsInvoice.number}</p> : null}
        {isUnpaid(invoice) ? (
          <p className={overdue > 0 ? "text-xs font-semibold text-danger-ink" : "text-xs text-ink-muted"}>
            {overdue > 0 ? overdueLabel(overdue) : `fällig am ${formatDate(invoice.dueDate)}`}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold text-ink tabular-nums">{formatMoney(invoice.grossCents)}</p>
        <Badge tone={status.tone} className="mt-1">
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

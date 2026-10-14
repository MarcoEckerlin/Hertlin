import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PortalInvoiceList } from "@/components/portal/invoice-list";
import { requirePortalAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { portalInvoiceWhere } from "@/lib/invoices/queries";
import { isUnpaid } from "@/lib/invoices/status";

export const metadata: Metadata = { title: "Rechnungen" };

const LIMIT = 200;

/**
 * Rechnungen der eigenen Firma – nur für Hauptansprechpartner. Beim Firmenkunden inklusive der Unterkunden mit
 * eigener Rechnung, bei einer Unterkunde nur deren Rechnungen. Sichtbar, sobald Hertlin sie versendet hat.
 */
export default async function PortalInvoicesPage() {
  const ctx = await requirePortalAdmin();
  const where = portalInvoiceWhere(ctx.scopeCompanyIds);

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: [{ year: "desc" }, { sequence: "desc" }],
      take: LIMIT,
      select: {
        id: true,
        number: true,
        kind: true,
        status: true,
        issueDate: true,
        dueDate: true,
        grossCents: true,
        recipientName: true,
        companyId: true,
        paidAt: true,
        cancelsInvoice: { select: { number: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);

  const unpaid = invoices.filter(isUnpaid);
  const unpaidCents = unpaid.reduce((sum, inv) => sum + inv.grossCents, 0);
  const showRecipient = new Set(invoices.map((inv) => inv.companyId)).size > 1;

  return (
    <div>
      <PageHeader
        title="Rechnungen"
        description={
          ctx.isRootAdmin
            ? "Rechnungen von Hertlin an Ihre Firma, auch für Unterkunden mit eigener Rechnung. Das PDF können Sie jederzeit herunterladen."
            : "Rechnungen von Hertlin an Ihre Firma. Das PDF können Sie jederzeit herunterladen."
        }
      />

      {invoices.length === 0 ? (
        <EmptyState title="Noch keine Rechnungen">
          Sobald wir Ihnen eine Rechnung schicken, finden Sie sie auch hier.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {unpaid.length > 0 ? (
            <p className="rounded-2xl border border-line bg-mist px-5 py-3 text-sm text-ink">
              Offen: <span className="font-semibold tabular-nums">{formatMoney(unpaidCents)}</span>
              <span className="text-ink-muted">
                {" "}
                ({unpaid.length === 1 ? "1 Rechnung" : `${unpaid.length} Rechnungen`})
              </span>
            </p>
          ) : null}
          <PortalInvoiceList invoices={invoices} showRecipient={showRecipient} />
          {total > invoices.length ? (
            <p className="text-sm text-ink-muted">
              Die {invoices.length} neuesten von {total} Rechnungen. Ältere schicken wir Ihnen gern auf Nachfrage.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { BillingProblemsAlert } from "@/components/admin/invoices/invoice-badges";
import { InvoiceFilterForm } from "@/components/admin/invoices/invoice-filter-form";
import { InvoiceTable } from "@/components/admin/invoices/invoice-table";
import { requireAdmin } from "@/lib/auth";
import { getInvoiceIssuer } from "@/lib/billing-settings";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import {
  INVOICE_LIST_FILTERS,
  invoiceListParams,
  invoiceYears,
  listInvoices,
  parseInvoiceListFilter,
  unpaidTotals,
} from "@/lib/invoices/queries";

export const metadata: Metadata = { title: "Rechnungen" };

function Tile({ label, value, note, href }: { label: string; value: string; note: string; href?: string }) {
  const body = (
    <>
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1 text-xl font-bold tracking-tight text-ink tabular-nums sm:text-2xl">{value}</dd>
      <dd className="mt-0.5 text-xs text-ink-muted">{note}</dd>
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl border border-line bg-white p-4 shadow-card hover:border-brand-300 sm:p-5">
      {body}
    </Link>
  ) : (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">{body}</div>
  );
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const filter = parseInvoiceListFilter(await searchParams);

  const [issuer, { rows, total, pageCount }, totals, years, company, anyInvoice] = await Promise.all([
    getInvoiceIssuer(),
    listInvoices(filter),
    unpaidTotals(),
    invoiceYears(),
    filter.companyId ? db.company.findUnique({ where: { id: filter.companyId }, select: { id: true, name: true } }) : null,
    db.invoice.count(),
  ]);
  const filtered = Object.keys(invoiceListParams(filter, { page: 1 })).length > 0;

  return (
    <div>
      <PageHeader
        title="Rechnungen"
        description="Alle Rechnungen und Stornorechnungen. Neue Rechnungen erstellen Sie aus den offenen Positionen unter „Kosten pro Konto“."
        meta={
          company ? (
            <span className="text-sm text-ink-muted">
              Nur{" "}
              <Link href={`/admin/kunden/${company.id}`} className="font-semibold text-brand-700 hover:underline">
                {company.name}
              </Link>{" "}
              ·{" "}
              <Link
                href={`/admin/rechnungen?${new URLSearchParams(invoiceListParams(filter, { companyId: null, page: 1 })).toString()}`}
                className="font-semibold text-brand-700 hover:underline"
              >
                alle Kunden
              </Link>
            </span>
          ) : null
        }
        actions={
          <>
            <ButtonLink href="/admin/rechnungen/einstellungen" variant="secondary">
              <Settings className="size-4" aria-hidden />
              Einstellungen
            </ButtonLink>
            <ButtonLink href="/admin/kosten">Offene Positionen</ButtonLink>
          </>
        }
      />

      <div className="space-y-6">
        <BillingProblemsAlert problems={issuer.problems} />

        <dl className="grid max-w-2xl grid-cols-2 gap-3 sm:gap-4">
          <Tile
            label="Unbezahlt"
            value={formatMoney(totals.openCents)}
            note={totals.openCount === 1 ? "1 Rechnung" : `${totals.openCount} Rechnungen`}
            href="/admin/rechnungen?status=unbezahlt"
          />
          <Tile
            label="davon überfällig"
            value={formatMoney(totals.overdueCents)}
            note={totals.overdueCount === 1 ? "1 Rechnung" : `${totals.overdueCount} Rechnungen`}
            href="/admin/rechnungen?status=ueberfaellig"
          />
        </dl>

        <InvoiceFilterForm
          key={JSON.stringify(invoiceListParams(filter))}
          status={filter.status}
          year={filter.year ? String(filter.year) : ""}
          query={filter.query}
          companyId={filter.companyId}
          statuses={INVOICE_LIST_FILTERS}
          years={years}
        />

        {rows.length === 0 ? (
          <EmptyState
            title={anyInvoice === 0 ? "Noch keine Rechnungen" : "Keine Rechnungen für diese Auswahl"}
            action={
              anyInvoice === 0 ? (
                <ButtonLink href="/admin/kosten" variant="secondary">
                  Zu den offenen Positionen
                </ButtonLink>
              ) : filtered ? (
                <ButtonLink href="/admin/rechnungen" variant="secondary">
                  Filter zurücksetzen
                </ButtonLink>
              ) : null
            }
          >
            {anyInvoice === 0
              ? "Öffnen Sie unter „Kosten pro Konto“ einen Kunden, wählen Sie die offenen Positionen und klicken Sie auf „Rechnung erstellen“."
              : "Wählen Sie einen anderen Stand oder ein anderes Jahr."}
          </EmptyState>
        ) : (
          <>
            <p className="text-sm text-ink-muted" aria-live="polite">
              {total === 1 ? "1 Rechnung" : `${total} Rechnungen`}
            </p>
            <InvoiceTable rows={rows} />
            <Pagination
              page={filter.page}
              pageCount={pageCount}
              basePath="/admin/rechnungen"
              baseQuery={invoiceListParams(filter, { page: 1 })}
            />
          </>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { BillingProblem } from "@/lib/invoices/settings-schema";
import { adminInvoiceStatus, daysOverdue, overdueLabel } from "@/lib/invoices/status";

type InvoiceLike = { kind: string; status: string; dueDate: Date };

/** Stand einer Rechnung in der Verwaltung (inkl. „überfällig“) */
export function InvoiceStatusBadge({ invoice }: { invoice: InvoiceLike }) {
  const { label, tone } = adminInvoiceStatus(invoice);
  return (
    <Badge tone={tone}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </Badge>
  );
}

/** „seit 3 Tagen überfällig“ bzw. nichts */
export function OverdueNote({ invoice }: { invoice: InvoiceLike }) {
  const days = daysOverdue(invoice);
  if (days <= 0) return null;
  return <span className="text-xs font-semibold text-danger-ink">{overdueLabel(days)}</span>;
}

/** Fehlende Pflichtangaben für Rechnungen mit Links zum Beheben */
export function BillingProblemsAlert({ problems, title }: { problems: BillingProblem[]; title?: string }) {
  if (problems.length === 0) return null;
  return (
    <Alert tone="warning" title={title ?? "Rechnungen sind noch nicht möglich"}>
      <ul className="mt-1 space-y-1">
        {problems.map((p) => (
          <li key={p.message}>
            {p.message}{" "}
            <Link href={p.href} className="font-semibold whitespace-nowrap underline">
              {p.linkLabel}
            </Link>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

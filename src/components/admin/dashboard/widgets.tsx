import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { CUSTOMER_TYPE_LABELS, INQUIRY_TOPIC_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatInquiryNumber, formatRelative } from "@/lib/format";
import { Card } from "@/components/ui/card";

/**
 * Bausteine der Übersicht in der Verwaltung.
 */

/** Kennzahl mit Link auf die passend gefilterte Liste. */
export function StatCard({
  href,
  label,
  value,
  hint,
  alert = false,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  /** Hervorheben (z. B. kritische Tickets > 0) */
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col rounded-2xl border p-4 shadow-card transition-colors sm:p-5",
        alert ? "border-red-200 bg-red-50 hover:border-red-300" : "border-line bg-white hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      <span className={cn("text-sm font-semibold", alert ? "text-red-900" : "text-ink-soft")}>{label}</span>
      <span className={cn("mt-1 text-3xl font-bold tracking-tight tabular-nums", alert ? "text-red-800" : "text-ink")}>{value}</span>
      <span className={cn("mt-1 text-xs", alert ? "text-red-800" : "text-ink-muted")}>{hint}</span>
    </Link>
  );
}

/** Karte mit Überschrift, Zähler und Link „alle anzeigen“ unten. */
export function ListCard({
  title,
  count,
  footerHref,
  footerLabel,
  children,
}: {
  title: string;
  count?: number;
  footerHref?: string;
  footerLabel?: string;
  children: ReactNode;
}) {
  const headingId = `karte-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <Card>
      <section aria-labelledby={headingId}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <h2 id={headingId} className="text-base font-bold text-ink">
            {title}
          </h2>
          {count !== undefined ? (
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800 tabular-nums">{count}</span>
          ) : null}
        </div>
        {children}
        {footerHref && footerLabel ? (
          <div className="border-t border-line px-5 py-3 sm:px-6">
            <Link href={footerHref} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              {footerLabel}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        ) : null}
      </section>
    </Card>
  );
}

export type DashboardInquiry = {
  id: number;
  name: string;
  companyName: string | null;
  customerType: string;
  topic: string;
  createdAt: Date;
};

/** Neue Anfragen von Interessenten. */
export function InquiryList({ inquiries }: { inquiries: DashboardInquiry[] }) {
  if (inquiries.length === 0) {
    return <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">Keine neuen Anfragen. Neue Anfragen über die Website erscheinen hier.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {inquiries.map((inquiry) => (
        <li key={inquiry.id}>
          <Link href={`/admin/anfragen/${inquiry.id}`} className="group block px-5 py-3 transition-colors hover:bg-brand-50/60 sm:px-6">
            <p className="truncate font-semibold text-ink group-hover:text-brand-700">{inquiry.companyName || inquiry.name}</p>
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              {inquiry.companyName ? `${inquiry.name} · ` : `${labelOf(CUSTOMER_TYPE_LABELS, inquiry.customerType)} · `}
              {labelOf(INQUIRY_TOPIC_LABELS, inquiry.topic)}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              <span className="tabular-nums">{formatInquiryNumber(inquiry.id)}</span> ·{" "}
              <time dateTime={inquiry.createdAt.toISOString()} title={formatDateTime(inquiry.createdAt)}>
                {formatRelative(inquiry.createdAt)}
              </time>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

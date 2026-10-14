import { INVOICE_STATUS_LABELS, labelOf } from "@/lib/constants";
import { toDateInput } from "@/lib/format";

/** Anzeige des Rechnungsstands in Verwaltung und Kundenportal (ohne Datenbank). */

export type StatusTone = "blue" | "gray" | "green" | "amber" | "red";

type InvoiceLike = { kind: string; status: string; dueDate: Date };

/** Rechnung (keine Stornorechnung), die noch nicht bezahlt und nicht storniert ist. */
export function isUnpaid(invoice: Pick<InvoiceLike, "kind" | "status">): boolean {
  return invoice.kind === "INVOICE" && (invoice.status === "OPEN" || invoice.status === "SENT");
}

/** Tage seit Fälligkeit (> 0 = überfällig), bezogen auf den Kalendertag in deutscher Zeit. */
export function daysOverdue(invoice: InvoiceLike, now: Date = new Date()): number {
  if (!isUnpaid(invoice)) return 0;
  const today = Date.parse(`${toDateInput(now)}T12:00:00Z`);
  const due = Date.parse(`${toDateInput(invoice.dueDate)}T12:00:00Z`);
  return Math.max(0, Math.round((today - due) / 86_400_000));
}

export function overdueLabel(days: number): string {
  return days === 1 ? "seit 1 Tag überfällig" : `seit ${days} Tagen überfällig`;
}

/** Stand für die Verwaltung */
export function adminInvoiceStatus(invoice: InvoiceLike, now: Date = new Date()): { label: string; tone: StatusTone } {
  if (invoice.kind === "CANCELLATION") {
    return invoice.status === "SENT"
      ? { label: "Stornorechnung versendet", tone: "gray" }
      : { label: "Stornorechnung", tone: "gray" };
  }
  const overdue = daysOverdue(invoice, now);
  if (overdue > 0) return { label: "Überfällig", tone: "red" };
  const tones: Record<string, StatusTone> = { OPEN: "amber", SENT: "blue", PAID: "green", CANCELLED: "gray" };
  return { label: labelOf(INVOICE_STATUS_LABELS, invoice.status), tone: tones[invoice.status] ?? "gray" };
}

/** Stand für Kunden im Portal: offen, überfällig, bezahlt, storniert */
export function customerInvoiceStatus(invoice: InvoiceLike, now: Date = new Date()): { label: string; tone: StatusTone } {
  if (invoice.kind === "CANCELLATION") return { label: "Stornorechnung", tone: "gray" };
  if (invoice.status === "PAID") return { label: "Bezahlt", tone: "green" };
  if (invoice.status === "CANCELLED") return { label: "Storniert", tone: "gray" };
  return daysOverdue(invoice, now) > 0 ? { label: "Überfällig", tone: "red" } : { label: "Offen", tone: "amber" };
}

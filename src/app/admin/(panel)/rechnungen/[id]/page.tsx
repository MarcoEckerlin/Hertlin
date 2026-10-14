import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Missing } from "@/components/admin/companies/detail-list";
import { cleanId, firstParam } from "@/components/admin/companies/list-tools";
import { InvoiceStatusBadge, OverdueNote } from "@/components/admin/invoices/invoice-badges";
import { InvoiceCancelForm, InvoicePaymentForm, InvoiceSendForm } from "@/components/admin/invoices/invoice-actions";
import { InvoiceLines } from "@/components/admin/invoices/invoice-lines";
import { getStaffUser, requireAdmin } from "@/lib/auth";
import { costAccountHref } from "@/lib/costs";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, toDateInput } from "@/lib/format";
import { getInvoiceDetail } from "@/lib/invoices/queries";
import { emailDraftFor } from "@/lib/invoices/service";
import { invoiceFileName } from "@/lib/invoices/storage";
import { isUnpaid } from "@/lib/invoices/status";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const me = await getStaffUser();
  const id = cleanId((await params).id);
  const invoice =
    me?.role === "ADMIN" && id ? await db.invoice.findUnique({ where: { id }, select: { number: true } }) : null;
  return { title: invoice ? invoice.number : "Rechnung" };
}

/** Angabe in der Datenliste: Bezeichnung links, Wert rechts */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

function period(start: Date | null, end: Date | null): string | null {
  if (!start || !end) return null;
  return toDateInput(start) === toDateInput(end) ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const id = cleanId((await params).id);
  if (!id) notFound();
  const sp = await searchParams;
  const invoice = await getInvoiceDetail(id);
  if (!invoice) notFound();

  const isCancellation = invoice.kind === "CANCELLATION";
  const kindLabel = isCancellation ? "Stornorechnung" : "Rechnung";
  const draft = await emailDraftFor(invoice);
  const pdfHref = `/admin/rechnungen/${invoice.id}/pdf`;
  const fileName = invoiceFileName(invoice.number, invoice.kind);
  const unpaid = isUnpaid(invoice);
  const servicePeriod = period(invoice.servicePeriodStart, invoice.servicePeriodEnd);
  const customerHref = invoice.company ? `/admin/kunden/${invoice.company.id}` : null;
  const costHref = invoice.company
    ? costAccountHref({ kind: "company", companyId: invoice.company.parentId ?? invoice.company.id })
    : invoice.privateEmail
      ? costAccountHref({ kind: "private", email: invoice.privateEmail })
      : null;
  const today = toDateInput(new Date());

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Rechnungen", href: "/admin/rechnungen" }, { label: invoice.number }]}
        title={`${kindLabel} ${invoice.number}`}
        description={
          <>
            an <span className="font-semibold text-ink">{invoice.recipientName}</span> vom {formatDate(invoice.issueDate)}
          </>
        }
        meta={
          <>
            <InvoiceStatusBadge invoice={invoice} />
            <OverdueNote invoice={invoice} />
            <span className="text-sm font-semibold text-ink tabular-nums">{formatMoney(invoice.grossCents)}</span>
          </>
        }
        actions={
          <>
            <a href={pdfHref} target="_blank" rel="noopener" className={buttonClasses("secondary")}>
              <FileText className="size-4" aria-hidden />
              PDF ansehen
              <span className="sr-only">(öffnet in neuem Tab)</span>
            </a>
            <a href={`${pdfHref}?download=1`} download={fileName} className={buttonClasses("secondary")}>
              <Download className="size-4" aria-hidden />
              Herunterladen
            </a>
          </>
        }
      />

      <div className="mb-6 space-y-3 empty:hidden">
        {firstParam(sp.erstellt) === "1" ? (
          <Alert tone="success" title={`Rechnung ${invoice.number} ist erstellt`}>
            Die Positionen sind als abgerechnet markiert. Senden Sie die Rechnung jetzt per E-Mail oder laden Sie das PDF herunter.
          </Alert>
        ) : null}
        {firstParam(sp.storniert) === "1" && invoice.cancelsInvoice ? (
          <Alert tone="success" title={`Stornorechnung ${invoice.number} ist erstellt`}>
            Die Rechnung{" "}
            <Link href={`/admin/rechnungen/${invoice.cancelsInvoice.id}`} className="font-semibold underline">
              {invoice.cancelsInvoice.number}
            </Link>{" "}
            ist storniert, ihre Positionen sind wieder offen.
            {costHref ? (
              <>
                {" "}
                <Link href={costHref} className="font-semibold underline">
                  Zu den offenen Positionen
                </Link>
              </>
            ) : null}
          </Alert>
        ) : null}
        {invoice.cancelledBy ? (
          <Alert tone="info" title="Diese Rechnung ist storniert">
            Am {formatDate(invoice.cancelledBy.issueDate)} durch die Stornorechnung{" "}
            <Link href={`/admin/rechnungen/${invoice.cancelledBy.id}`} className="font-semibold underline">
              {invoice.cancelledBy.number}
            </Link>
            .
          </Alert>
        ) : null}
        {isCancellation && invoice.cancelsInvoice && firstParam(sp.storniert) !== "1" ? (
          <Alert tone="info">
            Hebt die Rechnung{" "}
            <Link href={`/admin/rechnungen/${invoice.cancelsInvoice.id}`} className="font-semibold underline">
              {invoice.cancelsInvoice.number}
            </Link>{" "}
            vom {formatDate(invoice.cancelsInvoice.issueDate)} auf.
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <aside className="min-w-0 space-y-6 lg:order-2">
          <Card>
            <CardHeader
              title="Per E-Mail senden"
              description={
                invoice.sentAt
                  ? `Zuletzt am ${formatDateTime(invoice.sentAt)} an ${invoice.sentTo ?? "–"}.`
                  : invoice.companyId
                    ? "Nach dem Versand sieht der Hauptansprechpartner die Rechnung auch im Kundenportal."
                    : "Das PDF hängt automatisch an."
              }
            />
            <CardBody>
              <InvoiceSendForm
                invoiceId={invoice.id}
                defaultTo={invoice.sentTo ?? invoice.recipientEmail ?? ""}
                defaultSubject={draft.subject}
                defaultText={draft.text}
                alreadySent={Boolean(invoice.sentAt)}
                attachmentName={fileName}
              />
            </CardBody>
          </Card>

          {!isCancellation && invoice.status !== "CANCELLED" ? (
            <Card>
              <CardHeader
                title="Zahlung"
                description={
                  invoice.paidAt
                    ? `Bezahlt am ${formatDate(invoice.paidAt)}.`
                    : `Fällig am ${formatDate(invoice.dueDate)}.`
                }
              />
              <CardBody>
                <InvoicePaymentForm
                  invoiceId={invoice.id}
                  paid={!unpaid}
                  today={today}
                  issueDate={toDateInput(invoice.issueDate)}
                />
              </CardBody>
            </Card>
          ) : null}

          {!isCancellation && invoice.status !== "CANCELLED" ? (
            <Card>
              <CardHeader
                title="Stornieren"
                description="Rechnungen werden nie gelöscht. Ein Storno erzeugt eine Stornorechnung mit eigener Nummer und negativen Beträgen."
              />
              <CardBody>
                <InvoiceCancelForm invoiceId={invoice.id} number={invoice.number} paid={invoice.status === "PAID"} />
              </CardBody>
            </Card>
          ) : null}
        </aside>

        <div className="min-w-0 space-y-6 lg:order-1 lg:col-span-2">
          <Card>
            <CardHeader
              title="Empfänger und Daten"
              actions={
                customerHref ? (
                  <Link href={customerHref} className="text-sm font-semibold text-brand-700 hover:underline">
                    Zum Kunden
                  </Link>
                ) : null
              }
            />
            <CardBody className="grid gap-6 md:grid-cols-2">
              <div className="min-w-0 space-y-3 text-sm">
                <address className="leading-relaxed text-ink not-italic">
                  <span className="font-semibold">{invoice.recipientName}</span>
                  {invoice.recipientAddress.split("\n").map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
                <p>
                  <span className="block text-ink-muted">Rechnungs-E-Mail</span>
                  {invoice.recipientEmail ? (
                    <span className="break-all text-ink">{invoice.recipientEmail}</span>
                  ) : (
                    <Missing />
                  )}
                </p>
                {invoice.recipientVatId ? (
                  <p>
                    <span className="block text-ink-muted">USt-IdNr.</span>
                    <span className="text-ink">{invoice.recipientVatId}</span>
                  </p>
                ) : null}
                {invoice.company?.parent ? (
                  <p>
                    <span className="block text-ink-muted">Unterkunde von</span>
                    <Link href={`/admin/kunden/${invoice.company.parent.id}`} className="text-brand-700 hover:underline">
                      {invoice.company.parent.name}
                    </Link>
                  </p>
                ) : null}
              </div>
              <dl className="min-w-0 divide-y divide-line text-sm">
                <Fact label="Rechnungsdatum">{formatDate(invoice.issueDate)}</Fact>
                {servicePeriod ? <Fact label="Leistungszeitraum">{servicePeriod}</Fact> : null}
                {!isCancellation ? <Fact label="Fällig am">{formatDate(invoice.dueDate)}</Fact> : null}
                <Fact label="Versendet">{invoice.sentAt ? formatDate(invoice.sentAt) : <Missing>noch nicht</Missing>}</Fact>
                {!isCancellation ? (
                  <Fact label="Bezahlt">{invoice.paidAt ? formatDate(invoice.paidAt) : <Missing>noch nicht</Missing>}</Fact>
                ) : null}
                <Fact label="Erstellt">
                  {formatDate(invoice.createdAt)}
                  {invoice.createdBy ? <span className="font-normal text-ink-muted"> von {invoice.createdBy.name}</span> : null}
                </Fact>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Positionen"
              description={invoice.lines.length === 1 ? "1 Position" : `${invoice.lines.length} Positionen`}
              actions={
                costHref ? (
                  <Link href={costHref} className="text-sm font-semibold text-brand-700 hover:underline">
                    Kosten des Kontos
                  </Link>
                ) : null
              }
            />
            <InvoiceLines
              lines={invoice.lines}
              netCents={invoice.netCents}
              taxRateBasisPoints={invoice.taxRateBasisPoints}
              taxCents={invoice.taxCents}
              grossCents={invoice.grossCents}
              smallBusiness={invoice.smallBusiness}
            />
          </Card>

          {invoice.introText || invoice.footerText ? (
            <Card>
              <CardHeader title="Texte auf der Rechnung" />
              <CardBody className="space-y-3 text-sm leading-relaxed text-ink-soft">
                {invoice.introText ? <p className="whitespace-pre-wrap">{invoice.introText}</p> : null}
                {invoice.footerText ? <p className="whitespace-pre-wrap">{invoice.footerText}</p> : null}
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

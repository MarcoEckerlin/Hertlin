import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BillingProblemsAlert } from "@/components/admin/invoices/invoice-badges";
import { InvoiceCreateForm, type PreviewEntry } from "@/components/admin/invoices/invoice-create-form";
import { requireAdmin } from "@/lib/auth";
import { getInvoiceIssuer } from "@/lib/billing-settings";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import { parseCostAccount } from "@/lib/costs";
import { formatDate, formatMoney, formatQuantity, formatTicketNumber, toDateInput } from "@/lib/format";
import { openEntriesFor, resolveRecipient, sameRecipientKey, isCompleteAddress } from "@/lib/invoices/recipients";

export const metadata: Metadata = { title: "Neue Rechnung" };

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_POSITIONS = 300;

function first(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

function all(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : value ? [value] : []).map((v) => v.trim()).filter((v) => ID_PATTERN.test(v));
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const key = parseCostAccount((k) => first(sp[k]));
  if (!key) notFound();
  const recipient = await resolveRecipient(key);
  if (!recipient) notFound();

  const pos = [...new Set(all(sp.pos))].slice(0, MAX_POSITIONS);
  // Unterkunde ohne eigene Rechnung → Firmenkunde; Privatkunden-Ticket mit E-Mail → Konto des Privatkunden
  if (!sameRecipientKey(key, recipient.key)) {
    const q = new URLSearchParams(recipient.params);
    for (const id of pos) q.append("pos", id);
    redirect(`/admin/rechnungen/neu?${q.toString()}`);
  }

  const [issuer, open] = await Promise.all([getInvoiceIssuer(), openEntriesFor(recipient)]);
  const priced = open.filter((e) => !e.needsPrice);
  const unpriced = open.filter((e) => e.needsPrice);
  const pricedIds = new Set(priced.map((e) => e.id));
  const requestedUnpriced = unpriced.filter((e) => pos.includes(e.id));
  const gone = pos.filter((id) => !pricedIds.has(id) && !requestedUnpriced.some((e) => e.id === id)).length;
  const preselected = pos.length > 0 ? pos.filter((id) => pricedIds.has(id)) : null;

  const entries: PreviewEntry[] = priced.map((e) => ({
    id: e.id,
    ticketId: e.ticket.id,
    ticketNumber: formatTicketNumber(e.ticket.id),
    ticketSubject: e.ticket.subject,
    subCompany: recipient.kind === "company" && e.ticket.company?.parentId ? e.ticket.company.name : null,
    date: formatDate(e.performedAt),
    dateInput: toDateInput(e.performedAt),
    kind: labelOf(COST_KIND_LABELS, e.kind),
    description: e.description,
    quantity: `${formatQuantity(e.quantityHundredths)} ${e.unit}`,
    unitPrice: formatMoney(e.unitPriceCents),
    totalCents: e.totalCents,
  }));

  const blocked = issuer.problems.length > 0;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Rechnungen", href: "/admin/rechnungen" },
          { label: "Kosten pro Konto", href: recipient.costHref },
          { label: "Neue Rechnung" },
        ]}
        title={<span className="break-words">Neue Rechnung an {recipient.label}</span>}
        description="Prüfen Sie Empfänger und Positionen. Abgewählte Positionen bleiben offen und können später abgerechnet werden."
      />

      <div className="space-y-6">
        <BillingProblemsAlert problems={issuer.problems} />

        {gone > 0 ? (
          <Alert tone="warning" title="Nicht alle gewählten Positionen sind noch offen">
            {gone === 1 ? "Eine Position ist" : `${gone} Positionen sind`} inzwischen abgerechnet, gelöscht oder gehören zu einem
            anderen Empfänger. Sie {gone === 1 ? "fehlt" : "fehlen"} hier.
          </Alert>
        ) : null}

        {unpriced.length > 0 ? (
          <Alert
            tone={requestedUnpriced.length > 0 ? "warning" : "info"}
            title={
              unpriced.length === 1
                ? "1 offene Position hat noch keinen Preis"
                : `${unpriced.length} offene Positionen haben noch keinen Preis`
            }
          >
            <p>Sie können erst abgerechnet werden, wenn der Preis im Ticket eingetragen ist:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {unpriced.slice(0, 8).map((e) => (
                <li key={e.id}>
                  „{e.description}“ in{" "}
                  <Link href={`/admin/tickets/${e.ticket.id}#kosten`} className="font-semibold underline">
                    {formatTicketNumber(e.ticket.id)}
                  </Link>
                </li>
              ))}
              {unpriced.length > 8 ? <li>und {unpriced.length - 8} weitere</li> : null}
            </ul>
          </Alert>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState
            title="Keine offenen Positionen mit Preis"
            action={
              <ButtonLink href={recipient.costHref} variant="secondary">
                Zu den Positionen
              </ButtonLink>
            }
          >
            Für {recipient.label} gibt es nichts abzurechnen. Kosten erfassen Sie im jeweiligen Ticket.
          </EmptyState>
        ) : (
          <InvoiceCreateForm
            recipient={{
              params: recipient.params,
              kind: recipient.kind,
              label: recipient.label,
              description: recipient.description,
              name: recipient.name,
              addressLines: recipient.addressLines,
              addressComplete: isCompleteAddress(recipient.addressLines),
              email: recipient.email,
              emailSource: recipient.emailSource,
              vatId: recipient.vatId,
              customerNumber: recipient.customerNumber,
              editHref: recipient.editHref,
              costHref: recipient.costHref,
            }}
            entries={entries}
            preselected={preselected}
            taxRateBasisPoints={issuer.billing.taxRateBasisPoints}
            smallBusiness={issuer.billing.smallBusiness}
            introText={issuer.billing.introText}
            issueDateLabel={formatDate(new Date())}
            paymentTermDays={issuer.billing.paymentTermDays}
            blocked={blocked}
          />
        )}
      </div>
    </div>
  );
}

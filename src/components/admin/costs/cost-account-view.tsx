import Link from "next/link";
import { FileText, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CostEntriesForm, type CostTicketGroup } from "@/components/admin/costs/cost-entries-form";
import { CostFilterForm } from "@/components/admin/costs/cost-filter-form";
import { CostSummary } from "@/components/admin/costs/cost-summary";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import {
  costAccountHref,
  costAccountParams,
  costFilterFormProps,
  costFilterParams,
  getAccountCostDetail,
  periodLabel,
  type CostAccount,
  type CostDetailTicket,
  type CostFilter,
  type ResolvedCostAccount,
} from "@/lib/costs";
import { formatDate, formatMoney, formatQuantity, formatTicketNumber } from "@/lib/format";
import { resolveRecipient, type BillingRecipient } from "@/lib/invoices/recipients";

/**
 * Positionen eines Kontos mit Filter, Kennzahlen und Sammelaktionen – getrennt nach Rechnungsempfänger
 * (Unterkunden mit eigener Rechnung bekommen einen eigenen Abschnitt). Nur nach requireAdmin() verwenden.
 */

function toGroup(t: CostDetailTicket, isCompany: boolean): CostTicketGroup {
  const priced = t.entries.filter((e) => !e.needsPrice);
  const subtotal = formatMoney(t.totals.totalCents);
  return {
    id: t.id,
    number: formatTicketNumber(t.id),
    subject: t.subject,
    status: t.status,
    subCompany: t.subCompanyName,
    contactName: isCompany ? null : t.contactName,
    subtotal: priced.length < t.entries.length ? `${subtotal} + Preis fehlt` : subtotal,
    entries: t.entries.map((e) => ({
      id: e.id,
      date: formatDate(e.performedAt),
      kind: labelOf(COST_KIND_LABELS, e.kind),
      description: e.description,
      quantity: `${formatQuantity(e.quantityHundredths)} ${e.unit}`,
      unitPrice: formatMoney(e.unitPriceCents),
      total: formatMoney(e.totalCents),
      totalCents: e.totalCents,
      billed: e.billed,
      billedLabel: e.billedAt ? formatDate(e.billedAt) : null,
      byLine: e.performedByName
        ? `erbracht von ${e.performedByName}`
        : e.createdByName
          ? `erfasst von ${e.createdByName}`
          : null,
      needsPrice: e.needsPrice,
      invoice: e.invoice,
    })),
  };
}

/** Rechnungsempfänger eines Tickets: Unterkunde mit eigener Rechnung oder das Konto selbst */
function recipientKeyOf(ticket: CostDetailTicket, resolved: ResolvedCostAccount, separate: Set<string>): CostAccount {
  if (resolved.account.kind === "company" && ticket.companyId && separate.has(ticket.companyId)) {
    return { kind: "company", companyId: ticket.companyId };
  }
  return resolved.account;
}

function RecipientHeader({
  recipient,
  headingId,
  openCount,
  unpriced,
}: {
  recipient: BillingRecipient;
  headingId: string;
  openCount: number;
  unpriced: number;
}) {
  const invoiceHref = `/admin/rechnungen/neu?${new URLSearchParams(recipient.params).toString()}`;
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Rechnungsempfänger</p>
        <h2 id={headingId} className="mt-0.5 text-lg font-bold break-words text-ink">
          {recipient.name}
        </h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
          <span>{recipient.description}</span>
          {recipient.email ? (
            <span className="inline-flex items-center gap-1 break-all">
              <Mail className="size-3.5 shrink-0" aria-hidden />
              {recipient.email}
            </span>
          ) : (
            <Badge tone="amber">keine Rechnungs-E-Mail</Badge>
          )}
          {recipient.editHref ? (
            <Link href={recipient.editHref} className="font-semibold text-brand-700 hover:underline">
              Rechnungsdaten
            </Link>
          ) : null}
        </p>
        {unpriced > 0 ? (
          <p className="mt-1 text-sm text-orange-800">
            {unpriced === 1 ? "1 Position hat" : `${unpriced} Positionen haben`} noch keinen Preis – bitte im Ticket nachtragen.
          </p>
        ) : null}
      </div>
      {openCount > 0 ? (
        <ButtonLink href={invoiceHref} size="sm">
          <FileText className="size-4" aria-hidden />
          Rechnung erstellen
        </ButtonLink>
      ) : null}
    </div>
  );
}

export async function CostAccountView({ resolved, filter }: { resolved: ResolvedCostAccount; filter: CostFilter }) {
  const detail = await getAccountCostDetail(resolved, filter);
  const label = periodLabel(filter.period);
  const basePath = costAccountHref(resolved.account);
  const [actionPath] = basePath.split("?");
  const hidden = resolved.account.kind === "company" ? {} : costAccountParams(resolved.account);
  const isCompany = resolved.account.kind === "company";

  // Tickets nach Rechnungsempfänger aufteilen (Reihenfolge: Konto selbst, dann Unterkunden mit eigener Rechnung)
  const separate = new Set(resolved.separateSubs.map((s) => s.id));
  const groups = new Map<string, { key: CostAccount; tickets: CostDetailTicket[] }>();
  groups.set(JSON.stringify(costAccountParams(resolved.account)), { key: resolved.account, tickets: [] });
  for (const sub of resolved.separateSubs) {
    const key: CostAccount = { kind: "company", companyId: sub.id };
    groups.set(JSON.stringify(costAccountParams(key)), { key, tickets: [] });
  }
  for (const ticket of detail.tickets) {
    const key = recipientKeyOf(ticket, resolved, separate);
    groups.get(JSON.stringify(costAccountParams(key)))?.tickets.push(ticket);
  }
  const filled = [...groups.values()].filter((g) => g.tickets.length > 0);
  const recipients = await Promise.all(filled.map((g) => resolveRecipient(g.key)));
  const multiple = filled.length > 1;

  return (
    <div className="space-y-6">
      <CostFilterForm
        key={JSON.stringify(costFilterParams(filter))}
        action={actionPath}
        hidden={hidden}
        {...costFilterFormProps(filter)}
      />

      {detail.tickets.length === 0 ? (
        <EmptyState
          title={filter.billing === "offen" ? "Nichts offen" : "Keine Positionen für diese Auswahl"}
          action={
            <ButtonLink
              href={costAccountHref(resolved.account, { period: { kind: "all" }, billing: "alle" })}
              variant="secondary"
            >
              Alle Positionen dieses Kontos
            </ButtonLink>
          }
        >
          {filter.billing === "offen"
            ? `Für „${label}“ ist bei ${resolved.label} alles abgerechnet.`
            : `${resolved.label} hat für „${label}“ keine Kostenpositionen.`}
        </EmptyState>
      ) : (
        <>
          <CostSummary totals={detail.totals} billing={filter.billing} periodLabel={label} />

          {filled.map((group, index) => {
            const recipient = recipients[index];
            if (!recipient) return null;
            const entries = group.tickets.flatMap((t) => t.entries);
            const totalCents = group.tickets.reduce((sum, t) => sum + t.totals.totalCents, 0);
            const openCount = entries.filter((e) => !e.billed && !e.invoice && !e.needsPrice).length;
            const unpriced = entries.filter((e) => e.needsPrice && !e.billed).length;
            const headingId = `empfaenger-${index}`;
            return (
              <section key={headingId} aria-labelledby={headingId} className="space-y-4">
                <RecipientHeader recipient={recipient} headingId={headingId} openCount={openCount} unpriced={unpriced} />
                <CostEntriesForm
                  tickets={group.tickets.map((t) => toGroup(t, isCompany))}
                  account={costAccountParams(resolved.account)}
                  total={formatMoney(totalCents)}
                  totalLabel={multiple ? `Summe ${recipient.label}` : "Gesamt"}
                  invoiceHref={`/admin/rechnungen/neu?${new URLSearchParams(recipient.params).toString()}`}
                />
              </section>
            );
          })}

          <p className="text-sm text-ink-muted">
            Positionen ändern oder löschen Sie im jeweiligen Ticket. „Rechnung erstellen“ übernimmt offene Positionen mit Preis in
            eine neue Rechnung und markiert sie als abgerechnet. „Als abgerechnet markieren“ ist für Leistungen gedacht, die
            anderweitig abgerechnet wurden – dabei entsteht keine Rechnung.
          </p>
        </>
      )}
    </div>
  );
}

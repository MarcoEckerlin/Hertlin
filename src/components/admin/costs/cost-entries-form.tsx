"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { setCostsBilledAction } from "@/lib/actions/admin-billing";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { initialFormState } from "@/lib/forms";

export type CostEntryRow = {
  id: string;
  date: string;
  kind: string;
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  totalCents: number;
  billed: boolean;
  billedLabel: string | null;
  /** „erbracht von …“ bzw. „erfasst von …“ */
  byLine: string | null;
  /** Preis fehlt noch (Techniker hat erfasst) */
  needsPrice: boolean;
  /** Rechnung, auf der die Position steht */
  invoice: { id: string; number: string } | null;
};

export type CostTicketGroup = {
  id: number;
  number: string;
  subject: string;
  status: string;
  subCompany: string | null;
  contactName: string | null;
  subtotal: string;
  entries: CostEntryRow[];
};

/** Höchstens so viele Positionen per Adresse an die Rechnungsvorschau übergeben (Länge der Adresse). */
const MAX_INVOICE_SELECTION = 300;

/** Offen, mit Preis und auf keiner Rechnung: kann auf eine neue Rechnung */
function invoiceable(e: CostEntryRow): boolean {
  return !e.billed && !e.invoice && !e.needsPrice;
}

function TriStateCheckbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.currentTarget.checked)}
      aria-label={label}
      className="size-[1.125rem] shrink-0 cursor-pointer rounded border-line-strong accent-brand-600"
    />
  );
}

function BillingBadge({ entry }: { entry: CostEntryRow }) {
  if (entry.invoice) {
    return (
      <Link
        href={`/admin/rechnungen/${entry.invoice.id}`}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-800 ring-1 ring-emerald-200 ring-inset hover:bg-emerald-100"
      >
        <FileText className="size-3" aria-hidden />
        {entry.invoice.number}
      </Link>
    );
  }
  if (entry.billed) return <Badge tone="green">{entry.billedLabel ? `abgerechnet ${entry.billedLabel}` : "abgerechnet"}</Badge>;
  if (entry.needsPrice) return <Badge tone="orange">Preis fehlt</Badge>;
  return <Badge tone="amber">offen</Badge>;
}

/**
 * Kostenpositionen eines Rechnungsempfängers, gruppiert nach Ticket, mit Auswahl und Sammelaktionen
 * „Rechnung erstellen“, „Als abgerechnet markieren“ und „Als offen markieren“. Nur für Administratoren.
 */
export function CostEntriesForm({
  tickets,
  account,
  total,
  totalLabel = "Gesamt",
  invoiceHref,
}: {
  tickets: CostTicketGroup[];
  /** Kennung des Kontos (konto | email | ticket) – wird in der Action erneut geprüft */
  account: Record<string, string>;
  total: string;
  totalLabel?: string;
  /** Rechnungsvorschau für diesen Empfänger, z. B. /admin/rechnungen/neu?konto=… */
  invoiceHref: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(setCostsBilledAction, initialFormState);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [opening, setOpening] = useState(false);

  // Meldung der letzten Aktion; verschwindet, sobald die Auswahl wieder geändert wird
  const [showMessage, setShowMessage] = useState(false);

  // Nach erfolgreicher Aktion Auswahl leeren (vorherigen Zustand merken statt Effekt)
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    setShowMessage(true);
    if (state.status === "success") setSelected(new Set());
  }

  const allEntries = tickets.flatMap((t) => t.entries);
  const byId = new Map(allEntries.map((e) => [e.id, e]));
  const chosen = [...selected].map((id) => byId.get(id)).filter((e): e is CostEntryRow => !!e);
  const chosenOpen = chosen.filter((e) => !e.billed && !e.needsPrice);
  const chosenBilled = chosen.filter((e) => e.billed && !e.invoice);
  const chosenInvoiceable = chosen.filter(invoiceable);
  const chosenCents = chosen.reduce((sum, e) => sum + e.totalCents, 0);
  const tooMany = chosenInvoiceable.length > MAX_INVOICE_SELECTION;

  const setMany = (ids: string[], on: boolean) => {
    setShowMessage(false);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  const clearSelection = () => {
    setShowMessage(false);
    setSelected(new Set());
  };

  const openInvoicePreview = () => {
    if (chosenInvoiceable.length === 0 || tooMany) return;
    const url = new URL(invoiceHref, window.location.origin);
    for (const e of chosenInvoiceable) url.searchParams.append("pos", e.id);
    setOpening(true);
    router.push(`${url.pathname}${url.search}`);
  };

  const allIds = allEntries.map((e) => e.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = !allChecked && allIds.some((id) => selected.has(id));
  const openIds = allEntries.filter(invoiceable).map((e) => e.id);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        // Ohne automatisches Zurücksetzen des Formulars: Die Auswahl steuert der Zustand oben
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter);
        startTransition(() => formAction(formData));
      }}
    >
      {Object.entries(account).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {chosen.map((e) => (
        <input key={e.id} type="hidden" name="ids" value={e.id} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="flex cursor-pointer items-center gap-3 font-semibold text-ink">
          <TriStateCheckbox
            checked={allChecked}
            indeterminate={someChecked}
            onChange={(on) => setMany(allIds, on)}
            label="Alle Positionen auswählen"
          />
          Alle auswählen
        </label>
        {openIds.length > 0 && openIds.length < allIds.length ? (
          <button
            type="button"
            className="font-semibold text-brand-700 hover:underline"
            onClick={() => {
              setShowMessage(false);
              setSelected(new Set(openIds));
            }}
          >
            Nur offene mit Preis auswählen ({openIds.length})
          </button>
        ) : null}
      </div>

      {tickets.map((ticket) => {
        const ids = ticket.entries.map((e) => e.id);
        const all = ids.every((id) => selected.has(id));
        const some = !all && ids.some((id) => selected.has(id));
        const headingId = `ticket-${ticket.id}-${account.konto ?? account.email ?? account.ticket ?? ""}`;
        return (
          <section
            key={ticket.id}
            aria-labelledby={headingId}
            className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
          >
            <header className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-line bg-mist/60 px-4 py-3 sm:px-5">
              <span className="pt-0.5">
                <TriStateCheckbox
                  checked={all}
                  indeterminate={some}
                  onChange={(on) => setMany(ids, on)}
                  label={`Alle Positionen von ${ticket.number} auswählen`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id={headingId} className="text-sm font-semibold break-words text-ink">
                  <Link href={`/admin/tickets/${ticket.id}`} className="text-brand-700 underline underline-offset-2 hover:text-brand-800">
                    {ticket.number}
                  </Link>{" "}
                  {ticket.subject}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  <StatusBadge status={ticket.status} audience="staff" />
                  {ticket.subCompany ? <span>Unterkunde: {ticket.subCompany}</span> : null}
                  {ticket.contactName ? <span>Kontakt: {ticket.contactName}</span> : null}
                </div>
              </div>
              <p className="text-sm font-semibold whitespace-nowrap text-ink tabular-nums">{ticket.subtotal}</p>
            </header>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <thead className="text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="w-10 py-2 pl-4 sm:pl-5">
                      <span className="sr-only">Auswahl</span>
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Datum
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Art
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Beschreibung
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Menge
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Einzelpreis
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Gesamt
                    </th>
                    <th scope="col" className="py-2 pr-4 pl-3 font-semibold sm:pr-5">
                      Abrechnung
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.entries.map((e) => {
                    const isSelected = selected.has(e.id);
                    return (
                      <tr
                        key={e.id}
                        className={cn("border-b border-line last:border-0", isSelected ? "bg-brand-50" : "hover:bg-brand-50/40")}
                      >
                        <td className="py-2.5 pl-4 align-top sm:pl-5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(ev) => setMany([e.id], ev.currentTarget.checked)}
                            aria-label={`${e.kind}: ${e.description} (${e.needsPrice ? "Preis fehlt" : e.total}) auswählen`}
                            className="mt-0.5 size-[1.125rem] cursor-pointer rounded border-line-strong accent-brand-600"
                          />
                        </td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap text-ink-soft">{e.date}</td>
                        <td className="px-3 py-2.5 align-top whitespace-nowrap text-ink-soft">{e.kind}</td>
                        <td className="px-3 py-2.5 align-top text-ink">
                          <span className="break-words">{e.description}</span>
                          {e.byLine ? <span className="block text-xs text-ink-muted">{e.byLine}</span> : null}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top whitespace-nowrap text-ink-soft tabular-nums">
                          {e.quantity}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top whitespace-nowrap text-ink-soft tabular-nums">
                          {e.needsPrice ? <span className="text-ink-muted">–</span> : e.unitPrice}
                        </td>
                        <td className="px-3 py-2.5 text-right align-top font-semibold whitespace-nowrap text-ink tabular-nums">
                          {e.needsPrice ? <span className="font-normal text-ink-muted">–</span> : e.total}
                        </td>
                        <td className="py-2.5 pr-4 pl-3 align-top whitespace-nowrap sm:pr-5">
                          <BillingBadge entry={e} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="flex justify-end rounded-2xl border-2 border-line-strong bg-mist px-5 py-3 text-sm">
        <span className="font-bold text-ink">
          {totalLabel} <span className="ml-3 tabular-nums">{total}</span>
        </span>
      </div>

      <div
        className={cn(
          "sticky bottom-4 z-20 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-lift",
          chosen.length === 0 && !(showMessage && state.message) && "hidden",
        )}
      >
        {showMessage ? <FormMessage state={state} /> : null}
        {chosen.length > 0 ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-ink" aria-live="polite">
              <span className="font-semibold">
                {chosen.length === 1 ? "1 Position" : `${chosen.length} Positionen`} ausgewählt
              </span>
              <span className="text-ink-muted"> · </span>
              <span className="font-semibold tabular-nums">{formatMoney(chosenCents)}</span>
              {tooMany ? (
                <span className="block text-xs text-red-700">
                  Bitte höchstens {MAX_INVOICE_SELECTION} Positionen in eine Rechnung übernehmen.
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={openInvoicePreview}
                disabled={isPending || opening || chosenInvoiceable.length === 0 || tooMany}
                title={chosenInvoiceable.length === 0 ? "Nur offene Positionen mit Preis können auf eine Rechnung." : undefined}
              >
                <FileText className="size-4" aria-hidden />
                {opening ? "Wird geöffnet …" : "Rechnung erstellen"}
                {!opening && chosenInvoiceable.length > 0 && chosenInvoiceable.length < chosen.length
                  ? ` (${chosenInvoiceable.length})`
                  : ""}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="billed"
                variant="secondary"
                size="sm"
                disabled={isPending || chosenOpen.length === 0}
              >
                {isPending ? "Wird gespeichert …" : "Als abgerechnet markieren"}
                {!isPending && chosenOpen.length > 0 && chosenOpen.length < chosen.length ? ` (${chosenOpen.length})` : ""}
              </Button>
              <Button
                type="submit"
                name="intent"
                value="open"
                variant="secondary"
                size="sm"
                disabled={isPending || chosenBilled.length === 0}
              >
                Als offen markieren
                {chosenBilled.length > 0 && chosenBilled.length < chosen.length ? ` (${chosenBilled.length})` : ""}
              </Button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-brand-50 hover:text-ink"
                onClick={clearSelection}
              >
                Auswahl aufheben
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  );
}

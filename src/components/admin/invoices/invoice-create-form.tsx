"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { createInvoiceAction } from "@/lib/actions/admin-invoices";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { SMALL_BUSINESS_NOTE, formatTaxRate, invoiceAmounts } from "@/lib/invoices/calc";

export type PreviewEntry = {
  id: string;
  ticketId: number;
  ticketNumber: string;
  ticketSubject: string;
  subCompany: string | null;
  /** „12.10.2026“ */
  date: string;
  /** „2026-10-12“ für den Leistungszeitraum */
  dateInput: string;
  kind: string;
  description: string;
  quantity: string;
  unitPrice: string;
  totalCents: number;
};

export type PreviewRecipient = {
  params: Record<string, string>;
  kind: "company" | "sub" | "private" | "ticket";
  label: string;
  description: string;
  name: string;
  addressLines: string[];
  /** Straße sowie PLZ und Ort vorhanden (Pflicht auf der Rechnung) */
  addressComplete: boolean;
  email: string | null;
  emailSource: "billing" | "company" | "contact" | null;
  vatId: string | null;
  customerNumber: string | null;
  editHref: string | null;
  costHref: string;
};

const EMAIL_SOURCE: Record<string, string> = {
  billing: "Rechnungs-E-Mail des Kunden",
  company: "allgemeine E-Mail der Firma (keine eigene Rechnungs-E-Mail hinterlegt)",
  contact: "E-Mail-Adresse aus dem Ticket",
};

function rangeOf(entries: PreviewEntry[]): { start: string; end: string } {
  if (entries.length === 0) return { start: "", end: "" };
  const dates = entries.map((e) => e.dateInput).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * Rechnungsvorschau: Empfänger, Positionen zum An- und Abwählen, Leistungszeitraum, Summen.
 * „Rechnung erstellen“ vergibt die Nummer, schreibt die Rechnung fest und erzeugt das PDF.
 */
export function InvoiceCreateForm({
  recipient,
  entries,
  preselected,
  taxRateBasisPoints,
  smallBusiness,
  introText,
  issueDateLabel,
  paymentTermDays,
  blocked,
}: {
  recipient: PreviewRecipient;
  entries: PreviewEntry[];
  /** Vorausgewählte Positionen; null = alle */
  preselected: string[] | null;
  taxRateBasisPoints: number;
  smallBusiness: boolean;
  introText: string;
  issueDateLabel: string;
  paymentTermDays: number;
  /** Pflichtangaben fehlen – Erstellen nicht möglich */
  blocked: boolean;
}) {
  const [state, formAction] = useActionState(createInvoiceAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values = state.values;

  const [selected, setSelected] = useState<Set<string>>(() => {
    const wanted = preselected ? new Set(preselected) : null;
    return new Set(entries.filter((e) => !wanted || wanted.has(e.id)).map((e) => e.id));
  });
  const chosen = entries.filter((e) => selected.has(e.id));
  const auto = rangeOf(chosen);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(
    values?.periodStart || values?.periodEnd ? { start: values.periodStart ?? "", end: values.periodEnd ?? "" } : null,
  );
  const shownPeriod = period ?? auto;

  const amounts = invoiceAmounts(
    chosen.map((e) => e.totalCents),
    { taxRateBasisPoints, smallBusiness },
  );

  const tickets = useMemo(() => {
    const map = new Map<number, { number: string; subject: string; subCompany: string | null; entries: PreviewEntry[] }>();
    for (const e of entries) {
      const t = map.get(e.ticketId) ?? { number: e.ticketNumber, subject: e.ticketSubject, subCompany: e.subCompany, entries: [] };
      t.entries.push(e);
      map.set(e.ticketId, t);
    }
    return [...map.entries()];
  }, [entries]);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const isPrivate = recipient.kind === "private" || recipient.kind === "ticket";
  const allChecked = entries.length > 0 && entries.every((e) => selected.has(e.id));

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      {Object.entries(recipient.params).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {chosen.map((e) => (
        <input key={e.id} type="hidden" name="ids" value={e.id} />
      ))}
      {/* Nettosumme der Vorschau: Ändert jemand inzwischen eine Position, wird die Rechnung nicht erstellt */}
      <input type="hidden" name="expectedNetCents" value={amounts.netCents} />
      {/* Leistungszeitraum: nur mitschicken, wenn er von Hand geändert wurde – sonst ergibt er sich aus den Positionen */}
      {period ? (
        <>
          <input type="hidden" name="periodStart" value={period.start} />
          <input type="hidden" name="periodEnd" value={period.end} />
        </>
      ) : null}

      <FormMessage state={state} />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Empfänger"
            description={recipient.description}
            actions={
              recipient.editHref ? (
                <Link href={recipient.editHref} className="text-sm font-semibold text-brand-700 hover:underline">
                  Rechnungsdaten ändern
                </Link>
              ) : null
            }
          />
          <CardBody className="space-y-5">
            {isPrivate ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" htmlFor="invoice-recipientName" error={errors.recipientName}>
                  <Input
                    {...fieldProps("invoice-recipientName", errors.recipientName)}
                    name="recipientName"
                    maxLength={160}
                    autoComplete="off"
                    defaultValue={values?.recipientName ?? recipient.name}
                  />
                </Field>
                <Field
                  label="Anschrift"
                  htmlFor="invoice-recipientAddress"
                  error={errors.recipientAddress}
                  hint="Straße und Ort, je Zeile eine Angabe."
                >
                  <Textarea
                    {...fieldProps("invoice-recipientAddress", errors.recipientAddress, true)}
                    name="recipientAddress"
                    rows={3}
                    maxLength={400}
                    defaultValue={values?.recipientAddress ?? recipient.addressLines.join("\n")}
                  />
                </Field>
              </div>
            ) : (
              <address className="text-[0.9375rem] leading-relaxed text-ink not-italic">
                <span className="font-semibold">{recipient.name}</span>
                {recipient.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                {recipient.addressLines.length === 0 ? (
                  <span className="mt-1 block text-sm font-medium text-danger-ink">
                    Keine Anschrift hinterlegt – bitte unter „Rechnungsdaten ändern“ ergänzen.
                  </span>
                ) : !recipient.addressComplete ? (
                  <span className="mt-1 block text-sm font-medium text-danger-ink">
                    Anschrift unvollständig (Straße, PLZ und Ort nötig) – bitte unter „Rechnungsdaten ändern“ ergänzen.
                  </span>
                ) : null}
                <span className="mt-2 block text-sm text-ink-muted">
                  {[
                    recipient.customerNumber ? `Kundennummer ${recipient.customerNumber}` : null,
                    recipient.vatId ? `USt-IdNr. ${recipient.vatId}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </address>
            )}
            <Field
              label="Rechnung per E-Mail an"
              htmlFor="invoice-recipientEmail"
              error={errors.recipientEmail}
              optional
              hint={
                recipient.emailSource
                  ? `Vorbelegt: ${EMAIL_SOURCE[recipient.emailSource]}. Nur für diese Rechnung änderbar; versendet wird erst auf der nächsten Seite.`
                  : "Keine Adresse hinterlegt. Ohne Adresse können Sie das PDF herunterladen und selbst übergeben."
              }
            >
              <Input
                {...fieldProps("invoice-recipientEmail", errors.recipientEmail, true)}
                name="recipientEmail"
                type="email"
                maxLength={200}
                autoComplete="off"
                defaultValue={values?.recipientEmail ?? recipient.email ?? ""}
              />
            </Field>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Rechnungsdaten" />
          <CardBody className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-ink-muted">Rechnungsdatum</dt>
                <dd className="font-semibold text-ink">{issueDateLabel}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Zahlungsziel</dt>
                <dd className="font-semibold text-ink">{paymentTermDays === 0 ? "sofort" : `${paymentTermDays} Tage`}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-ink-muted">Nummer</dt>
                <dd className="text-ink">wird beim Erstellen vergeben</dd>
              </div>
            </dl>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-ink">Leistungszeitraum</legend>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="invoice-periodStart" className="mb-1 block text-xs text-ink-muted">
                    von
                  </label>
                  <Input
                    {...fieldProps("invoice-periodStart", errors.periodStart)}
                    type="date"
                    value={shownPeriod.start}
                    onChange={(e) => setPeriod({ start: e.currentTarget.value, end: shownPeriod.end })}
                    className="h-10 w-40"
                  />
                </div>
                <div>
                  <label htmlFor="invoice-periodEnd" className="mb-1 block text-xs text-ink-muted">
                    bis
                  </label>
                  <Input
                    {...fieldProps("invoice-periodEnd", errors.periodEnd)}
                    type="date"
                    value={shownPeriod.end}
                    onChange={(e) => setPeriod({ start: shownPeriod.start, end: e.currentTarget.value })}
                    className="h-10 w-40"
                  />
                </div>
              </div>
              {errors.periodStart || errors.periodEnd ? (
                <p id={errors.periodEnd ? "invoice-periodEnd-error" : "invoice-periodStart-error"} className="text-sm font-medium text-danger-ink">
                  {errors.periodStart ?? errors.periodEnd}
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  {period ? (
                    <>
                      Von Hand geändert.{" "}
                      <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => setPeriod(null)}>
                        Aus den Positionen übernehmen
                      </button>
                    </>
                  ) : (
                    "Ergibt sich aus den Leistungsdaten der gewählten Positionen."
                  )}
                </p>
              )}
            </fieldset>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Positionen"
          description={`${chosen.length} von ${entries.length} offenen Positionen ausgewählt`}
          actions={
            entries.length > 1 ? (
              <button
                type="button"
                className="text-sm font-semibold text-brand-700 hover:underline"
                onClick={() => toggle(entries.map((e) => e.id), !allChecked)}
              >
                {allChecked ? "Keine auswählen" : "Alle auswählen"}
              </button>
            ) : null
          }
        />
        {/* Auf dem Handy wird jede Position zur Karte */}
        <div className="scroll-shadow-x table-stack relative overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <caption className="sr-only">Positionen der Rechnung</caption>
            <thead className="border-b border-line bg-mist text-xs text-ink-muted">
              <tr>
                <th scope="col" className="w-10 py-2.5 pl-5">
                  <span className="sr-only">Übernehmen</span>
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Datum
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold">
                  Beschreibung
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                  Menge
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                  Einzelpreis
                </th>
                <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-semibold">
                  Gesamt
                </th>
              </tr>
            </thead>
            {tickets.map(([ticketId, ticket]) => (
              <tbody key={ticketId} className="border-b border-line last:border-0">
                <tr className="bg-mist/50">
                  <th scope="colgroup" colSpan={6} className="px-5 py-2 text-left text-xs font-semibold text-ink-soft">
                    <Link href={`/admin/tickets/${ticketId}`} className="text-brand-700 hover:underline">
                      {ticket.number}
                    </Link>{" "}
                    <span className="font-normal break-words">{ticket.subject}</span>
                    {ticket.subCompany ? <span className="font-normal text-ink-muted"> · {ticket.subCompany}</span> : null}
                  </th>
                </tr>
                {ticket.entries.map((e) => {
                  const on = selected.has(e.id);
                  return (
                    <tr key={e.id} className={cn("border-t border-line", on ? "" : "text-ink-muted")}>
                      <td className="py-2.5 pl-5 align-top max-sm:float-left! max-sm:pr-3!">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(ev) => toggle([e.id], ev.currentTarget.checked)}
                          aria-label={`${e.description} übernehmen`}
                          className="mt-0.5 size-[1.125rem] cursor-pointer rounded border-line-strong accent-brand-600"
                        />
                      </td>
                      <td data-label="Datum" className="px-3 py-2.5 align-top whitespace-nowrap">
                        {e.date}
                      </td>
                      <td className={cn("px-3 py-2.5 align-top", on && "text-ink")}>
                        <div className="min-w-0">
                          <span className="block break-words">{e.description}</span>
                          <span className="block text-xs text-ink-muted">{e.kind}</span>
                        </div>
                      </td>
                      <td data-label="Menge" className="px-3 py-2.5 text-right align-top whitespace-nowrap tabular-nums">
                        {e.quantity}
                      </td>
                      <td data-label="Einzelpreis" className="px-3 py-2.5 text-right align-top whitespace-nowrap tabular-nums">
                        {e.unitPrice}
                      </td>
                      <td
                        data-label="Gesamt"
                        className={cn(
                          "py-2.5 pr-5 pl-3 text-right align-top whitespace-nowrap tabular-nums",
                          on ? "font-semibold text-ink" : "line-through",
                        )}
                      >
                        {formatMoney(e.totalCents)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        <div className="border-t border-line px-5 py-4 sm:px-6">
          <dl className="ml-auto max-w-sm space-y-1.5 text-sm" aria-live="polite">
            {smallBusiness ? null : (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Nettobetrag</dt>
                  <dd className="text-ink tabular-nums" data-testid="invoice-net">
                    {formatMoney(amounts.netCents)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">zzgl. {formatTaxRate(amounts.taxRateBasisPoints)} Umsatzsteuer</dt>
                  <dd className="text-ink tabular-nums" data-testid="invoice-tax">
                    {formatMoney(amounts.taxCents)}
                  </dd>
                </div>
              </>
            )}
            <div className="flex justify-between gap-4 border-t-2 border-brand-300 pt-2 text-base font-bold text-ink">
              <dt>Gesamtbetrag</dt>
              <dd className="tabular-nums" data-testid="invoice-gross">
                {formatMoney(amounts.grossCents)}
              </dd>
            </div>
            {smallBusiness ? <p className="text-xs text-ink-muted">{SMALL_BUSINESS_NOTE}</p> : null}
          </dl>
        </div>
      </Card>

      <Card>
        <CardHeader title="Einleitung" description="Steht auf der Rechnung über den Positionen." />
        <CardBody>
          <Field label="Text" htmlFor="invoice-introText" error={errors.introText} optional>
            <Textarea
              {...fieldProps("invoice-introText", errors.introText)}
              name="introText"
              rows={2}
              maxLength={1000}
              defaultValue={values?.introText ?? introText}
            />
          </Field>
        </CardBody>
      </Card>

      {blocked ? (
        <Alert tone="warning">Bitte zuerst die fehlenden Angaben oben ergänzen – dann lässt sich die Rechnung erstellen.</Alert>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="min-w-0 flex-1 text-sm text-ink-soft">
          Danach ist die Rechnung festgeschrieben: Nummer, Positionen und Beträge lassen sich nicht mehr ändern, nur stornieren.
        </p>
        <div className="flex shrink-0 flex-wrap-reverse items-center justify-end gap-2">
          <ButtonLink href={recipient.costHref} variant="ghost">
            Abbrechen
          </ButtonLink>
          <SubmitButton pendingText="Rechnung wird erstellt …" disabled={blocked || chosen.length === 0}>
            Rechnung über {formatMoney(amounts.grossCents)} erstellen
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

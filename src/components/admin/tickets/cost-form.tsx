"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { addCostAction, updateCostAction } from "@/lib/actions/admin-costs";
import { initialFormState } from "@/lib/forms";
import { COST_KINDS, COST_KIND_LABELS, COST_UNITS, type CostKind } from "@/lib/constants";
import { centsToInput, formatMoney, lineTotalCents, parseMoney, parseQuantity } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";
import type { CostDefaults, CostFormValues } from "@/components/admin/tickets/cost-values";

/**
 * Kostenposition hinzufügen oder bearbeiten. Art wählt Einheit und Preisvorschlag vor;
 * der Gesamtbetrag wird live angezeigt und auf dem Server neu berechnet.
 */
export function CostForm({
  mode,
  ticketId,
  costId,
  initial,
  defaults,
  laborHint,
  cancelHref,
}: {
  mode: "add" | "edit";
  ticketId: number;
  costId?: string;
  initial: CostFormValues;
  defaults: CostDefaults;
  laborHint?: string;
  cancelHref?: string;
}) {
  const [state, action] = useActionState(mode === "add" ? addCostAction : updateCostAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const values = state.status === "error" ? (state.values ?? null) : null;

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      {costId ? <input type="hidden" name="costId" value={costId} /> : null}
      <FormMessage state={state} />
      <CostFields
        start={
          values
            ? {
                kind: values.kind ?? initial.kind,
                description: values.description ?? "",
                performedAt: values.performedAt ?? initial.performedAt,
                quantity: values.quantity ?? "",
                unit: values.unit ?? initial.unit,
                unitPrice: values.unitPrice ?? "",
                billed: values.billed === "on",
              }
            : initial
        }
        errors={state.fieldErrors ?? {}}
        defaults={defaults}
        laborHint={laborHint}
        // Beim Bearbeiten den gespeicherten Preis nie automatisch überschreiben
        priceTouchedInitially={mode === "edit" || values !== null}
      />
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SubmitButton pendingText="Wird gespeichert …">{mode === "add" ? "Position hinzufügen" : "Änderungen speichern"}</SubmitButton>
        {cancelHref ? (
          <Link href={cancelHref} className={buttonClasses("ghost")}>
            Abbrechen
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function CostFields({
  start,
  errors,
  defaults,
  laborHint,
  priceTouchedInitially,
}: {
  start: CostFormValues;
  errors: Record<string, string>;
  defaults: CostDefaults;
  laborHint?: string;
  priceTouchedInitially: boolean;
}) {
  const [kind, setKind] = useState(start.kind);
  const [unit, setUnit] = useState(start.unit);
  const [quantity, setQuantity] = useState(start.quantity);
  const [unitPrice, setUnitPrice] = useState(start.unitPrice);
  const [priceTouched, setPriceTouched] = useState(priceTouchedInitially);

  function changeKind(next: string) {
    setKind(next);
    const d = defaults[next as CostKind];
    if (!d) return;
    setUnit(d.unit);
    // Vorschlag nur übernehmen, solange der Preis nicht von Hand geändert wurde
    if (!priceTouched || unitPrice.trim() === "") setUnitPrice(d.unitPriceCents === null ? "" : centsToInput(d.unitPriceCents));
  }

  const q = parseQuantity(quantity);
  const p = parseMoney(unitPrice);
  const total = q !== null && p !== null ? lineTotalCents(q, p) : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="Art" htmlFor="kosten-kind" error={errors.kind}>
          <Select
            {...fieldA11y("kosten-kind", errors.kind)}
            name="kind"
            value={kind}
            onChange={(e) => changeKind(e.target.value)}
            className="h-10 text-sm"
          >
            {COST_KINDS.map((k) => (
              <option key={k} value={k}>
                {COST_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Beschreibung" htmlFor="kosten-description" error={errors.description}>
          <Input
            {...fieldA11y("kosten-description", errors.description)}
            name="description"
            maxLength={300}
            defaultValue={start.description}
            placeholder={
              kind === "MATERIAL"
                ? "z. B. Netzteil Dell 90 W"
                : kind === "TRAVEL"
                  ? "z. B. Anfahrt Musterstadt"
                  : "z. B. Drucker eingerichtet, Treiber aktualisiert"
            }
            className="h-10 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Field label="Datum" htmlFor="kosten-date" error={errors.performedAt}>
          <Input
            {...fieldA11y("kosten-date", errors.performedAt)}
            name="performedAt"
            type="date"
            defaultValue={start.performedAt}
            className="h-10 text-sm"
          />
        </Field>
        <Field
          label="Menge"
          htmlFor="kosten-quantity"
          error={errors.quantity}
          hint={kind === "LABOR" && unit === "Std." ? laborHint : undefined}
        >
          <Input
            {...fieldA11y("kosten-quantity", errors.quantity, Boolean(kind === "LABOR" && unit === "Std." && laborHint))}
            name="quantity"
            inputMode="decimal"
            autoComplete="off"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1,25"
            className="h-10 text-sm tabular-nums"
          />
        </Field>
        <Field label="Einheit" htmlFor="kosten-unit" error={errors.unit}>
          <Select
            {...fieldA11y("kosten-unit", errors.unit)}
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="h-10 text-sm"
          >
            {COST_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Einzelpreis (€)" htmlFor="kosten-price" error={errors.unitPrice}>
          <Input
            {...fieldA11y("kosten-price", errors.unitPrice)}
            name="unitPrice"
            inputMode="decimal"
            autoComplete="off"
            value={unitPrice}
            onChange={(e) => {
              setUnitPrice(e.target.value);
              setPriceTouched(true);
            }}
            placeholder="0,00"
            className="h-10 text-sm tabular-nums"
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink" aria-hidden>
            Gesamt
          </p>
          <output
            aria-label="Gesamtbetrag"
            aria-live="polite"
            className="flex h-10 items-center rounded-xl bg-mist px-3.5 text-sm font-bold text-ink tabular-nums ring-1 ring-line ring-inset"
          >
            {total === null ? "–" : formatMoney(total)}
          </output>
        </div>
      </div>

      <Checkbox name="billed" defaultChecked={start.billed} label="Bereits abgerechnet" className="text-sm" />
    </>
  );
}

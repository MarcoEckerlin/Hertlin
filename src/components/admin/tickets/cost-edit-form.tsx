"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateCostAction } from "@/lib/actions/admin-costs";
import { initialFormState } from "@/lib/forms";
import { COST_KINDS, COST_KIND_LABELS, COST_UNITS } from "@/lib/constants";
import { COST_DESCRIPTION_MAX } from "@/lib/cost-catalog";
import { cn } from "@/lib/cn";
import { buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, FieldError, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";
import { PerformerField, PriceField, TotalOutput, costControl } from "@/components/admin/tickets/cost-fields";
import type { CostFormValues, StaffChoice } from "@/components/admin/tickets/cost-values";

/**
 * Position bearbeiten. Administratoren sehen zusätzlich Preis, Gesamtbetrag und „abgerechnet“;
 * Techniker (nur eigene, nicht abgerechnete Positionen) ändern Beschreibung, Menge, Datum und wer es erbracht hat.
 */
export function CostEditForm({
  ticketId,
  costId,
  initial,
  staff,
  currentUserId,
  canSetPrice,
  needsPrice,
  catalogName,
  laborHint,
  cancelHref,
}: {
  ticketId: number;
  costId: string;
  initial: CostFormValues;
  staff: StaffChoice[];
  currentUserId: string;
  canSetPrice: boolean;
  /** Preis fehlt noch */
  needsPrice: boolean;
  /** Katalogeintrag der Position (für „Preis auch im Katalog speichern“), nur für Administratoren */
  catalogName: string | null;
  laborHint: string;
  cancelHref: string;
}) {
  const [state, action] = useActionState(updateCostAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const values = state.status === "error" ? (state.values ?? null) : null;
  const errors = state.fieldErrors ?? {};

  const start: CostFormValues = values
    ? {
        kind: values.kind ?? initial.kind,
        description: values.description ?? "",
        performedAt: values.performedAt ?? initial.performedAt,
        quantity: values.quantity ?? "",
        unit: values.unit ?? initial.unit,
        unitPrice: values.unitPrice ?? "",
        performedById: values.performedById ?? initial.performedById,
        billed: values.billed === "on",
      }
    : initial;

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="@container space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="costId" value={costId} />
      <FormMessage state={state} />
      <EditFields
        start={start}
        errors={errors}
        staff={staff}
        currentUserId={currentUserId}
        canSetPrice={canSetPrice}
        needsPrice={needsPrice}
        catalogName={catalogName}
        laborHint={laborHint}
        savePriceDefault={values ? values.savePriceToCatalog === "on" : false}
      />
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SubmitButton pendingText="Wird gespeichert …">Änderungen speichern</SubmitButton>
        <Link href={cancelHref} className={buttonClasses("ghost")}>
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

function EditFields({
  start,
  errors,
  staff,
  currentUserId,
  canSetPrice,
  needsPrice,
  catalogName,
  laborHint,
  savePriceDefault,
}: {
  start: CostFormValues;
  errors: Record<string, string>;
  staff: StaffChoice[];
  currentUserId: string;
  canSetPrice: boolean;
  needsPrice: boolean;
  catalogName: string | null;
  laborHint: string;
  savePriceDefault: boolean;
}) {
  const [kind, setKind] = useState(start.kind);
  const [unit, setUnit] = useState(start.unit);
  const [quantity, setQuantity] = useState(start.quantity);
  const [unitPrice, setUnitPrice] = useState(start.unitPrice);
  const showLaborHint = kind === "LABOR" && unit === "Std.";

  return (
    <>
      <div className="grid gap-4 @md:grid-cols-[12rem_minmax(0,1fr)]">
        <Field label="Art" htmlFor="kosten-kind" error={errors.kind}>
          <Select
            {...fieldA11y("kosten-kind", errors.kind)}
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={costControl}
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
            maxLength={COST_DESCRIPTION_MAX}
            defaultValue={start.description}
            className={costControl}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 @xl:grid-cols-4">
        <Field label="Menge" htmlFor="kosten-quantity" error={errors.quantity}>
          <Input
            {...fieldA11y("kosten-quantity", errors.quantity, showLaborHint)}
            name="quantity"
            inputMode="decimal"
            autoComplete="off"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1,25"
            className={cn(costControl, "tabular-nums")}
          />
        </Field>
        <Field
          label="Einheit"
          htmlFor="kosten-unit"
          error={errors.unit}
          hint={!canSetPrice && unit !== start.unit ? "Mit anderer Einheit prüft die Verwaltung den Preis neu." : undefined}
        >
          <Select
            {...fieldA11y("kosten-unit", errors.unit, !canSetPrice && unit !== start.unit)}
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={costControl}
          >
            {COST_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Datum" htmlFor="kosten-date" error={errors.performedAt}>
          <Input
            {...fieldA11y("kosten-date", errors.performedAt)}
            name="performedAt"
            type="date"
            defaultValue={start.performedAt}
            className={costControl}
          />
        </Field>
        <div className="col-span-2">
          <PerformerField
            id="kosten-performer"
            staff={staff}
            currentUserId={currentUserId}
            defaultValue={start.performedById}
            error={errors.performedById}
          />
        </div>
        {canSetPrice ? (
          <>
            <PriceField
              id="kosten-price"
              value={unitPrice}
              onChange={setUnitPrice}
              error={errors.unitPrice}
              hint={needsPrice ? "Fehlt noch. Leer = folgt später" : "Leer = Preis folgt später"}
            />
            <TotalOutput quantity={quantity} unitPrice={unitPrice} />
          </>
        ) : null}
      </div>

      {showLaborHint ? (
        <p id="kosten-quantity-hint" className="-mt-1 text-xs text-ink-muted">
          Arbeitszeit: {laborHint}
        </p>
      ) : null}

      {canSetPrice ? (
        <div className="space-y-3">
          {catalogName ? (
            <Checkbox
              name="savePriceToCatalog"
              defaultChecked={savePriceDefault}
              label={`Preis auch im Katalog speichern („${catalogName}“)`}
              hint="Gilt dann für neue Positionen. Bereits erfasste behalten ihren Preis."
              className="text-sm"
            />
          ) : null}
          <div>
            <Checkbox
              name="billed"
              defaultChecked={start.billed}
              label="Bereits abgerechnet"
              aria-invalid={errors.billed ? true : undefined}
              aria-describedby={errors.billed ? "kosten-billed-error" : undefined}
              className="text-sm"
            />
            <FieldError id="kosten-billed-error">{errors.billed}</FieldError>
          </div>
        </div>
      ) : null}
    </>
  );
}

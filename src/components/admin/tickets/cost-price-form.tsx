"use client";

import { useActionState, useState } from "react";
import { setCostPriceAction } from "@/lib/actions/admin-costs";
import { initialFormState } from "@/lib/forms";
import { formatMoney, lineTotalCents, parseMoney } from "@/lib/format";
import { Checkbox, FieldError, Input, Label } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useStaffForm } from "@/components/admin/tickets/use-staff-form";

/**
 * Fehlenden Preis direkt im Ticket nachtragen (nur Administratoren).
 * Nach dem Speichern lädt die Seite neu, die Position zählt dann in den Summen.
 */
export function CostPriceForm({
  ticketId,
  costId,
  description,
  quantityHundredths,
  unit,
  catalogName,
}: {
  ticketId: number;
  costId: string;
  description: string;
  quantityHundredths: number;
  unit: string;
  /** Katalogeintrag der Position oder null (dann wird sie auf Wunsch in den Katalog aufgenommen) */
  catalogName: string | null;
}) {
  const [state, action] = useActionState(setCostPriceAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const values = state.status === "error" ? (state.values ?? null) : null;
  const error = state.fieldErrors?.unitPrice;
  const [price, setPrice] = useState(values?.unitPrice ?? "");
  const id = `preis-${costId}`;
  const parsed = parseMoney(price);
  const total = parsed === null ? null : lineTotalCents(quantityHundredths, parsed);

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-2.5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="costId" value={costId} />
      {state.status === "error" && !error ? <FormMessage state={state} /> : null}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div className="w-36">
          <Label htmlFor={id} className="mb-1 text-xs">
            Einzelpreis (€) je {unit}
          </Label>
          <Input
            id={id}
            name="unitPrice"
            inputMode="decimal"
            autoComplete="off"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0,00"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            aria-label={`Einzelpreis (€) je ${unit}: ${description}`}
            className="h-9 text-sm tabular-nums"
          />
        </div>
        <p className="pb-2 text-sm text-ink-muted tabular-nums" aria-live="polite">
          {total === null ? "" : `= ${formatMoney(total)}`}
        </p>
        <SubmitButton size="sm" pendingText="Wird gespeichert …" className="mb-0.5">
          Preis speichern
        </SubmitButton>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
      <Checkbox
        name="saveToCatalog"
        defaultChecked={values ? values.saveToCatalog === "on" : false}
        label={catalogName ? `Preis auch im Katalog speichern („${catalogName}“)` : "Mit diesem Preis in den Katalog aufnehmen"}
        className="text-xs"
      />
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPresetAction, updatePresetAction } from "@/lib/actions/admin-cost-catalog";
import { initialFormState } from "@/lib/forms";
import { COST_KINDS, COST_KIND_DEFAULT_UNIT, COST_KIND_LABELS, COST_UNITS, type CostKind } from "@/lib/constants";
import { PRESET_NAME_MAX } from "@/lib/cost-catalog";
import { buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";

export type CatalogFormValues = {
  name: string;
  kind: string;
  unit: string;
  /** deutsche Schreibweise, leer = Preis je Position */
  unitPrice: string;
  /** deutsche Schreibweise */
  defaultQuantity: string;
  active: boolean;
};

/** Katalogeintrag anlegen oder bearbeiten (nur Administratoren). */
export function CatalogForm({ presetId, initial }: { presetId?: string; initial: CatalogFormValues }) {
  const [state, action] = useActionState(presetId ? updatePresetAction : createPresetAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const values = state.status === "error" ? (state.values ?? null) : null;
  const start: CatalogFormValues = values
    ? {
        name: values.name ?? "",
        kind: values.kind ?? initial.kind,
        unit: values.unit ?? initial.unit,
        unitPrice: values.unitPrice ?? "",
        defaultQuantity: values.defaultQuantity ?? "",
        active: values.active === "on",
      }
    : initial;

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="@container space-y-5">
      {presetId ? <input type="hidden" name="presetId" value={presetId} /> : null}
      <FormMessage state={state} />
      <Fields start={start} errors={state.fieldErrors ?? {}} editing={Boolean(presetId)} />
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <SubmitButton pendingText="Wird gespeichert …">{presetId ? "Änderungen speichern" : "In den Katalog aufnehmen"}</SubmitButton>
        <Link href="/admin/kosten/katalog" className={buttonClasses("ghost")}>
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

function Fields({ start, errors, editing }: { start: CatalogFormValues; errors: Record<string, string>; editing: boolean }) {
  const [kind, setKind] = useState(start.kind);
  const [unit, setUnit] = useState(start.unit);

  function changeKind(next: string) {
    setKind(next);
    // Beim Anlegen die passende Einheit vorschlagen; beim Bearbeiten nichts automatisch ändern
    const suggested = COST_KIND_DEFAULT_UNIT[next as CostKind];
    if (!editing && suggested) setUnit(suggested);
  }

  return (
    <>
      <Field label="Bezeichnung" htmlFor="katalog-name" error={errors.name} hint="So steht die Position im Ticket und später auf der Rechnung.">
        <Input
          {...fieldA11y("katalog-name", errors.name, true)}
          name="name"
          maxLength={PRESET_NAME_MAX}
          defaultValue={start.name}
          placeholder="z. B. Anfahrt Neu-Ulm"
        />
      </Field>

      <div className="grid gap-5 @md:grid-cols-2">
        <Field label="Art" htmlFor="katalog-kind" error={errors.kind}>
          <Select {...fieldA11y("katalog-kind", errors.kind)} name="kind" value={kind} onChange={(e) => changeKind(e.target.value)}>
            {COST_KINDS.map((k) => (
              <option key={k} value={k}>
                {COST_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Einheit" htmlFor="katalog-unit" error={errors.unit}>
          <Select {...fieldA11y("katalog-unit", errors.unit)} name="unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {COST_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 @md:grid-cols-2">
        <Field
          label={`Preis netto je ${unit} (€)`}
          htmlFor="katalog-price"
          optional
          error={errors.unitPrice}
          hint="Leer lassen, wenn der Preis je Position festgelegt wird, z. B. Material nach Beleg."
        >
          <Input
            {...fieldA11y("katalog-price", errors.unitPrice, true)}
            name="unitPrice"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={start.unitPrice}
            placeholder="z. B. 95,00"
            className="tabular-nums"
          />
        </Field>
        <Field
          label="Standardmenge"
          htmlFor="katalog-quantity"
          error={errors.defaultQuantity}
          hint="Wird beim Erfassen vorgeschlagen, z. B. 0,5 für eine halbe Stunde."
        >
          <Input
            {...fieldA11y("katalog-quantity", errors.defaultQuantity, true)}
            name="defaultQuantity"
            inputMode="decimal"
            autoComplete="off"
            defaultValue={start.defaultQuantity}
            placeholder="1"
            className="tabular-nums"
          />
        </Field>
      </div>

      {editing ? (
        <Checkbox
          name="active"
          defaultChecked={start.active}
          label="Aktiv"
          hint="Deaktivierte Einträge stehen im Ticket nicht mehr zur Auswahl. Bereits erfasste Positionen bleiben unverändert."
        />
      ) : null}

      {editing ? (
        <p className="text-sm text-ink-muted">Preisänderungen gelten für neue Positionen. Bereits erfasste Positionen behalten ihren Preis.</p>
      ) : null}
    </>
  );
}

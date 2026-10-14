"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { updateTicketMetaAction } from "@/lib/actions/admin-tickets";
import { initialFormState } from "@/lib/forms";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  TYPE_LABELS,
} from "@/lib/constants";
import { Field, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { showToast } from "@/components/ui/toaster";
import { OPTION_INDENT, PRIVATE_CUSTOMER } from "@/components/admin/tickets/filters";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";
import { LocationSelect } from "@/components/admin/location-select";

export type MetaValues = {
  priority: string;
  type: string;
  category: string;
  /** Firmen-ID oder "privat" */
  customer: string;
  /** Standort-ID oder "" */
  locationId: string;
};

const KEYS: (keyof MetaValues)[] = ["priority", "type", "category", "customer", "locationId"];

export type MetaCompanyGroup = { id: string; name: string; companies: { id: string; name: string; isRoot: boolean }[] };

/** Zahl der Felder, die vom gespeicherten Stand abweichen */
function countChanges(form: HTMLFormElement, current: MetaValues): number {
  const data = new FormData(form);
  return KEYS.filter((key) => data.has(key) && String(data.get(key)) !== current[key]).length;
}

/**
 * Seitenleiste „Details“: Priorität, Art, Bereich, Zuordnung und Standort.
 * Status und Bearbeiter stehen in der Schnellleiste oben (TicketQuickBar).
 * Speichern ist erst möglich, wenn sich etwas geändert hat; Erfolg erscheint als kurze Meldung.
 * Wird neu aufgebaut, wenn sich die gespeicherten Werte ändern (auch durch Kollegen, live).
 */
export function TicketMetaForm({
  ticketId,
  current,
  companyGroups,
  allowPrivate,
  customerHint,
  locations,
}: {
  ticketId: number;
  current: MetaValues;
  companyGroups: MetaCompanyGroup[];
  /** „Privatkunde“ als Zuordnung anbieten (nur bei ursprünglich privaten Tickets) */
  allowPrivate: boolean;
  customerHint?: string;
  /** Standorte (aktive, dazu ein evtl. deaktivierter aktueller); leer = Feld ausblenden */
  locations: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(updateTicketMetaAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const version = KEYS.map((key) => current[key]).join("|");
  const key = `${formKey}-${version}`;
  // Änderungen gehören zu genau diesem Aufbau des Formulars; ein neuer Aufbau beginnt wieder bei 0
  const [changes, setChanges] = useState({ key: "", count: 0 });
  const errorValues = state.status === "error" ? (state.values ?? null) : null;
  const changed = changes.key === key ? changes.count : errorValues ? 1 : 0;

  useEffect(() => {
    if (state.status === "success" && state.message) showToast(state.message);
  }, [state]);

  function onChange(event: FormEvent<HTMLFormElement>) {
    setChanges({ key, count: countChanges(event.currentTarget, current) });
  }

  return (
    <form key={key} ref={formRef} action={action} onChange={onChange} noValidate className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <MetaFields
        current={current}
        values={errorValues}
        errors={state.fieldErrors ?? {}}
        companyGroups={companyGroups}
        allowPrivate={allowPrivate}
        customerHint={customerHint}
        locations={locations}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <SubmitButton size="sm" pendingText="Wird gespeichert …" disabled={changed === 0}>
          Änderungen speichern
        </SubmitButton>
        <span className="text-xs text-ink-muted" aria-live="polite">
          {changed === 1 ? "1 Änderung" : changed > 1 ? `${changed} Änderungen` : ""}
        </span>
      </div>
    </form>
  );
}

function MetaFields({
  current,
  values,
  errors,
  companyGroups,
  allowPrivate,
  customerHint,
  locations,
}: {
  current: MetaValues;
  values: Record<string, string> | null;
  errors: Record<string, string>;
  companyGroups: MetaCompanyGroup[];
  allowPrivate: boolean;
  customerHint?: string;
  locations: { value: string; label: string }[];
}) {
  const initial = (key: keyof MetaValues) => (values ? (values[key] ?? current[key]) : current[key]);
  const [customer, setCustomer] = useState(initial("customer"));

  const movingAwayFromPrivate = current.customer === PRIVATE_CUSTOMER && customer !== PRIVATE_CUSTOMER;
  const selectClass = "h-10 text-sm";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Field label="Priorität" htmlFor="meta-priority" error={errors.priority}>
          <Select
            {...fieldA11y("meta-priority", errors.priority)}
            name="priority"
            defaultValue={initial("priority")}
            className={selectClass}
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Art" htmlFor="meta-type" error={errors.type}>
          <Select {...fieldA11y("meta-type", errors.type)} name="type" defaultValue={initial("type")} className={selectClass}>
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bereich" htmlFor="meta-category" error={errors.category} className="col-span-2 lg:col-span-1">
          <Select
            {...fieldA11y("meta-category", errors.category)}
            name="category"
            defaultValue={initial("category")}
            className={selectClass}
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Zuordnung"
        htmlFor="meta-customer"
        error={errors.customer}
        hint={
          movingAwayFromPrivate
            ? "Danach gehört das Ticket zum Firmenkunden. Der Status-Link des Privatkunden funktioniert dann nicht mehr."
            : customerHint
        }
      >
        <Select
          {...fieldA11y("meta-customer", errors.customer, Boolean(movingAwayFromPrivate || customerHint))}
          name="customer"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          className={selectClass}
        >
          {allowPrivate ? <option value={PRIVATE_CUSTOMER}>Privatkunde</option> : null}
          {companyGroups.map((g) => (
            <optgroup key={g.id} label={g.name}>
              {g.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isRoot ? c.name : `${OPTION_INDENT}${c.name}`}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>

      {/* Gleiche Höhe wie die übrigen Felder der Seitenleiste */}
      <div className="[&_select]:h-10 [&_select]:text-sm">
        <LocationSelect
          label="Standort"
          options={locations}
          defaultValue={initial("locationId")}
          error={errors.locationId}
          emptyLabel="Kein bestimmter Standort"
        />
      </div>
    </>
  );
}

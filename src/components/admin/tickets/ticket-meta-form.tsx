"use client";

import { useActionState, useState } from "react";
import { updateTicketMetaAction } from "@/lib/actions/admin-tickets";
import { initialFormState } from "@/lib/forms";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS_STAFF,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  TYPE_LABELS,
} from "@/lib/constants";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { OPTION_INDENT, PRIVATE_CUSTOMER } from "@/components/admin/tickets/filters";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";
import { LocationSelect } from "@/components/admin/location-select";

export type MetaValues = {
  status: string;
  priority: string;
  type: string;
  category: string;
  assigneeId: string;
  /** Firmen-ID oder "privat" */
  customer: string;
  /** Standort-ID oder "" */
  locationId: string;
};

export type MetaCompanyGroup = { id: string; name: string; companies: { id: string; name: string; isRoot: boolean }[] };

/**
 * Seitenleiste „Bearbeitung“: Status, Priorität, Art, Bereich, Bearbeiter und Zuordnung.
 * Wird neu aufgebaut, wenn sich die gespeicherten Werte ändern (auch durch Kollegen, live).
 */
export function TicketMetaForm({
  ticketId,
  current,
  staff,
  companyGroups,
  allowPrivate,
  customerHint,
  recipientEmail,
  locations,
}: {
  ticketId: number;
  current: MetaValues;
  staff: { id: string; name: string; active: boolean }[];
  companyGroups: MetaCompanyGroup[];
  /** „Privatkunde“ als Zuordnung anbieten (nur bei ursprünglich privaten Tickets) */
  allowPrivate: boolean;
  customerHint?: string;
  /** Adresse für Status-Mails an den Kunden oder null */
  recipientEmail: string | null;
  /** Standorte (aktive, dazu ein evtl. deaktivierter aktueller); leer = Feld ausblenden */
  locations: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(updateTicketMetaAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const version = Object.values(current).join("|");

  return (
    <form key={`${formKey}-${version}`} ref={formRef} action={action} noValidate className="space-y-4">
      <input type="hidden" name="ticketId" value={ticketId} />
      <FormMessage state={state} />
      <MetaFields
        current={current}
        values={state.status === "error" ? (state.values ?? null) : null}
        errors={state.fieldErrors ?? {}}
        staff={staff}
        companyGroups={companyGroups}
        allowPrivate={allowPrivate}
        customerHint={customerHint}
        recipientEmail={recipientEmail}
        locations={locations}
      />
      <SubmitButton size="md" className="w-full" pendingText="Wird gespeichert …">
        Änderungen speichern
      </SubmitButton>
    </form>
  );
}

function MetaFields({
  current,
  values,
  errors,
  staff,
  companyGroups,
  allowPrivate,
  customerHint,
  recipientEmail,
  locations,
}: {
  current: MetaValues;
  values: Record<string, string> | null;
  errors: Record<string, string>;
  staff: { id: string; name: string; active: boolean }[];
  companyGroups: MetaCompanyGroup[];
  allowPrivate: boolean;
  customerHint?: string;
  recipientEmail: string | null;
  locations: { value: string; label: string }[];
}) {
  const initial = (key: keyof MetaValues) => (values ? (values[key] ?? current[key]) : current[key]);
  const [status, setStatus] = useState(initial("status"));
  const [customer, setCustomer] = useState(initial("customer"));

  const statusChangedToDone = status !== current.status && (status === "RESOLVED" || status === "CLOSED");
  const movingAwayFromPrivate = current.customer === PRIVATE_CUSTOMER && customer !== PRIVATE_CUSTOMER;
  const selectClass = "h-10 text-sm";

  return (
    <>
      <Field label="Status" htmlFor="meta-status" error={errors.status}>
        <Select
          {...fieldA11y("meta-status", errors.status)}
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectClass}
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS_STAFF[s]}
            </option>
          ))}
        </Select>
      </Field>

      {statusChangedToDone ? (
        recipientEmail ? (
          <Checkbox
            name="notify"
            defaultChecked={values ? values.notify === "on" : true}
            label="Kunden per E-Mail informieren"
            hint={`Kurze Nachricht an ${recipientEmail}, dass das Ticket „${STATUS_LABELS_STAFF[status as keyof typeof STATUS_LABELS_STAFF]}“ ist.`}
            className="text-sm"
          />
        ) : (
          <p className="text-xs text-ink-muted">Keine E-Mail-Adresse hinterlegt – der Kunde wird nicht benachrichtigt.</p>
        )
      ) : null}

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <Field label="Art" htmlFor="meta-type" error={errors.type}>
          <Select {...fieldA11y("meta-type", errors.type)} name="type" defaultValue={initial("type")} className={selectClass}>
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Bereich" htmlFor="meta-category" error={errors.category}>
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

      <Field label="Bearbeiter" htmlFor="meta-assigneeId" error={errors.assigneeId}>
        <Select
          {...fieldA11y("meta-assigneeId", errors.assigneeId)}
          name="assigneeId"
          defaultValue={initial("assigneeId")}
          className={selectClass}
        >
          <option value="">Noch niemand</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.active ? s.name : `${s.name} (deaktiviert)`}
            </option>
          ))}
        </Select>
      </Field>

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

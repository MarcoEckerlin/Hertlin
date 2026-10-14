"use client";

import { useActionState, useState } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  CATEGORY_LABELS,
  PRIORITY_HINTS,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  TYPE_LABELS,
} from "@/lib/constants";
import { initialFormState, type FormState } from "@/lib/forms";
import { PRIVATE_CUSTOMER, type CustomerGroup, type TicketFormDefaults } from "./types";

function errorProps(state: FormState, name: string) {
  const error = state.fieldErrors?.[name];
  return {
    id: name,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${name}-error` : `${name}-hint`,
  } as const;
}

/** Formular „Ticket aus Anruf“: Kunde (vorausgewählt, falls erkannt), Betreff, Gesprächsnotiz, Priorität. */
export function CreateTicketFromCallForm({
  action,
  customers,
  defaults,
  callSummary,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  customers: CustomerGroup[];
  defaults: TicketFormDefaults;
  callSummary: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [customer, setCustomer] = useState(defaults.customer);
  const [contactUserId, setContactUserId] = useState(defaults.contactUserId);
  const values = state.values ?? {};
  const fe = state.fieldErrors ?? {};

  const isPrivate = customer === PRIVATE_CUSTOMER;
  const company = customers.flatMap((g) => g.companies).find((c) => c.id === customer) ?? null;
  const showContactFields = isPrivate || (company !== null && !contactUserId);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <FormMessage state={state} />

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-bold text-ink">Kunde</legend>
        <Field
          label="Kunde"
          htmlFor="customer"
          error={fe.customer}
          hint="Bei unbekannten Anrufern bitte auswählen. Die Zuordnung wird auch am Anruf gespeichert."
        >
          <Select
            {...errorProps(state, "customer")}
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setContactUserId(e.target.value === defaults.customer ? defaults.contactUserId : "");
            }}
            required
          >
            <option value="">Bitte auswählen</option>
            <option value={PRIVATE_CUSTOMER}>Privatkunde (ohne Kundenkonto)</option>
            {customers.map((group) => (
              <optgroup key={group.rootId} label={group.rootName}>
                {group.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isRoot ? c.name : `${group.rootName} › ${c.name}`}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>

        {company ? (
          <Field
            label="Ansprechpartner"
            htmlFor="contactUserId"
            error={fe.contactUserId}
            hint={
              company.users.length === 0
                ? "Für diesen Kunden ist noch kein Benutzer angelegt."
                : "Mit Ansprechpartner sieht diese Person das Ticket im Kundenportal und bekommt die E-Mails dazu."
            }
          >
            <Select {...errorProps(state, "contactUserId")} value={contactUserId} onChange={(e) => setContactUserId(e.target.value)}>
              <option value="">Kein Benutzer – Kontakt unten eintragen</option>
              {company.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {showContactFields ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" htmlFor="contactName" error={fe.contactName} optional={!isPrivate}>
              <Input
                {...errorProps(state, "contactName")}
                defaultValue={values.contactName ?? defaults.contactName}
                autoComplete="off"
                required={isPrivate}
              />
            </Field>
            <Field label="Telefon" htmlFor="contactPhone" error={fe.contactPhone} optional>
              <Input
                {...errorProps(state, "contactPhone")}
                type="tel"
                defaultValue={values.contactPhone ?? defaults.contactPhone}
                autoComplete="off"
              />
            </Field>
            <Field
              label="E-Mail"
              htmlFor="contactEmail"
              error={fe.contactEmail}
              optional
              hint={isPrivate ? "Für die Bestätigung mit Status-Link." : undefined}
            >
              <Input
                {...errorProps(state, "contactEmail")}
                type="email"
                defaultValue={values.contactEmail ?? defaults.contactEmail}
                autoComplete="off"
              />
            </Field>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-sm font-bold text-ink">Ticket</legend>
        <Field label="Betreff" htmlFor="subject" error={fe.subject}>
          <Input
            {...errorProps(state, "subject")}
            defaultValue={values.subject ?? ""}
            placeholder="z. B. Drucker am Empfang druckt nicht mehr"
            maxLength={160}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Art" htmlFor="type" error={fe.type}>
            <Select {...errorProps(state, "type")} defaultValue={values.type ?? "STOERUNG"}>
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bereich" htmlFor="category" error={fe.category}>
            <Select {...errorProps(state, "category")} defaultValue={values.category ?? "SONSTIGES"}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priorität" htmlFor="priority" error={fe.priority}>
            <Select {...errorProps(state, "priority")} defaultValue={values.priority ?? "NORMAL"}>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p} title={PRIORITY_HINTS[p]}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Gesprächsnotiz (intern)"
          htmlFor="note"
          error={fe.note}
          hint="Nur für Hertlin sichtbar. Zeitpunkt, Nummer und Dauer des Anrufs stellen wir automatisch voran."
        >
          <p className="mb-2 rounded-xl bg-mist px-3 py-2 text-xs text-ink-muted ring-1 ring-line ring-inset">{callSummary}</p>
          <Textarea
            {...errorProps(state, "note")}
            rows={6}
            defaultValue={values.note ?? ""}
            placeholder="Was hat der Kunde geschildert? Was wurde schon ausprobiert oder vereinbart?"
            required
          />
        </Field>

        <Field
          label="Nachricht an den Kunden"
          htmlFor="publicMessage"
          error={fe.publicMessage}
          optional
          hint="Erscheint für den Kunden im Ticket, z. B. was am Telefon vereinbart wurde."
        >
          <Textarea
            {...errorProps(state, "publicMessage")}
            rows={3}
            defaultValue={values.publicMessage ?? ""}
            placeholder="z. B. Wie besprochen schauen wir uns den Drucker morgen Vormittag per Fernwartung an."
          />
        </Field>
      </fieldset>

      <div className="space-y-3">
        <Checkbox
          name="notify"
          defaultChecked={state.values ? values.notify === "on" : true}
          label="Eingangsbestätigung per E-Mail an den Kunden senden"
          hint="Nur wenn eine E-Mail-Adresse bekannt ist. Privatkunden bekommen damit ihren Status-Link."
        />
        <Checkbox name="assignToMe" defaultChecked={values.assignToMe === "on"} label="Ticket mir zuweisen" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Ticket wird angelegt …">Ticket anlegen</SubmitButton>
      </div>
    </form>
  );
}

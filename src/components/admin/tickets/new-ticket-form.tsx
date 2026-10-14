"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createStaffTicketAction } from "@/lib/actions/admin-tickets";
import { initialFormState } from "@/lib/forms";
import {
  CATEGORY_LABELS,
  PRIORITY_HINTS,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  TYPE_LABELS,
} from "@/lib/constants";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonClasses } from "@/components/ui/button";
import { AttachmentInput, type UploadRules } from "@/components/forms/attachment-input";
import { FormSection } from "@/components/forms/controls";
import { OPTION_INDENT, PRIVATE_CUSTOMER } from "@/components/admin/tickets/filters";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";

export type NewTicketContact = { id: string; name: string; email: string; phone: string | null; role: string };
export type NewTicketCompany = {
  id: string;
  name: string;
  /** Pfad für die Anzeige, z. B. „Muster GmbH › Büro Ulm“ */
  label: string;
  isRoot: boolean;
  users: NewTicketContact[];
  /** Bei Unterkunden: Hauptansprechpartner des Firmenkunden (sehen im Portal alle Unterkunden) */
  rootAdmins: NewTicketContact[];
};
export type NewTicketCustomerGroup = { id: string; name: string; companies: NewTicketCompany[] };
export type NewTicketDefaults = {
  customer: string;
  contactUserId: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  subject: string;
};

/** Neues Ticket in der Verwaltung, z. B. nach einem Anruf oder einer E-Mail. */
export function NewTicketForm({
  groups,
  staff,
  currentUserId,
  defaults,
  uploadRules,
}: {
  groups: NewTicketCustomerGroup[];
  staff: { id: string; name: string }[];
  currentUserId: string;
  defaults: NewTicketDefaults;
  uploadRules: UploadRules;
}) {
  const [state, action] = useActionState(createStaffTicketAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const values = state.status === "error" ? (state.values ?? {}) : null;

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-7">
      <FormMessage state={state} />
      <FormBody
        groups={groups}
        staff={staff}
        currentUserId={currentUserId}
        defaults={defaults}
        values={values}
        errors={state.fieldErrors ?? {}}
        uploadRules={uploadRules}
      />
    </form>
  );
}

function FormBody({
  groups,
  staff,
  currentUserId,
  defaults,
  values,
  errors,
  uploadRules,
}: {
  groups: NewTicketCustomerGroup[];
  staff: { id: string; name: string }[];
  currentUserId: string;
  defaults: NewTicketDefaults;
  /** Eingaben nach einem Fehler, sonst null */
  values: Record<string, string> | null;
  errors: Record<string, string>;
  uploadRules: UploadRules;
}) {
  const [customer, setCustomer] = useState(values ? (values.customer ?? "") : defaults.customer);
  const [contactUserId, setContactUserId] = useState(values ? (values.contactUserId ?? "") : defaults.contactUserId);

  const v = (key: Exclude<keyof NewTicketDefaults, "customer" | "contactUserId">) => (values ? (values[key] ?? "") : defaults[key]);

  const isPrivate = customer === PRIVATE_CUSTOMER;
  const company = groups.flatMap((g) => g.companies).find((c) => c.id === customer) ?? null;
  const contacts = company ? [...company.users, ...company.rootAdmins] : [];
  const contactUser = contacts.find((u) => u.id === contactUserId) ?? null;
  const showContactFields = isPrivate || (company !== null && !contactUser);
  const notifyDefault = values ? values.notify === "on" : true;

  return (
    <>
      <FormSection id="neu-kunde" title="Kunde" first>
        <Field
          label="Kunde"
          htmlFor="neu-customer"
          error={errors.customer}
          hint="Firmenkunden mit ihren Unterkunden. Privatkunden bekommen einen Status-Link statt eines Portalzugangs."
        >
          <Select
            {...fieldA11y("neu-customer", errors.customer, true)}
            name="customer"
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setContactUserId("");
            }}
          >
            <option value="">Bitte auswählen</option>
            <option value={PRIVATE_CUSTOMER}>Privatkunde (ohne Kundenkonto)</option>
            {groups.length > 0 ? (
              <optgroup label="Firmenkunden">
                {groups.flatMap((g) =>
                  g.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.isRoot ? c.name : `${OPTION_INDENT}${c.name}`}
                    </option>
                  )),
                )}
              </optgroup>
            ) : null}
          </Select>
        </Field>

        {company ? (
          <Field
            label="Ansprechpartner"
            htmlFor="neu-contactUserId"
            optional
            error={errors.contactUserId}
            hint={
              contacts.length === 0
                ? `Für ${company.label} ist noch kein Benutzer angelegt. Tragen Sie die Kontaktdaten unten ein.`
                : "Mit Ansprechpartner sieht diese Person das Ticket im Kundenportal und bekommt die E-Mails dazu."
            }
          >
            <Select
              {...fieldA11y("neu-contactUserId", errors.contactUserId, true)}
              name="contactUserId"
              value={contactUserId}
              onChange={(e) => setContactUserId(e.target.value)}
              disabled={contacts.length === 0}
            >
              <option value="">Kein Benutzer – Kontaktdaten selbst eintragen</option>
              {company.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.role === "CUSTOMER_ADMIN" ? `${u.name} (Hauptansprechpartner)` : u.name}
                </option>
              ))}
              {company.rootAdmins.map((u) => (
                <option key={u.id} value={u.id}>
                  {`${u.name} (Hauptansprechpartner Firmenkunde)`}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {contactUser ? (
          <p className="rounded-xl bg-mist px-4 py-3 text-sm text-ink-soft ring-1 ring-line ring-inset">
            E-Mails zum Ticket gehen an <span className="font-semibold text-ink">{contactUser.email}</span>
            {contactUser.phone ? (
              <>
                {" "}
                · Telefon <span className="whitespace-nowrap">{contactUser.phone}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {showContactFields ? (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="neu-contactName" optional={!isPrivate} error={errors.contactName}>
                <Input
                  {...fieldA11y("neu-contactName", errors.contactName)}
                  name="contactName"
                  autoComplete="off"
                  maxLength={120}
                  defaultValue={v("contactName")}
                />
              </Field>
              <Field
                label="E-Mail"
                htmlFor="neu-contactEmail"
                optional={!isPrivate}
                error={errors.contactEmail}
                hint={isPrivate ? "Dorthin geht der Status-Link." : "Für Benachrichtigungen zum Ticket."}
              >
                <Input
                  {...fieldA11y("neu-contactEmail", errors.contactEmail, true)}
                  name="contactEmail"
                  type="email"
                  autoComplete="off"
                  maxLength={200}
                  defaultValue={v("contactEmail")}
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Telefon" htmlFor="neu-contactPhone" optional error={errors.contactPhone}>
                <Input
                  {...fieldA11y("neu-contactPhone", errors.contactPhone)}
                  name="contactPhone"
                  type="tel"
                  autoComplete="off"
                  maxLength={40}
                  defaultValue={v("contactPhone")}
                />
              </Field>
              {isPrivate ? (
                <Field
                  label="Anschrift"
                  htmlFor="neu-contactAddress"
                  optional
                  hint="Für Termine vor Ort."
                  error={errors.contactAddress}
                >
                  <Input
                    {...fieldA11y("neu-contactAddress", errors.contactAddress, true)}
                    name="contactAddress"
                    autoComplete="off"
                    maxLength={300}
                    placeholder="Straße, PLZ Ort"
                    defaultValue={v("contactAddress")}
                  />
                </Field>
              ) : null}
            </div>
          </div>
        ) : null}
      </FormSection>

      <FormSection id="neu-ticket" title="Ticket">
        <Field label="Betreff" htmlFor="neu-subject" error={errors.subject}>
          <Input
            {...fieldA11y("neu-subject", errors.subject)}
            name="subject"
            maxLength={150}
            placeholder="z. B. Drucker am Empfang druckt nur leere Seiten"
            defaultValue={v("subject")}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Art" htmlFor="neu-type" error={errors.type}>
            <Select {...fieldA11y("neu-type", errors.type)} name="type" defaultValue={values?.type ?? "STOERUNG"}>
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bereich" htmlFor="neu-category" error={errors.category}>
            <Select {...fieldA11y("neu-category", errors.category)} name="category" defaultValue={values?.category ?? "SONSTIGES"}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priorität" htmlFor="neu-priority" error={errors.priority}>
            <Select {...fieldA11y("neu-priority", errors.priority)} name="priority" defaultValue={values?.priority ?? "NORMAL"}>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {`${PRIORITY_LABELS[p]} – ${PRIORITY_HINTS[p]}`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Bearbeiter"
          htmlFor="neu-assigneeId"
          error={errors.assigneeId}
          hint="Mit Bearbeiter steht das Ticket gleich auf „In Bearbeitung“."
          className="sm:max-w-sm"
        >
          <Select
            {...fieldA11y("neu-assigneeId", errors.assigneeId, true)}
            name="assigneeId"
            defaultValue={values ? (values.assigneeId ?? "") : currentUserId}
          >
            <option value="">Noch niemand</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === currentUserId ? `${s.name} (ich)` : s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Beschreibung"
          htmlFor="neu-body"
          error={errors.body}
          hint="Der Kunde sieht diesen Text als erste Nachricht im Ticket. Interne Hinweise schreiben Sie danach als interne Notiz."
        >
          <Textarea
            {...fieldA11y("neu-body", errors.body, true)}
            name="body"
            rows={7}
            maxLength={10000}
            placeholder="Was ist das Problem, seit wann, wer ist betroffen? Was wurde schon vereinbart?"
            defaultValue={values?.body ?? ""}
          />
        </Field>

        <AttachmentInput
          id="neu-attachments"
          label="Dateien anhängen"
          hint={`Z. B. ein Foto oder ein Screenshot, den der Kunde geschickt hat. Erlaubt sind ${uploadRules.allowedLabel}.`}
          error={errors.attachments}
          rules={uploadRules}
        />

        <Checkbox
          name="notify"
          defaultChecked={notifyDefault}
          label="Kunden per E-Mail informieren"
          hint={
            isPrivate
              ? "Er bekommt eine Bestätigung mit seinem persönlichen Status-Link."
              : "Die E-Mail enthält die Beschreibung und den Link zum Ticket im Kundenportal – sofern eine Adresse bekannt ist."
          }
        />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <SubmitButton pendingText="Ticket wird angelegt …">Ticket anlegen</SubmitButton>
        <Link href="/admin/tickets" className={buttonClasses("ghost")}>
          Abbrechen
        </Link>
      </div>
    </>
  );
}

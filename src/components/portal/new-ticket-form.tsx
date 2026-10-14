"use client";

import { useActionState, useState } from "react";
import { ClipboardList, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialFormState } from "@/lib/forms";
import {
  CATEGORY_LABELS,
  PRIORITY_HINTS,
  PRIORITY_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  TYPE_HINTS,
  TYPE_LABELS,
  type TicketPriority,
  type TicketType,
} from "@/lib/constants";
import { createPortalTicketAction } from "@/lib/actions/portal-tickets";
import { Alert } from "@/components/ui/alert";
import { Field, FieldError, Hint, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { AttachmentInput, type UploadRules } from "@/components/forms/attachment-input";
import { fieldA11y, usePortalForm } from "@/components/portal/use-portal-form";

const ID = "ticket";

const TYPE_ICONS = { STOERUNG: Wrench, ANFRAGE: ClipboardList } as const;

/** Vorschlag für die Priorität, solange der Benutzer sie nicht selbst gewählt hat. */
const DEFAULT_PRIORITY: Record<TicketType, TicketPriority> = { STOERUNG: "NORMAL", ANFRAGE: "LOW" };

const SUBJECT_PLACEHOLDER: Record<TicketType, string> = {
  STOERUNG: "z. B. Outlook startet nicht mehr",
  ANFRAGE: "z. B. Neuer Arbeitsplatz für Frau Weber ab 1. Dezember",
};

const DESCRIPTION_HINT: Record<TicketType, string> = {
  STOERUNG:
    "Was genau passiert? Seit wann? Wer ist betroffen – nur Sie oder mehrere? Gibt es eine Fehlermeldung? Am besten wörtlich abschreiben oder als Screenshot anhängen.",
  ANFRAGE:
    "Was wird gebraucht, für wen und bis wann? Gibt es Vorgaben, z. B. ein bestimmtes Gerät, eine Software oder einen Kostenrahmen?",
};

const DESCRIPTION_PLACEHOLDER: Record<TicketType, string> = {
  STOERUNG: [
    "Was funktioniert nicht?",
    "Seit wann tritt das auf?",
    "Wer ist betroffen (Name, Arbeitsplatz)?",
    "Fehlermeldung (wörtlich):",
  ].join("\n"),
  ANFRAGE: ["Was wird gebraucht?", "Für wen?", "Bis wann?"].join("\n"),
};

function isTicketType(value: string | undefined): value is TicketType {
  return !!value && (TICKET_TYPES as readonly string[]).includes(value);
}

function isPriority(value: string | undefined): value is TicketPriority {
  return !!value && (TICKET_PRIORITIES as readonly string[]).includes(value);
}

export type NewTicketCompanyOption = { id: string; name: string; isRoot: boolean };

export function NewTicketForm({
  defaultType,
  companies,
  defaultCompanyId,
  userPhone,
  userEmail,
  sitePhone,
  sitePhoneHref,
  uploadRules,
}: {
  defaultType: TicketType;
  /** Nur übergeben, wenn der Benutzer zwischen mehreren Firmen wählen darf */
  companies: NewTicketCompanyOption[] | null;
  defaultCompanyId: string;
  userPhone: string | null;
  userEmail: string;
  sitePhone: string;
  sitePhoneHref: string;
  uploadRules: UploadRules;
}) {
  const [state, action] = useActionState(createPortalTicketAction, initialFormState);
  const { formRef, formKey } = usePortalForm(state);

  const [type, setType] = useState<TicketType>(defaultType);
  const [priority, setPriority] = useState<TicketPriority>(DEFAULT_PRIORITY[defaultType]);
  const [priorityChosen, setPriorityChosen] = useState(false);

  // Nach einem Fehler die abgeschickte Auswahl übernehmen (das Formular wird neu aufgebaut)
  const [restoredFrom, setRestoredFrom] = useState(state);
  if (state !== restoredFrom) {
    setRestoredFrom(state);
    const sentType = state.values?.type;
    const sentPriority = state.values?.priority;
    if (isTicketType(sentType)) setType(sentType);
    if (isPriority(sentPriority)) {
      setPriority(sentPriority);
      setPriorityChosen(true);
    }
  }

  function changeType(next: TicketType) {
    setType(next);
    if (!priorityChosen) setPriority(DEFAULT_PRIORITY[next]);
  }

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-7">
      <FormMessage state={state} />

      {/* Art */}
      <fieldset
        className="min-w-0"
        aria-invalid={errors.type ? true : undefined}
        aria-describedby={errors.type ? `${ID}-type-error` : undefined}
      >
        <legend className="mb-2 text-sm font-semibold text-ink">Worum geht es?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {TICKET_TYPES.map((option) => {
            const Icon = TYPE_ICONS[option];
            const checked = type === option;
            return (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer gap-3.5 rounded-2xl border p-4 transition-colors sm:p-5",
                  checked
                    ? "border-brand-400 bg-brand-50 ring-1 ring-brand-400 ring-inset"
                    : "border-line-strong bg-white hover:border-brand-300 hover:bg-brand-50/40",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={option}
                  checked={checked}
                  onChange={() => changeType(option)}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-base font-bold text-ink">
                    <Icon className={cn("size-4", checked ? "text-brand-700" : "text-ink-muted")} aria-hidden />
                    {TYPE_LABELS[option]}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{TYPE_HINTS[option]}</span>
                </span>
              </label>
            );
          })}
        </div>
        <FieldError id={`${ID}-type-error`}>{errors.type}</FieldError>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Bereich" htmlFor={`${ID}-category`} error={errors.category}>
          <Select {...fieldA11y(`${ID}-category`, errors.category)} name="category" defaultValue={values.category ?? ""}>
            <option value="" disabled>
              Bitte auswählen
            </option>
            {TICKET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>

        {companies && companies.length > 1 ? (
          <Field
            label="Für welche Firma?"
            htmlFor={`${ID}-company`}
            hint="Ordnen Sie das Ticket der Firma oder dem Standort zu, um den es geht."
            error={errors.companyId}
          >
            <Select
              {...fieldA11y(`${ID}-company`, errors.companyId, true)}
              name="companyId"
              defaultValue={values.companyId ?? defaultCompanyId}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.isRoot ? company.name : `${company.name} (Unterkunde)`}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>

      {/* Priorität */}
      <fieldset
        className="min-w-0"
        aria-invalid={errors.priority ? true : undefined}
        aria-describedby={errors.priority ? `${ID}-priority-error` : `${ID}-priority-hint`}
      >
        <legend className="mb-2 text-sm font-semibold text-ink">Wie dringend ist es?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TICKET_PRIORITIES.map((option) => {
            const checked = priority === option;
            return (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                  checked
                    ? option === "CRITICAL"
                      ? "border-red-300 bg-red-50/60 ring-1 ring-red-300 ring-inset"
                      : "border-brand-400 bg-brand-50 ring-1 ring-brand-400 ring-inset"
                    : "border-line-strong bg-white hover:border-brand-300",
                )}
              >
                <input
                  type="radio"
                  name="priority"
                  value={option}
                  checked={checked}
                  onChange={() => {
                    setPriority(option);
                    setPriorityChosen(true);
                  }}
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{PRIORITY_LABELS[option]}</span>
                  <span className="block text-sm text-ink-muted">{PRIORITY_HINTS[option]}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.priority ? (
          <FieldError id={`${ID}-priority-error`}>{errors.priority}</FieldError>
        ) : (
          <Hint id={`${ID}-priority-hint`}>
            Danach richtet sich, in welcher Reihenfolge wir Tickets bearbeiten. Wir passen die Einstufung an, falls nötig.
          </Hint>
        )}
      </fieldset>

      {priority === "CRITICAL" ? (
        <Alert tone="warning" title={`Bitte zusätzlich anrufen: ${sitePhone}`}>
          Wenn niemand arbeiten kann, zählt jede Minute. Rufen Sie uns unter{" "}
          <a href={`tel:${sitePhoneHref}`} className="font-semibold whitespace-nowrap underline underline-offset-2">
            {sitePhone}
          </a>{" "}
          an und legen Sie das Ticket trotzdem an – dann ist alles dokumentiert und wir können direkt loslegen.
        </Alert>
      ) : null}

      <Field label="Betreff" htmlFor={`${ID}-subject`} error={errors.subject}>
        <Input
          {...fieldA11y(`${ID}-subject`, errors.subject)}
          name="subject"
          maxLength={150}
          placeholder={SUBJECT_PLACEHOLDER[type]}
          defaultValue={values.subject}
        />
      </Field>

      <Field label="Beschreibung" htmlFor={`${ID}-description`} hint={DESCRIPTION_HINT[type]} error={errors.description}>
        <Textarea
          {...fieldA11y(`${ID}-description`, errors.description, true)}
          name="description"
          rows={8}
          maxLength={10000}
          placeholder={DESCRIPTION_PLACEHOLDER[type]}
          defaultValue={values.description}
        />
      </Field>

      <Field
        label="Rückrufnummer"
        htmlFor={`${ID}-phone`}
        optional
        hint="Unter dieser Nummer erreichen wir Sie bei Rückfragen zu diesem Ticket."
        error={errors.contactPhone}
      >
        <Input
          {...fieldA11y(`${ID}-phone`, errors.contactPhone, true)}
          name="contactPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={40}
          defaultValue={values.contactPhone ?? userPhone ?? ""}
          className="sm:max-w-xs"
        />
      </Field>

      <AttachmentInput
        id={`${ID}-attachments`}
        label="Screenshots oder Dateien"
        hint={`Ein Foto der Fehlermeldung hilft oft mehr als eine lange Beschreibung. Erlaubt sind ${uploadRules.allowedLabel}.`}
        error={errors.attachments}
        rules={uploadRules}
      />

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:gap-5">
        <SubmitButton size="lg" pendingText="Wird gesendet …" className="w-full sm:w-auto">
          Ticket absenden
        </SubmitButton>
        <p className="text-sm text-ink-muted">
          Sie bekommen sofort eine Ticketnummer und eine Bestätigung an <span className="break-all">{userEmail}</span>.
        </p>
      </div>
    </form>
  );
}

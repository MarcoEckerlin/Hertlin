"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

/** Anruf mit einem vorhandenen Ticket verknüpfen (Ticketnummer eingeben). */
export function LinkTicketForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, initialFormState);
  const values = state.values ?? {};
  const error = state.fieldErrors?.ticket;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Ticketnummer"
        htmlFor="link-ticket"
        error={error}
        hint="Zum Beispiel T-00042 oder einfach 42."
      >
        <Input
          id="link-ticket"
          name="ticket"
          defaultValue={values.ticket ?? ""}
          inputMode="text"
          autoComplete="off"
          placeholder="T-00042"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "link-ticket-error" : "link-ticket-hint"}
          className="max-w-xs"
          required
        />
      </Field>
      <Field
        label="Notiz für das Ticket"
        htmlFor="link-note"
        error={state.fieldErrors?.note}
        optional
        hint="Wird zusammen mit den Angaben zum Anruf als interne Notiz im Ticket gespeichert."
      >
        <Textarea id="link-note" name="note" rows={3} defaultValue={values.note ?? ""} />
      </Field>
      <SubmitButton variant="secondary" pendingText="Wird verknüpft …">
        Verknüpfen
      </SubmitButton>
    </form>
  );
}

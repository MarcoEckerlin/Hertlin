"use client";

import { useActionState } from "react";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

/** Kurze interne Notiz am Anruf, z. B. „Rückruf vereinbart für 14 Uhr“. */
export function CallNoteForm({
  action,
  note,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  note: string | null;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const error = state.fieldErrors?.note;

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field
        label="Notiz zum Anruf"
        htmlFor="call-note"
        error={error}
        hint="Nur für Hertlin sichtbar, z. B. „Rückruf für 14 Uhr vereinbart“."
      >
        <Textarea
          id="call-note"
          name="note"
          rows={3}
          maxLength={2000}
          defaultValue={state.values?.note ?? note ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "call-note-error" : "call-note-hint"}
        />
      </Field>
      <SubmitButton variant="secondary" size="sm" pendingText="Wird gespeichert …">
        Notiz speichern
      </SubmitButton>
    </form>
  );
}

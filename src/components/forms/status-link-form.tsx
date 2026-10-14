"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/forms";
import { resendStatusLinkAction } from "@/lib/actions/public";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { a11yProps } from "@/components/forms/controls";
import { useFormFeedback } from "@/components/forms/use-form-feedback";

const ID = "statuslink";

/** „Link verloren?“ – schickt den Status-Link an die hinterlegte Adresse, wenn die Angaben passen. */
export function StatusLinkForm() {
  const [state, action] = useActionState(resendStatusLinkAction, initialFormState);
  const { formRef } = useFormFeedback(state);

  if (state.status === "success") return <FormMessage state={state} />;

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <Field
        label="E-Mail-Adresse"
        htmlFor={`${ID}-email`}
        hint="Die Adresse, die Sie im Formular angegeben haben."
        error={errors.email}
      >
        <Input
          {...a11yProps(`${ID}-email`, errors.email, true)}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={200}
          defaultValue={values.email}
        />
      </Field>
      <Field
        label="Ticketnummer"
        htmlFor={`${ID}-ticketNumber`}
        hint="Beginnt mit T-, z. B. T-00042, und steht im Betreff unserer E-Mails. Bei einer Anfrage mit A-Nummer nutzen Sie bitte den Link aus Ihrer Bestätigungs-E-Mail."
        error={errors.ticketNumber}
      >
        <Input
          {...a11yProps(`${ID}-ticketNumber`, errors.ticketNumber, true)}
          name="ticketNumber"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          placeholder="T-00042"
          defaultValue={values.ticketNumber}
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Wird gesendet …">
        Link zusenden
      </SubmitButton>
    </form>
  );
}

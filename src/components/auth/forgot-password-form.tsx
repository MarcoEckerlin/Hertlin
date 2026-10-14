"use client";

import { useActionState } from "react";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/forms";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialFormState);
  if (state.status === "success") return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field label="E-Mail-Adresse" htmlFor="email" error={state.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={!!state.fieldErrors?.email}
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Wird gesendet …">
        Link anfordern
      </SubmitButton>
    </form>
  );
}

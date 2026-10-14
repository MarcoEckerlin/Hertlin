"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/forms";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function SetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(setPasswordAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      {/* Hilft Passwort-Managern, das Passwort dem richtigen Konto zuzuordnen */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field
        label="Neues Passwort"
        htmlFor="password"
        hint="Mindestens 10 Zeichen. Ein kurzer Satz lässt sich gut merken."
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          aria-invalid={!!state.fieldErrors?.password}
        />
      </Field>
      <Field label="Passwort wiederholen" htmlFor="passwordConfirm" error={state.fieldErrors?.passwordConfirm}>
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.passwordConfirm}
        />
      </Field>
      <SubmitButton className="w-full" pendingText="Wird gespeichert …">
        Passwort speichern und anmelden
      </SubmitButton>
    </form>
  );
}

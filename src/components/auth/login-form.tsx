"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { loginAction } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/forms";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({ next, forgotHref }: { next?: string; forgotHref: string }) {
  const [state, action] = useActionState(loginAction, initialFormState);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Nach einem Fehler zurück ins Formular: zum markierten Feld, sonst ins (geleerte) Passwortfeld
  useEffect(() => {
    if (state.status !== "error") return;
    if (state.fieldErrors?.email) emailRef.current?.focus();
    else passwordRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="E-Mail-Adresse" htmlFor="email" error={state.fieldErrors?.email}>
        <Input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.values?.email}
          aria-invalid={!!state.fieldErrors?.email}
        />
      </Field>
      <Field label="Passwort" htmlFor="password" error={state.fieldErrors?.password}>
        <Input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
        />
      </Field>
      <div className="flex items-center justify-between gap-4 pt-1">
        <Link href={forgotHref} className="text-sm font-semibold text-brand-700 hover:underline">
          Passwort vergessen?
        </Link>
        <SubmitButton pendingText="Anmelden …">Anmelden</SubmitButton>
      </div>
    </form>
  );
}

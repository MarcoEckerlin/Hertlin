"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/forms";
import { changeStaffPasswordAction, updateStaffProfileAction } from "@/lib/actions/admin-profile";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";

/** Name, Telefon und Position des angemeldeten Mitarbeiters. */
export function StaffProfileForm({ name, phone, position }: { name: string; phone: string | null; position: string | null }) {
  const [state, action] = useActionState(updateStaffProfileAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const errors = state.fieldErrors ?? {};
  // Nach einem Fehler die Eingaben zeigen, sonst die gespeicherten Werte
  const values = state.status === "error" ? (state.values ?? {}) : { name, phone: phone ?? "", position: position ?? "" };

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <Field label="Name" htmlFor="profil-name" hint="So erscheinen Sie bei Kunden im Ticketverlauf." error={errors.name}>
        <Input
          {...fieldA11y("profil-name", errors.name, true)}
          name="name"
          autoComplete="name"
          maxLength={120}
          defaultValue={values.name}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefon" htmlFor="profil-phone" optional hint="Durchwahl oder Mobilnummer für Kollegen." error={errors.phone}>
          <Input
            {...fieldA11y("profil-phone", errors.phone, true)}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={40}
            defaultValue={values.phone}
          />
        </Field>
        <Field label="Position" htmlFor="profil-position" optional hint="z. B. Systemtechniker" error={errors.position}>
          <Input
            {...fieldA11y("profil-position", errors.position, true)}
            name="position"
            autoComplete="organization-title"
            maxLength={120}
            defaultValue={values.position}
          />
        </Field>
      </div>
      <SubmitButton pendingText="Wird gespeichert …">Angaben speichern</SubmitButton>
    </form>
  );
}

/** Passwort ändern mit Bestätigung durch das aktuelle Passwort. Andere Sitzungen werden danach beendet. */
export function StaffPasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState(changeStaffPasswordAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const errors = state.fieldErrors ?? {};

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      {/* Hilft Passwort-Managern, das Passwort dem richtigen Konto zuzuordnen */}
      <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
      <Field label="Aktuelles Passwort" htmlFor="pw-current" error={errors.currentPassword}>
        <Input
          {...fieldA11y("pw-current", errors.currentPassword)}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="sm:max-w-sm"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Neues Passwort"
          htmlFor="pw-new"
          hint="Mindestens 10 Zeichen. Ein kurzer Satz lässt sich gut merken."
          error={errors.password}
        >
          <Input
            {...fieldA11y("pw-new", errors.password, true)}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
          />
        </Field>
        <Field label="Neues Passwort wiederholen" htmlFor="pw-confirm" error={errors.passwordConfirm}>
          <Input
            {...fieldA11y("pw-confirm", errors.passwordConfirm)}
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
          />
        </Field>
      </div>
      <SubmitButton pendingText="Wird gespeichert …">Passwort ändern</SubmitButton>
    </form>
  );
}

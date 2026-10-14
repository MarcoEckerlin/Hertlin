"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/forms";
import { LANGUAGES } from "@/lib/languages";
import {
  changePortalPasswordAction,
  updatePortalLanguageAction,
  updatePortalProfileAction,
} from "@/lib/actions/portal-profile";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldA11y, usePortalForm } from "@/components/portal/use-portal-form";

/** Name, Telefon und Position des angemeldeten Benutzers. */
export function ProfileForm({ name, phone, position }: { name: string; phone: string | null; position: string | null }) {
  const [state, action] = useActionState(updatePortalProfileAction, initialFormState);
  const { formRef, formKey } = usePortalForm(state);
  const errors = state.fieldErrors ?? {};
  // Nach einem Fehler die Eingaben zeigen, sonst die gespeicherten Werte
  const values = state.status === "error" ? (state.values ?? {}) : { name, phone: phone ?? "", position: position ?? "" };

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <Field label="Name" htmlFor="profil-name" error={errors.name}>
        <Input
          {...fieldA11y("profil-name", errors.name)}
          name="name"
          autoComplete="name"
          maxLength={120}
          defaultValue={values.name}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Telefon"
          htmlFor="profil-phone"
          optional
          hint="Wird bei neuen Tickets als Rückrufnummer vorgeschlagen."
          error={errors.phone}
        >
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
        <Field label="Position" htmlFor="profil-position" optional hint="z. B. Büroleitung oder Buchhaltung" error={errors.position}>
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

/**
 * Sprache für Nachrichten (User.language): Antworten von Hertlin werden in diese Sprache übersetzt.
 * enabled = false: Übersetzungsdienst nicht eingerichtet – Auswahl nur zur Ansicht.
 */
export function LanguageForm({ language, enabled }: { language: string; enabled: boolean }) {
  const [state, action] = useActionState(updatePortalLanguageAction, initialFormState);
  const { formRef, formKey } = usePortalForm(state);
  const errors = state.fieldErrors ?? {};
  const value = state.status === "error" ? (state.values?.language ?? language) : language;
  const hint = enabled
    ? "Ihre eigenen Nachrichten schreiben Sie in der Sprache, die Ihnen am leichtesten fällt."
    : "Die automatische Übersetzung ist gerade ausgeschaltet. Nachrichten erscheinen so, wie sie geschrieben wurden.";

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-5">
      <FormMessage state={state} />
      <Field label="Sprache" htmlFor="profil-language" hint={hint} error={errors.language} className="sm:max-w-sm">
        {/* Sprachnamen in der eigenen Schrift lassen, auch wenn die Seite übersetzt angezeigt wird */}
        <div data-no-translate>
          <Select
            {...fieldA11y("profil-language", errors.language, true)}
            name="language"
            defaultValue={value}
            disabled={!enabled}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.code === "de" ? "Deutsch (Standard)" : `${l.native} (${l.label})`}
              </option>
            ))}
          </Select>
        </div>
      </Field>
      {enabled ? <SubmitButton pendingText="Wird gespeichert …">Sprache speichern</SubmitButton> : null}
    </form>
  );
}

/** Passwort ändern mit Bestätigung durch das aktuelle Passwort. Andere Sitzungen werden danach beendet. */
export function PasswordForm({ email }: { email: string }) {
  const [state, action] = useActionState(changePortalPasswordAction, initialFormState);
  const { formRef, formKey } = usePortalForm(state);
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

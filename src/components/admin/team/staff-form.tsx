"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, FieldError, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormSection } from "@/components/admin/companies/company-fields";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { InviteLinkBox } from "@/components/admin/companies/invite-link-box";
import { LocationSelect } from "@/components/admin/location-select";
import { createStaffAction, updateStaffAction } from "@/lib/actions/admin-team";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { initialFormState } from "@/lib/forms";

export type StaffValues = {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  role: "ADMIN" | "TECHNICIAN";
  active: boolean;
  /** "" = kein Standort */
  locationId: string;
};

/** Auswahl der Standorte (aus locationOptions(), ggf. ergänzt um den bisherigen, inzwischen deaktivierten Standort) */
export type StaffLocationOption = { value: string; label: string };

const LOCATION_HINT = "Wo die Person in der Regel arbeitet. Hilft beim Verteilen von Tickets und Einsätzen.";

const STAFF_ROLE_OPTIONS = ["TECHNICIAN", "ADMIN"] as const;

function StaffRoleChoice({ value, error, disabled, hint }: { value: string; error?: string; disabled?: boolean; hint?: string }) {
  return (
    <fieldset
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? "staff-role-error" : hint ? "staff-role-hint" : undefined}
    >
      <legend className="mb-1.5 text-sm font-semibold text-ink">Rolle</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {STAFF_ROLE_OPTIONS.map((role) => (
          <label
            key={role}
            className={cn(
              "flex gap-3 rounded-xl border border-line-strong p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-200",
              disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
            )}
          >
            <input
              type="radio"
              name="role"
              value={role}
              defaultChecked={value === role}
              disabled={disabled}
              className="mt-0.5 size-4 shrink-0 accent-brand-600"
            />
            <span>
              <span className="block text-[0.9375rem] font-semibold text-ink">{ROLE_LABELS[role]}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">{ROLE_DESCRIPTIONS[role]}</span>
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <FieldError id="staff-role-error">{error}</FieldError>
      ) : hint ? (
        <p id="staff-role-hint" className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}

function StaffContactFields({ values, errors }: { values: Partial<Record<string, string>>; errors: Record<string, string> }) {
  return (
    <>
      <Field label="Name" htmlFor="staff-name" error={errors.name}>
        <Input
          {...fieldProps("staff-name", errors.name)}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={values.name ?? ""}
        />
      </Field>
      <Field
        label="E-Mail-Adresse"
        htmlFor="staff-email"
        error={errors.email}
        hint="Dienstliche Adresse. Damit meldet sich die Person in der Verwaltung an."
      >
        <Input
          {...fieldProps("staff-email", errors.email, true)}
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={values.email ?? ""}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefon" htmlFor="staff-phone" error={errors.phone} optional>
          <Input
            {...fieldProps("staff-phone", errors.phone)}
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={values.phone ?? ""}
          />
        </Field>
        <Field label="Position" htmlFor="staff-position" error={errors.position} optional>
          <Input
            {...fieldProps("staff-position", errors.position)}
            name="position"
            maxLength={120}
            autoComplete="off"
            placeholder="z. B. Systemtechniker"
            defaultValue={values.position ?? ""}
          />
        </Field>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

export function StaffCreate({ locations = [] }: { locations?: StaffLocationOption[] }) {
  const [round, setRound] = useState(0);
  return <StaffCreateForm key={round} locations={locations} onAgain={() => setRound((r) => r + 1)} />;
}

function StaffCreateForm({ locations, onAgain }: { locations: StaffLocationOption[]; onAgain: () => void }) {
  const [state, formAction] = useActionState(createStaffAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  if (state.status === "success" && state.data?.userId) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title="Teammitglied angelegt">
          {state.message}
        </Alert>
        {state.data.inviteLink ? <InviteLinkBox link={state.data.inviteLink} name={state.data.name ?? "die Person"} /> : null}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/team">Zur Teamliste</ButtonLink>
          <button type="button" className={buttonClasses("secondary")} onClick={onAgain}>
            Weitere Person einladen
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <FormMessage state={state} />
      <FormSection title="Person">
        <StaffContactFields values={values} errors={errors} />
        <LocationSelect
          label="Standort"
          options={locations}
          defaultValue={values.locationId}
          error={errors.locationId}
          hint={LOCATION_HINT}
        />
      </FormSection>
      <FormSection title="Zugang">
        <StaffRoleChoice value={values.role ?? "TECHNICIAN"} error={errors.role} />
        <p className="text-sm text-ink-muted">
          Die Person bekommt eine Einladung per E-Mail und legt ihr Passwort selbst fest. Den Link sehen Sie nach dem Anlegen auch
          hier.
        </p>
      </FormSection>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <SubmitButton pendingText="Wird angelegt …">Einladen</SubmitButton>
        <ButtonLink href="/admin/team" variant="ghost">
          Abbrechen
        </ButtonLink>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function StaffEditForm({
  user,
  isSelf,
  invited,
  locations = [],
}: {
  user: StaffValues;
  isSelf: boolean;
  invited: boolean;
  locations?: StaffLocationOption[];
}) {
  const [state, formAction] = useActionState(updateStaffAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values: Partial<Record<string, string>> = state.values ?? {
    name: user.name,
    email: user.email,
    phone: user.phone,
    position: user.position,
    role: user.role,
    locationId: user.locationId,
  };
  const active = isSelf ? true : state.values ? state.values.active === "on" : user.active;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <FormMessage state={state} />
      {state.status === "success" && state.data?.inviteLink ? (
        <InviteLinkBox link={state.data.inviteLink} name={state.data.name ?? user.name} />
      ) : null}

      <FormSection title="Person">
        <StaffContactFields values={values} errors={errors} />
        {invited ? (
          <p className="-mt-2 text-sm text-ink-muted">
            Die Einladung ist noch offen. Ändern Sie die E-Mail-Adresse, geht automatisch eine neue Einladung an die neue Adresse.
          </p>
        ) : null}
        <LocationSelect
          label="Standort"
          options={locations}
          defaultValue={values.locationId}
          error={errors.locationId}
          hint={LOCATION_HINT}
        />
      </FormSection>

      <FormSection title="Zugang">
        <StaffRoleChoice
          value={isSelf ? user.role : (values.role ?? user.role)}
          error={errors.role}
          disabled={isSelf}
          hint={isSelf ? "Ihre eigene Rolle können Sie nicht ändern – das muss ein anderer Administrator tun." : undefined}
        />
        <div className={cn("rounded-xl border p-4", active ? "border-line" : "border-amber-200 bg-amber-50/60")}>
          <Checkbox
            id="staff-active"
            name="active"
            defaultChecked={active}
            disabled={isSelf}
            label="Zugang aktiv"
            hint={
              isSelf
                ? "Ihr eigenes Konto können Sie nicht deaktivieren."
                : "Ohne Haken kann sich die Person nicht mehr anmelden und wird sofort abgemeldet. Tickets und Notizen bleiben erhalten."
            }
          />
        </div>
      </FormSection>

      <div className="border-t border-line pt-6">
        {/* Verstecktes Feld am Ende, damit der erste Abschnitt ohne Trennlinie beginnt */}
        <input type="hidden" name="id" value={user.id} />
        <SubmitButton pendingText="Wird gespeichert …">Änderungen speichern</SubmitButton>
      </div>
    </form>
  );
}

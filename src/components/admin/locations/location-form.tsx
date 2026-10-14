"use client";

import { useActionState } from "react";
import { Checkbox, Field, FieldError, Input, Textarea } from "@/components/ui/field";
import { ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormSection } from "@/components/admin/companies/company-fields";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { MAX_OPENING_HOUR_LINES, type LocationDraft } from "@/components/admin/locations/rules";
import { createLocationAction, updateLocationAction } from "@/lib/actions/admin-locations";
import { cn } from "@/lib/cn";
import { initialFormState, type FormState } from "@/lib/forms";

type Values = Partial<Record<string, string>>;

function LocationFields({ values, errors }: { values: Values; errors: Record<string, string> }) {
  return (
    <>
      <Field
        label="Name"
        htmlFor="location-name"
        error={errors.name}
        hint="So erscheint der Standort auf der Website und in den Auswahllisten, z. B. „Hertlin Ulm“."
      >
        <Input
          {...fieldProps("location-name", errors.name, true)}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={values.name ?? ""}
        />
      </Field>
      <Field label="Straße und Hausnummer" htmlFor="location-street" error={errors.street}>
        <Input
          {...fieldProps("location-street", errors.street)}
          name="street"
          required
          maxLength={160}
          autoComplete="off"
          defaultValue={values.street ?? ""}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="PLZ" htmlFor="location-zip" error={errors.zip}>
          <Input
            {...fieldProps("location-zip", errors.zip)}
            name="zip"
            required
            maxLength={10}
            inputMode="numeric"
            autoComplete="off"
            defaultValue={values.zip ?? ""}
          />
        </Field>
        <Field label="Ort" htmlFor="location-city" error={errors.city}>
          <Input
            {...fieldProps("location-city", errors.city)}
            name="city"
            required
            maxLength={80}
            autoComplete="off"
            defaultValue={values.city ?? ""}
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefon" htmlFor="location-phone" error={errors.phone} optional>
          <Input
            {...fieldProps("location-phone", errors.phone)}
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={values.phone ?? ""}
          />
        </Field>
        <Field label="E-Mail-Adresse" htmlFor="location-email" error={errors.email} optional>
          <Input
            {...fieldProps("location-email", errors.email)}
            name="email"
            type="email"
            maxLength={200}
            autoComplete="off"
            defaultValue={values.email ?? ""}
          />
        </Field>
      </div>
      <Field
        label="Öffnungszeiten"
        htmlFor="location-openingHours"
        error={errors.openingHours}
        hint={`Eine Zeile pro Eintrag, z. B. „Mo–Fr: 8:00 – 17:00 Uhr“ (höchstens ${MAX_OPENING_HOUR_LINES} Zeilen).`}
        optional
      >
        <Textarea
          {...fieldProps("location-openingHours", errors.openingHours, true)}
          name="openingHours"
          rows={3}
          maxLength={2000}
          defaultValue={values.openingHours ?? ""}
        />
      </Field>
      <Field
        label="Hinweis für Besucher"
        htmlFor="location-note"
        error={errors.note}
        hint="Erscheint auf der Website, z. B. „Kundenparkplätze im Hof“."
        optional
      >
        <Input
          {...fieldProps("location-note", errors.note, true)}
          name="note"
          maxLength={300}
          autoComplete="off"
          defaultValue={values.note ?? ""}
        />
      </Field>
    </>
  );
}

function CheckboxWithError({
  id,
  name,
  label,
  hint,
  defaultChecked,
  error,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
  error?: string;
}) {
  return (
    <div>
      <Checkbox
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        label={label}
        hint={hint}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function WebsiteCheckbox({ values, errors, fallback }: { values: Values | null; errors: Record<string, string>; fallback: boolean }) {
  return (
    <CheckboxWithError
      id="location-showOnWebsite"
      name="showOnWebsite"
      label="Auf der Website zeigen"
      hint="Im Website-Modul „Standorte“ (z. B. auf der Kontaktseite) und in der Fußzeile."
      defaultChecked={values ? values.showOnWebsite === "on" : fallback}
      error={errors.showOnWebsite}
    />
  );
}

/* ------------------------------------------------------------------ */

/** Neuer Standort. currentMain: Name des bisherigen Hauptsitzes (null = es gibt noch keinen). */
export function LocationCreateForm({
  initial,
  currentMain,
  suggestMain,
}: {
  initial: LocationDraft;
  currentMain: string | null;
  /** Haken „Hauptsitz“ vorbelegen (z. B. bei Übernahme aus den Firmendaten) */
  suggestMain: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(createLocationAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const submitted = state.values ?? null;
  const values: Values = submitted ?? initial;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <FormMessage state={state} />
      <FormSection title="Anschrift und Kontakt">
        <LocationFields values={values} errors={errors} />
      </FormSection>
      <FormSection title="Einstellungen">
        {currentMain ? (
          <CheckboxWithError
            id="location-isMain"
            name="isMain"
            label="Hauptsitz"
            hint={`Der Hauptsitz steht auf der Website zuerst. Bisher ist das ${currentMain} – er wird dann ein normaler Standort.`}
            defaultChecked={submitted ? submitted.isMain === "on" : suggestMain}
            error={errors.isMain}
          />
        ) : (
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
            Der erste Standort wird automatisch der Hauptsitz.
          </p>
        )}
        <WebsiteCheckbox values={submitted} errors={errors} fallback />
      </FormSection>
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <SubmitButton pendingText="Wird angelegt …">Standort anlegen</SubmitButton>
        <ButtonLink href="/admin/standorte" variant="ghost">
          Abbrechen
        </ButtonLink>
      </div>
    </form>
  );
}

export type LocationEditValues = LocationDraft & {
  id: string;
  isMain: boolean;
  showOnWebsite: boolean;
  active: boolean;
};

/** Standort bearbeiten: Angaben, Hauptsitz, Website und aktiv/deaktiviert. */
export function LocationEditForm({ location, currentMain }: { location: LocationEditValues; currentMain: string | null }) {
  const [state, formAction] = useActionState<FormState, FormData>(updateLocationAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const submitted = state.status === "error" ? (state.values ?? null) : null;
  const values: Values = submitted ?? {
    name: location.name,
    street: location.street,
    zip: location.zip,
    city: location.city,
    phone: location.phone,
    email: location.email,
    openingHours: location.openingHours,
    note: location.note,
  };
  const active = submitted ? submitted.active === "on" : location.active;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <FormMessage state={state} />
      <FormSection title="Anschrift und Kontakt">
        <LocationFields values={values} errors={errors} />
      </FormSection>
      <FormSection title="Einstellungen">
        {location.isMain ? (
          <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <strong className="font-semibold">Das ist der Hauptsitz.</strong> Er steht auf der Website zuerst. Um das zu ändern,
            machen Sie einen anderen Standort zum Hauptsitz.
          </p>
        ) : (
          <CheckboxWithError
            id="location-isMain"
            name="isMain"
            label="Zum Hauptsitz machen"
            hint={
              currentMain
                ? `Der Hauptsitz steht auf der Website zuerst. Bisher ist das ${currentMain} – er wird dann ein normaler Standort.`
                : "Der Hauptsitz steht auf der Website zuerst."
            }
            defaultChecked={submitted ? submitted.isMain === "on" : false}
            error={errors.isMain}
          />
        )}
        <WebsiteCheckbox values={submitted} errors={errors} fallback={location.showOnWebsite} />
        <div className={cn("rounded-xl border p-4", active ? "border-line" : "border-warning-line bg-warning-soft")}>
          <CheckboxWithError
            id="location-active"
            name="active"
            label="Standort aktiv"
            hint="Ohne Haken steht der Standort nicht mehr zur Auswahl und erscheint nicht auf der Website. Bestehende Zuordnungen von Kunden, Mitarbeitern und Tickets bleiben erhalten."
            defaultChecked={active}
            error={errors.active}
          />
        </div>
      </FormSection>
      <div className="border-t border-line pt-6">
        {/* Verstecktes Feld am Ende, damit der erste Abschnitt ohne Trennlinie beginnt */}
        <input type="hidden" name="id" value={location.id} />
        <SubmitButton pendingText="Wird gespeichert …">Änderungen speichern</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useId, type ReactNode } from "react";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { LocationSelect } from "@/components/admin/location-select";
import { fieldProps } from "@/components/admin/companies/form-helpers";

export type CompanyFieldValues = {
  name?: string | null;
  customerNumber?: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  internalNote?: string | null;
  locationId?: string | null;
  billingEmail?: string | null;
  billingName?: string | null;
  billingStreet?: string | null;
  billingZip?: string | null;
  billingCity?: string | null;
  vatId?: string | null;
  /** Nur Unterkunden; aus Formularwerten kommt "on" */
  invoiceSeparately?: boolean | string | null;
};

export type LocationOption = { value: string; label: string };

/** Überschrift eines Formularabschnitts */
export function FormSection({
  title,
  description,
  id,
  children,
}: {
  title: string;
  description?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-24 space-y-5 border-t border-line pt-6 first-of-type:border-t-0 first-of-type:pt-0"
    >
      <div>
        <h2 id={headingId} className="text-base font-bold text-ink">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Anschrift und Kontaktdaten einer Firma (Firmenkunde oder Unterkunde). */
export function CompanyAddressFields({
  prefix,
  values,
  errors,
}: {
  prefix: string;
  values: CompanyFieldValues;
  errors: Record<string, string>;
}) {
  const id = (name: string) => `${prefix}-${name}`;
  return (
    <>
      <Field label="Straße und Hausnummer" htmlFor={id("street")} error={errors.street} optional>
        <Input
          {...fieldProps(id("street"), errors.street)}
          name="street"
          maxLength={160}
          autoComplete="off"
          defaultValue={values.street ?? ""}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
        <Field label="PLZ" htmlFor={id("zip")} error={errors.zip} optional>
          <Input
            {...fieldProps(id("zip"), errors.zip)}
            name="zip"
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
            defaultValue={values.zip ?? ""}
          />
        </Field>
        <Field label="Ort" htmlFor={id("city")} error={errors.city} optional>
          <Input
            {...fieldProps(id("city"), errors.city)}
            name="city"
            maxLength={120}
            autoComplete="off"
            defaultValue={values.city ?? ""}
          />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Telefon"
          htmlFor={id("phone")}
          error={errors.phone}
          optional
          hint="Zentrale Nummer, z. B. für die Anruferkennung."
        >
          <Input
            {...fieldProps(id("phone"), errors.phone, true)}
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={values.phone ?? ""}
          />
        </Field>
        <Field label="E-Mail" htmlFor={id("email")} error={errors.email} optional hint="Allgemeine Adresse, z. B. info@…">
          <Input
            {...fieldProps(id("email"), errors.email, true)}
            name="email"
            type="email"
            maxLength={200}
            autoComplete="off"
            defaultValue={values.email ?? ""}
          />
        </Field>
      </div>
    </>
  );
}

export function CustomerNumberField({ prefix, value, error }: { prefix: string; value?: string | null; error?: string }) {
  const id = `${prefix}-customerNumber`;
  return (
    <Field label="Kundennummer" htmlFor={id} error={error} optional hint="Wie in der Buchhaltung, z. B. K-1042.">
      <Input
        {...fieldProps(id, error, true)}
        name="customerNumber"
        maxLength={40}
        autoComplete="off"
        defaultValue={value ?? ""}
      />
    </Field>
  );
}

export function InternalNoteField({ prefix, value, error }: { prefix: string; value?: string | null; error?: string }) {
  const id = `${prefix}-internalNote`;
  return (
    <Field
      label="Interne Notiz"
      htmlFor={id}
      error={error}
      optional
      hint="Nur für Hertlin sichtbar, z. B. Vertragsumfang, Zugang zum Serverraum, Besonderheiten."
    >
      <Textarea {...fieldProps(id, error, true)} name="internalNote" rows={4} maxLength={4000} defaultValue={value ?? ""} />
    </Field>
  );
}

/** Zuständiger Hertlin-Standort (Vorgabe für neue Tickets). Ohne Standorte wird nichts angezeigt. */
export function CompanyLocationField({
  options,
  value,
  error,
  parentName,
}: {
  options: LocationOption[];
  value?: string | null;
  error?: string;
  /** Unterkunde: leer = Standort des Firmenkunden */
  parentName?: string | null;
}) {
  return (
    <LocationSelect
      name="locationId"
      options={options}
      defaultValue={value ?? ""}
      error={error}
      label="Zuständiger Standort"
      emptyLabel={parentName ? `Wie ${parentName}` : "Kein bestimmter Standort"}
      hint={
        parentName
          ? `Vorgabe für neue Tickets. Leer = Standort von ${parentName}.`
          : "Vorgabe für neue Tickets dieses Kunden."
      }
    />
  );
}

function filled(...values: (string | null | undefined)[]): boolean {
  return values.some((v) => (v ?? "").trim() !== "");
}

/**
 * Rechnungsdaten: Rechnungs-E-Mail, USt-IdNr., abweichender Empfänger und Anschrift,
 * bei Unterkunden „Eigene Rechnung statt über den Firmenkunden“.
 */
export function BillingFields({
  prefix,
  values,
  errors,
  parentName,
}: {
  prefix: string;
  values: CompanyFieldValues;
  errors: Record<string, string>;
  /** Nur bei Unterkunden: Name des Firmenkunden */
  parentName?: string | null;
}) {
  const id = (name: string) => `${prefix}-${name}`;
  const separate = values.invoiceSeparately === true || values.invoiceSeparately === "on";
  const hasOtherRecipient =
    filled(values.billingName, values.billingStreet, values.billingZip, values.billingCity) ||
    Boolean(errors.billingName || errors.billingStreet || errors.billingZip || errors.billingCity);

  return (
    <>
      {parentName ? (
        <Checkbox
          name="invoiceSeparately"
          defaultChecked={separate}
          label={`Eigene Rechnung statt über ${parentName}`}
          hint={`Positionen dieser Unterkunde werden getrennt abgerechnet. Ohne Haken laufen sie auf der Rechnung an ${parentName}.`}
        />
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Rechnungs-E-Mail"
          htmlFor={id("billingEmail")}
          error={errors.billingEmail}
          optional
          hint="Rechnungen gehen an diese Adresse; leer = E-Mail der Firma."
        >
          <Input
            {...fieldProps(id("billingEmail"), errors.billingEmail, true)}
            name="billingEmail"
            type="email"
            maxLength={200}
            autoComplete="off"
            defaultValue={values.billingEmail ?? ""}
          />
        </Field>
        <Field
          label="USt-IdNr. des Kunden"
          htmlFor={id("vatId")}
          error={errors.vatId}
          optional
          hint="Steht dann auf der Rechnung, z. B. DE123456789."
        >
          <Input
            {...fieldProps(id("vatId"), errors.vatId, true)}
            name="vatId"
            maxLength={20}
            autoComplete="off"
            spellCheck={false}
            defaultValue={values.vatId ?? ""}
            className="uppercase"
          />
        </Field>
      </div>
      <details className="group rounded-xl border border-line px-4 py-3" open={hasOtherRecipient}>
        <summary className="cursor-pointer text-sm font-semibold text-ink">
          Abweichender Rechnungsempfänger oder Rechnungsanschrift
        </summary>
        <div className="mt-4 space-y-5">
          <p className="text-sm text-ink-muted">Nur ausfüllen, wenn die Rechnung nicht an Firmenname und Anschrift oben gehen soll.</p>
          <Field
            label="Name auf der Rechnung"
            htmlFor={id("billingName")}
            error={errors.billingName}
            optional
            hint={parentName ? `Leer = „${parentName}, ${values.name ?? "Unterkunde"}“` : "Leer = Firmenname"}
          >
            <Input
              {...fieldProps(id("billingName"), errors.billingName, true)}
              name="billingName"
              maxLength={160}
              autoComplete="off"
              defaultValue={values.billingName ?? ""}
            />
          </Field>
          <Field label="Straße und Hausnummer (Rechnung)" htmlFor={id("billingStreet")} error={errors.billingStreet} optional>
            <Input
              {...fieldProps(id("billingStreet"), errors.billingStreet)}
              name="billingStreet"
              maxLength={160}
              autoComplete="off"
              defaultValue={values.billingStreet ?? ""}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[9rem_1fr]">
            <Field label="PLZ (Rechnung)" htmlFor={id("billingZip")} error={errors.billingZip} optional>
              <Input
                {...fieldProps(id("billingZip"), errors.billingZip)}
                name="billingZip"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                defaultValue={values.billingZip ?? ""}
              />
            </Field>
            <Field label="Ort (Rechnung)" htmlFor={id("billingCity")} error={errors.billingCity} optional>
              <Input
                {...fieldProps(id("billingCity"), errors.billingCity)}
                name="billingCity"
                maxLength={120}
                autoComplete="off"
                defaultValue={values.billingCity ?? ""}
              />
            </Field>
          </div>
        </div>
      </details>
    </>
  );
}

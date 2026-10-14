"use client";

import { useId, type ReactNode } from "react";
import { Field, Input, Textarea } from "@/components/ui/field";
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
};

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
      className="scroll-mt-24 space-y-5 border-t border-line pt-6 first:border-t-0 first:pt-0"
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

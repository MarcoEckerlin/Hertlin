"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  CompanyAddressFields,
  CustomerNumberField,
  FormSection,
  InternalNoteField,
} from "@/components/admin/companies/company-fields";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { InviteLinkBox } from "@/components/admin/companies/invite-link-box";
import { SlugInput } from "@/components/admin/companies/slug-input";
import { suggestSlug } from "@/components/admin/companies/slug";
import { createCompanyAction } from "@/lib/actions/admin-companies";
import { initialFormState } from "@/lib/forms";

export type CompanyCreateDefaults = {
  name?: string;
  zip?: string;
  city?: string;
  internalNote?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Anfrage, aus der der Kunde entsteht */
  inquiryId?: number;
  inquiryNumber?: string;
};

/**
 * Neuer Firmenkunde mit Subdomain und optional erstem Hauptansprechpartner.
 * notice: Hinweis über dem Formular (z. B. „Anfrage bereits zugeordnet“), nicht über der Erfolgsmeldung.
 */
export function CompanyCreate({
  rootDomain,
  defaults,
  notice,
}: {
  rootDomain: string;
  defaults: CompanyCreateDefaults;
  notice?: ReactNode;
}) {
  // Nach „Weiteren Firmenkunden anlegen“ startet das Formular leer neu
  const [round, setRound] = useState(0);
  return (
    <CompanyCreateForm
      key={round}
      rootDomain={rootDomain}
      defaults={round === 0 ? defaults : {}}
      notice={round === 0 ? notice : null}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function CompanyCreateForm({
  rootDomain,
  defaults,
  notice,
  onAgain,
}: {
  rootDomain: string;
  defaults: CompanyCreateDefaults;
  notice?: ReactNode;
  onAgain: () => void;
}) {
  const [state, formAction] = useActionState(createCompanyAction, initialFormState);
  // Stand beim Öffnen merken: Nach dem Anlegen ist die Anfrage zugeordnet und die Seite liefert keine Vorgaben mehr
  const [fromInquiry] = useState(Boolean(defaults.inquiryId));
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  const [name, setName] = useState(defaults.name ?? "");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const suggestion = suggestSlug(name);
  const slug = slugEdited ? slugInput : suggestion;

  if (state.status === "success" && state.data?.companyId) {
    const data = state.data;
    return (
      <div className="space-y-5">
        <Alert tone="success" title="Firmenkunde angelegt">
          {state.message} Das Kundenportal ist unter <strong>{data.portal}</strong> erreichbar.
        </Alert>
        {data.inviteLink ? <InviteLinkBox link={data.inviteLink} name={data.contactName ?? "den Ansprechpartner"} /> : null}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/admin/kunden/${data.companyId}`}>Zum Kunden</ButtonLink>
          {fromInquiry ? (
            <Link href="/admin/kunden/neu" className={buttonClasses("secondary")}>
              Weiteren Firmenkunden anlegen
            </Link>
          ) : (
            <button type="button" className={buttonClasses("secondary")} onClick={onAgain}>
              Weiteren Firmenkunden anlegen
            </button>
          )}
        </div>
      </div>
    );
  }

  const v = (key: keyof CompanyCreateDefaults & string) => values[key] ?? (defaults[key] as string | undefined) ?? "";

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      {notice}
      {defaults.inquiryId ? <input type="hidden" name="inquiryId" value={defaults.inquiryId} /> : null}
      <FormMessage state={state} />

      <FormSection title="Firma">
        <Field label="Firmenname" htmlFor="company-name" error={errors.name}>
          <Input
            {...fieldProps("company-name", errors.name)}
            name="name"
            required
            maxLength={160}
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
        </Field>
        <CustomerNumberField prefix="company" value={values.customerNumber} error={errors.customerNumber} />
        <CompanyAddressFields
          prefix="company"
          values={{
            street: values.street,
            zip: v("zip"),
            city: v("city"),
            phone: values.phone,
            email: values.email,
          }}
          errors={errors}
        />
      </FormSection>

      <FormSection
        title="Kundenportal"
        description="Unter dieser Adresse melden sich die Mitarbeiter des Kunden an. Kurz und eindeutig halten – meist reicht der Firmenname ohne Rechtsform."
      >
        <SlugInput
          id="company-slug"
          label="Subdomain-Kürzel"
          value={slug}
          onChange={(next) => {
            setSlugEdited(true);
            setSlugInput(next);
          }}
          rootDomain={rootDomain}
          error={errors.slug}
          hint="Wird aus dem Firmennamen vorgeschlagen."
          action={
            slugEdited && suggestion && suggestion !== slug ? (
              <button
                type="button"
                className="text-sm font-semibold text-brand-700 hover:underline"
                onClick={() => setSlugEdited(false)}
              >
                Vorschlag „{suggestion}“ übernehmen
              </button>
            ) : null
          }
        />
      </FormSection>

      <FormSection
        title="Hauptansprechpartner"
        description="Optional. Bekommt eine Einladung per E-Mail, legt sein Passwort selbst fest und kann danach weitere Benutzer und Unterkunden anlegen."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name" htmlFor="contact-name" error={errors.contactName} optional>
            <Input
              {...fieldProps("contact-name", errors.contactName)}
              name="contactName"
              maxLength={120}
              autoComplete="off"
              defaultValue={v("contactName")}
            />
          </Field>
          <Field label="Position" htmlFor="contact-position" error={errors.contactPosition} optional>
            <Input
              {...fieldProps("contact-position", errors.contactPosition)}
              name="contactPosition"
              maxLength={120}
              autoComplete="off"
              placeholder="z. B. Büroleitung"
              defaultValue={values.contactPosition ?? ""}
            />
          </Field>
          <Field
            label="E-Mail-Adresse"
            htmlFor="contact-email"
            error={errors.contactEmail}
            optional
            hint="Damit meldet sich die Person an."
          >
            <Input
              {...fieldProps("contact-email", errors.contactEmail, true)}
              name="contactEmail"
              type="email"
              maxLength={200}
              autoComplete="off"
              defaultValue={v("contactEmail")}
            />
          </Field>
          <Field label="Telefon" htmlFor="contact-phone" error={errors.contactPhone} optional>
            <Input
              {...fieldProps("contact-phone", errors.contactPhone)}
              name="contactPhone"
              type="tel"
              maxLength={40}
              autoComplete="off"
              defaultValue={v("contactPhone")}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Intern">
        <InternalNoteField prefix="company" value={values.internalNote ?? defaults.internalNote} error={errors.internalNote} />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <SubmitButton pendingText="Wird angelegt …">Firmenkunde anlegen</SubmitButton>
        <ButtonLink href={defaults.inquiryId ? `/admin/anfragen/${defaults.inquiryId}` : "/admin/kunden"} variant="ghost">
          Abbrechen
        </ButtonLink>
      </div>
    </form>
  );
}

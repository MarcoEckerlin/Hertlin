"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, FieldError, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormSection } from "@/components/admin/companies/company-fields";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { InviteLinkBox } from "@/components/admin/companies/invite-link-box";
import { createCompanyUserAction, updateCompanyUserAction } from "@/lib/actions/admin-companies";
import { cn } from "@/lib/cn";
import { initialFormState } from "@/lib/forms";

export type CompanyOption = { id: string; name: string; isRoot: boolean; active: boolean };

export type CompanyUserValues = {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  role: "CUSTOMER_ADMIN" | "CUSTOMER_USER";
  companyId: string;
  active: boolean;
};

function roleDescriptions(company: CompanyOption | undefined) {
  return {
    CUSTOMER_ADMIN: company?.isRoot
      ? "Sieht alle Tickets des Kunden inklusive Unterkunden und verwaltet im Portal Benutzer und Unterkunden."
      : `Sieht alle Tickets von ${company?.name ?? "dieser Unterkunde"} und verwaltet deren Benutzer.`,
    CUSTOMER_USER: "Meldet eigene Tickets und sieht nur diese.",
  } as const;
}

const ROLE_OPTIONS = [
  { value: "CUSTOMER_ADMIN", label: "Hauptansprechpartner" },
  { value: "CUSTOMER_USER", label: "Mitarbeiter" },
] as const;

function RoleChoice({ value, company, error }: { value: string; company: CompanyOption | undefined; error?: string }) {
  const descriptions = roleDescriptions(company);
  return (
    <fieldset aria-invalid={error ? true : undefined} aria-describedby={error ? "user-role-error" : undefined}>
      <legend className="mb-1.5 text-sm font-semibold text-ink">Rolle</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {ROLE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-3 rounded-xl border border-line-strong p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-200"
          >
            <input
              type="radio"
              name="role"
              value={option.value}
              defaultChecked={value === option.value}
              className="mt-0.5 size-4 shrink-0 accent-brand-600"
            />
            <span>
              <span className="block text-[0.9375rem] font-semibold text-ink">{option.label}</span>
              <span className="mt-0.5 block text-sm text-ink-muted">{descriptions[option.value]}</span>
            </span>
          </label>
        ))}
      </div>
      <FieldError id="user-role-error">{error}</FieldError>
    </fieldset>
  );
}

function CompanySelect({
  companies,
  defaultValue,
  onChange,
  error,
}: {
  companies: CompanyOption[];
  defaultValue: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const roots = companies.filter((c) => c.isRoot);
  const subs = companies.filter((c) => !c.isRoot);
  return (
    <Field
      label="Firma"
      htmlFor="user-company"
      error={error}
      hint="Tickets dieser Person laufen unter der gewählten Firma. Bisherige Tickets bleiben bei einem Wechsel, wo sie sind."
    >
      <Select
        {...fieldProps("user-company", error, true)}
        name="companyId"
        defaultValue={defaultValue}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        {roots.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.active ? "" : " (deaktiviert)"}
          </option>
        ))}
        {subs.length > 0 ? (
          <optgroup label="Unterkunden">
            {subs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.active ? "" : " (deaktiviert)"}
              </option>
            ))}
          </optgroup>
        ) : null}
      </Select>
    </Field>
  );
}

/* ------------------------------------------------------------------ */

/** Neuer Kundenbenutzer mit Einladung. */
export function CompanyUserCreate({
  rootId,
  companies,
  defaultCompanyId,
  defaultRole,
}: {
  rootId: string;
  companies: CompanyOption[];
  defaultCompanyId: string;
  /** Vorschlag, z. B. Hauptansprechpartner, wenn die Firma noch keinen hat */
  defaultRole: "CUSTOMER_ADMIN" | "CUSTOMER_USER";
}) {
  const [round, setRound] = useState(0);
  return (
    <CompanyUserCreateForm
      key={round}
      rootId={rootId}
      companies={companies}
      defaultCompanyId={defaultCompanyId}
      defaultRole={round === 0 ? defaultRole : "CUSTOMER_USER"}
      onAgain={() => setRound((r) => r + 1)}
    />
  );
}

function CompanyUserCreateForm({
  rootId,
  companies,
  defaultCompanyId,
  defaultRole,
  onAgain,
}: {
  rootId: string;
  companies: CompanyOption[];
  defaultCompanyId: string;
  defaultRole: "CUSTOMER_ADMIN" | "CUSTOMER_USER";
  onAgain: () => void;
}) {
  const [state, formAction] = useActionState(createCompanyUserAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const initialCompanyId = values.companyId ?? defaultCompanyId;
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const company = companies.find((c) => c.id === companyId);

  if (state.status === "success" && state.data?.userId) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title="Benutzer angelegt">
          {state.message}
        </Alert>
        {state.data.inviteLink ? <InviteLinkBox link={state.data.inviteLink} name={state.data.name ?? "die Person"} /> : null}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/admin/kunden/${rootId}#benutzer`}>Zum Kunden</ButtonLink>
          <button type="button" className={buttonClasses("secondary")} onClick={onAgain}>
            Weiteren Benutzer anlegen
          </button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="rootId" value={rootId} />
      <FormMessage state={state} />

      <FormSection title="Person">
        <UserContactFields values={values} errors={errors} />
      </FormSection>

      <FormSection title="Zugang">
        {companies.length > 1 ? (
          <CompanySelect companies={companies} defaultValue={initialCompanyId} onChange={setCompanyId} error={errors.companyId} />
        ) : (
          <input type="hidden" name="companyId" value={initialCompanyId} />
        )}
        <RoleChoice value={values.role ?? defaultRole} company={company} error={errors.role} />
        <p className="text-sm text-ink-muted">
          Die Person bekommt eine Einladung per E-Mail und legt ihr Passwort selbst fest. Den Link sehen Sie nach dem Anlegen auch
          hier.
        </p>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <SubmitButton pendingText="Wird angelegt …">Benutzer anlegen und einladen</SubmitButton>
        <ButtonLink href={`/admin/kunden/${rootId}#benutzer`} variant="ghost">
          Abbrechen
        </ButtonLink>
      </div>
    </form>
  );
}

function UserContactFields({ values, errors }: { values: Partial<Record<string, string>>; errors: Record<string, string> }) {
  return (
    <>
      <Field label="Name" htmlFor="user-name" error={errors.name}>
        <Input
          {...fieldProps("user-name", errors.name)}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={values.name ?? ""}
        />
      </Field>
      <Field
        label="E-Mail-Adresse"
        htmlFor="user-email"
        error={errors.email}
        hint="Damit meldet sich die Person im Kundenportal an."
      >
        <Input
          {...fieldProps("user-email", errors.email, true)}
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={values.email ?? ""}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Telefon" htmlFor="user-phone" error={errors.phone} optional>
          <Input
            {...fieldProps("user-phone", errors.phone)}
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={values.phone ?? ""}
          />
        </Field>
        <Field label="Position" htmlFor="user-position" error={errors.position} optional>
          <Input
            {...fieldProps("user-position", errors.position)}
            name="position"
            maxLength={120}
            autoComplete="off"
            placeholder="z. B. Buchhaltung"
            defaultValue={values.position ?? ""}
          />
        </Field>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Kundenbenutzer bearbeiten: Kontaktdaten, Firma, Rolle, Zugang. */
export function CompanyUserEditForm({
  rootId,
  companies,
  user,
  invited,
}: {
  rootId: string;
  companies: CompanyOption[];
  user: CompanyUserValues;
  invited: boolean;
}) {
  const [state, formAction] = useActionState(updateCompanyUserAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values: Partial<Record<string, string>> = state.values ?? {
    name: user.name,
    email: user.email,
    phone: user.phone,
    position: user.position,
    role: user.role,
  };
  // Gewählte Firma für die Rollenbeschreibung mitführen; nach dem Speichern bzw. einem Fehler neu setzen
  const defaultCompanyId = state.values?.companyId ?? user.companyId;
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [prevDefault, setPrevDefault] = useState(defaultCompanyId);
  if (prevDefault !== defaultCompanyId) {
    setPrevDefault(defaultCompanyId);
    setCompanyId(defaultCompanyId);
  }

  const company = companies.find((c) => c.id === companyId);
  const active = state.values ? state.values.active === "on" : user.active;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="rootId" value={rootId} />
      <FormMessage state={state} />
      {state.status === "success" && state.data?.inviteLink ? (
        <InviteLinkBox link={state.data.inviteLink} name={state.data.name ?? user.name} />
      ) : null}

      <FormSection title="Person">
        <UserContactFields values={values} errors={errors} />
        {invited ? (
          <p className="-mt-2 text-sm text-ink-muted">
            Die Einladung ist noch offen. Ändern Sie die E-Mail-Adresse, geht automatisch eine neue Einladung an die neue Adresse.
          </p>
        ) : null}
      </FormSection>

      <FormSection title="Zugang">
        {companies.length > 1 ? (
          <CompanySelect companies={companies} defaultValue={defaultCompanyId} onChange={setCompanyId} error={errors.companyId} />
        ) : (
          <input type="hidden" name="companyId" value={defaultCompanyId} />
        )}
        <RoleChoice value={values.role ?? user.role} company={company} error={errors.role} />
        <div className={cn("rounded-xl border p-4", active ? "border-line" : "border-amber-200 bg-amber-50/60")}>
          <Checkbox
            id="user-active"
            name="active"
            defaultChecked={active}
            label="Zugang aktiv"
            hint="Ohne Haken kann sich die Person nicht mehr anmelden und wird sofort abgemeldet. Ihre Tickets bleiben erhalten."
          />
        </div>
      </FormSection>

      <div className="border-t border-line pt-6">
        <SubmitButton pendingText="Wird gespeichert …">Änderungen speichern</SubmitButton>
      </div>
    </form>
  );
}

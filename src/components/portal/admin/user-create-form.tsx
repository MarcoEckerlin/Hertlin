"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { createPortalUserAction } from "@/lib/actions/portal-admin";
import { initialFormState } from "@/lib/forms";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldProps } from "@/components/portal/admin/field-props";
import { InviteLinkBox } from "@/components/portal/admin/invite-link-box";
import { RoleChoice, adminRoleDescription } from "@/components/portal/admin/role-choice";
import { useFormFocus } from "@/components/portal/admin/use-form-focus";
import type { CompanyOption, PortalRole } from "@/components/portal/admin/types";
import { useFormKey } from "@/lib/use-form-key";

type Props = {
  /** Auswählbare Firmen (nur aktive). Bei genau einer Firma wird sie fest angezeigt. */
  companies: CompanyOption[];
  defaultCompanyId: string;
  /** Hauptansprechpartner einer Unterkunde: Firma steht fest */
  isRootAdmin: boolean;
  backHref: string;
  backLabel: string;
};

/**
 * Neuen Benutzer anlegen. Nach dem Speichern zeigt das Formular die Bestätigung samt Einladungslink.
 * „Weiteren Benutzer anlegen“ setzt das Formular über einen neuen key komplett zurück.
 */
export function UserCreatePanel(props: Props) {
  const [round, setRound] = useState(0);
  return <UserCreateForm key={round} {...props} onAnother={() => setRound((r) => r + 1)} />;
}

function UserCreateForm({
  companies,
  defaultCompanyId,
  isRootAdmin,
  backHref,
  backLabel,
  onAnother,
}: Props & { onAnother: () => void }) {
  const [state, formAction] = useActionState(createPortalUserAction, initialFormState);
  const formRef = useFormFocus(state);
  const formKey = useFormKey(state);
  const successRef = useRef<HTMLDivElement>(null);
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === "success") successRef.current?.focus();
  }, [state]);

  if (state.status === "success" && state.data?.inviteLink) {
    const { inviteLink, userId, name = "", email = "", companyName } = state.data;
    return (
      <div ref={successRef} tabIndex={-1} className="space-y-5 focus:outline-none">
        <Alert tone="success" title={`${name} ist angelegt${companyName ? ` (${companyName})` : ""}`}>
          Die Einladung ist an <strong className="font-semibold">{email}</strong> unterwegs. Über den Link darin legt{" "}
          {name} ein eigenes Passwort fest und ist danach direkt im Kundenportal angemeldet.
        </Alert>
        <InviteLinkBox link={inviteLink} name={name} />
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onAnother}>Weiteren Benutzer anlegen</Button>
          {userId ? (
            <ButtonLink href={`/benutzer/${userId}`} variant="secondary">
              Zum Benutzer
            </ButtonLink>
          ) : null}
          <ButtonLink href={backHref} variant="ghost">
            {backLabel}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const selected = companies.find((c) => c.id === companyId) ?? companies[0];
  const roots = companies.filter((c) => c.isRoot);
  const subs = companies.filter((c) => !c.isRoot);
  const role = (state.values?.role as PortalRole | undefined) ?? "CUSTOMER_USER";

  // Nach einem Fehler neu aufbauen: Die Firmenauswahl springt sonst beim Zurücksetzen auf die vorgeschlagene Firma,
  // während Rollenhinweis und Auswahl im State noch die gewählte Unterkunde meinen.
  return (
    <form key={formKey} ref={formRef} action={formAction} noValidate className="@container space-y-5">
      <FormMessage state={state} />

      <Field label="Name" htmlFor="user-name" error={errors.name}>
        <Input
          {...fieldProps("user-name", errors.name)}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          placeholder="Vor- und Nachname"
          defaultValue={state.values?.name}
        />
      </Field>

      <Field
        label="E-Mail-Adresse"
        htmlFor="user-email"
        error={errors.email}
        hint="Dorthin schicken wir die Einladung. Mit dieser Adresse meldet sich die Person später an."
      >
        <Input
          {...fieldProps("user-email", errors.email, true)}
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={state.values?.email}
        />
      </Field>

      <div className="grid gap-5 @lg:grid-cols-2">
        <Field
          label="Telefon"
          htmlFor="user-phone"
          error={errors.phone}
          optional
          hint="Für Rückfragen unserer Techniker."
        >
          <Input
            {...fieldProps("user-phone", errors.phone, true)}
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={state.values?.phone}
          />
        </Field>
        <Field label="Position" htmlFor="user-position" error={errors.position} optional hint="z. B. Buchhaltung, Empfang">
          <Input
            {...fieldProps("user-position", errors.position, true)}
            name="position"
            maxLength={120}
            autoComplete="off"
            defaultValue={state.values?.position}
          />
        </Field>
      </div>

      {companies.length > 1 ? (
        <Field
          label="Firma oder Unterkunde"
          htmlFor="user-company"
          error={errors.companyId}
          hint="Bestimmt, zu welchem Standort die Tickets dieser Person gehören."
        >
          <Select
            {...fieldProps("user-company", errors.companyId, true)}
            name="companyId"
            defaultValue={state.values?.companyId ?? defaultCompanyId}
            onChange={(e) => setCompanyId(e.currentTarget.value)}
          >
            {roots.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {subs.length > 0 ? (
              <optgroup label="Unterkunden">
                {subs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Field>
      ) : selected ? (
        <div>
          <p className="text-sm font-semibold text-ink">Firma</p>
          <p className="mt-1.5 rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[0.9375rem] text-ink">
            {selected.name}
          </p>
          {errors.companyId ? (
            <p className="mt-1.5 text-sm font-medium text-red-700">{errors.companyId}</p>
          ) : (
            <p className="mt-1.5 text-sm text-ink-muted">
              {isRootAdmin ? (
                <>
                  Für Filialen, Standorte oder Abteilungen können Sie unter{" "}
                  <Link href="/unterkunden" className="font-semibold text-brand-700 hover:underline">
                    Unterkunden
                  </Link>{" "}
                  eigene Bereiche anlegen.
                </>
              ) : (
                `Sie legen Benutzer für ${selected.name} an.`
              )}
            </p>
          )}
          {isRootAdmin ? <input type="hidden" name="companyId" value={selected.id} /> : null}
        </div>
      ) : null}

      <RoleChoice
        defaultValue={role === "CUSTOMER_ADMIN" ? "CUSTOMER_ADMIN" : "CUSTOMER_USER"}
        adminDescription={adminRoleDescription({ isRoot: selected?.isRoot ?? false, companyName: selected?.name })}
        error={errors.role}
        hint="Im Zweifel „Mitarbeiter“ wählen. Die Rolle können Sie später jederzeit ändern."
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <SubmitButton pendingText="Wird angelegt …">Benutzer anlegen und einladen</SubmitButton>
        <Link href={backHref} className={buttonClasses("ghost")}>
          Abbrechen
        </Link>
      </div>
    </form>
  );
}

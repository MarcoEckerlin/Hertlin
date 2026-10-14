"use client";

import { useActionState, useState } from "react";
import { updatePortalUserAction } from "@/lib/actions/portal-admin";
import { initialFormState } from "@/lib/forms";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldProps } from "@/components/portal/admin/field-props";
import { InviteLinkBox } from "@/components/portal/admin/invite-link-box";
import { RoleChoice, adminRoleDescription } from "@/components/portal/admin/role-choice";
import { useFormFocus } from "@/components/portal/admin/use-form-focus";
import type { CompanyOption, PortalRole, PortalUserFormValues } from "@/components/portal/admin/types";

/** Benutzer bearbeiten: Kontaktdaten, Rolle, Zuordnung und Zugang. */
export function UserEditForm({
  user,
  invited,
  companies,
  canChangeCompany,
  isSelf,
}: {
  user: PortalUserFormValues;
  invited: boolean;
  /** Aktive Firmen im Bereich plus die aktuelle Firma des Benutzers */
  companies: CompanyOption[];
  canChangeCompany: boolean;
  isSelf: boolean;
}) {
  const [state, formAction] = useActionState(updatePortalUserAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values = state.values;
  const [companyId, setCompanyId] = useState(user.companyId);

  // Nach dem Speichern kann sich die Firma geändert haben (neue Daten vom Server)
  const [prevCompanyId, setPrevCompanyId] = useState(user.companyId);
  if (prevCompanyId !== user.companyId) {
    setPrevCompanyId(user.companyId);
    setCompanyId(user.companyId);
  }

  const current = companies.find((c) => c.id === user.companyId);
  const selected = companies.find((c) => c.id === companyId) ?? current;
  const roots = companies.filter((c) => c.isRoot);
  const subs = companies.filter((c) => !c.isRoot);
  const role = ((values?.role as PortalRole | undefined) ?? user.role) === "CUSTOMER_ADMIN" ? "CUSTOMER_ADMIN" : "CUSTOMER_USER";
  const active = isSelf ? true : values ? values.active === "on" : user.active;

  return (
    <form ref={formRef} action={formAction} noValidate className="@container space-y-5">
      <input type="hidden" name="id" value={user.id} />
      <FormMessage state={state} />
      {state.status === "success" && state.data?.inviteLink ? (
        <InviteLinkBox link={state.data.inviteLink} name={values?.name ?? user.name} />
      ) : null}

      <Field label="Name" htmlFor="edit-name" error={errors.name}>
        <Input
          {...fieldProps("edit-name", errors.name)}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={values?.name ?? user.name}
        />
      </Field>

      <Field
        label="E-Mail-Adresse"
        htmlFor="edit-email"
        error={errors.email}
        hint={
          invited
            ? "Wenn Sie die Adresse ändern, schicken wir die Einladung an die neue Adresse. Der alte Link verfällt."
            : "Mit dieser Adresse meldet sich die Person an. Eine Änderung gilt sofort, das Passwort bleibt gleich."
        }
      >
        <Input
          {...fieldProps("edit-email", errors.email, true)}
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="off"
          defaultValue={values?.email ?? user.email}
        />
      </Field>

      <div className="grid gap-5 @lg:grid-cols-2">
        <Field label="Telefon" htmlFor="edit-phone" error={errors.phone} optional>
          <Input
            {...fieldProps("edit-phone", errors.phone)}
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="off"
            defaultValue={values?.phone ?? user.phone}
          />
        </Field>
        <Field label="Position" htmlFor="edit-position" error={errors.position} optional>
          <Input
            {...fieldProps("edit-position", errors.position)}
            name="position"
            maxLength={120}
            autoComplete="off"
            defaultValue={values?.position ?? user.position}
          />
        </Field>
      </div>

      {canChangeCompany && companies.length > 1 ? (
        <Field
          label="Firma oder Unterkunde"
          htmlFor="edit-company"
          error={errors.companyId}
          hint="Neue Tickets laufen dann unter der neuen Zuordnung. Bisherige Tickets bleiben, wo sie sind."
        >
          <Select
            {...fieldProps("edit-company", errors.companyId, true)}
            name="companyId"
            defaultValue={values?.companyId ?? user.companyId}
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
                    {c.active ? "" : " (deaktiviert)"}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </Field>
      ) : current ? (
        <div>
          <p className="text-sm font-semibold text-ink">Firma</p>
          <p className="mt-1.5 rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[0.9375rem] text-ink">
            {current.name}
          </p>
          {isSelf && canChangeCompany === false && companies.length > 1 ? (
            <p className="mt-1.5 text-sm text-ink-muted">Ihre eigene Zuordnung können Sie nicht ändern.</p>
          ) : null}
        </div>
      ) : null}

      <RoleChoice
        defaultValue={role}
        adminDescription={adminRoleDescription({ isRoot: selected?.isRoot ?? false, companyName: selected?.name })}
        disabled={isSelf}
        error={errors.role}
        hint={isSelf ? "Ihre eigene Rolle können Sie nicht ändern. Bitten Sie dazu einen anderen Hauptansprechpartner." : undefined}
      />

      <div className="rounded-xl border border-line p-4">
        <Checkbox
          id="edit-active"
          name="active"
          defaultChecked={active}
          disabled={isSelf}
          label="Zugang aktiv"
          hint={
            isSelf
              ? "Ihr eigenes Konto können Sie nicht deaktivieren."
              : "Ohne Haken kann sich die Person nicht mehr anmelden und wird sofort abgemeldet. Ihre Tickets bleiben erhalten."
          }
        />
      </div>

      <div className="border-t border-line pt-5">
        <SubmitButton pendingText="Wird gespeichert …">Änderungen speichern</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createSubCustomerAction, updateSubCustomerAction } from "@/lib/actions/portal-admin";
import { initialFormState } from "@/lib/forms";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormFocus } from "@/components/portal/admin/use-form-focus";
import { fieldProps } from "@/components/portal/admin/field-props";
import type { SubCustomerFormValues } from "@/components/portal/admin/types";

type Props =
  | { mode: "create"; cancelHref: string }
  | { mode: "edit"; id: string; initial: SubCustomerFormValues };

/** Stammdaten einer Unterkunde anlegen oder bearbeiten. */
export function SubCustomerForm(props: Props) {
  const [state, formAction] = useActionState(
    props.mode === "create" ? createSubCustomerAction : updateSubCustomerAction,
    initialFormState,
  );
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const value = (key: keyof SubCustomerFormValues) =>
    state.values?.[key] ?? (props.mode === "edit" ? props.initial[key] : "");
  const prefix = props.mode === "create" ? "sc-new" : "sc-edit";

  return (
    <form ref={formRef} action={formAction} noValidate className="@container space-y-5">
      {props.mode === "edit" ? <input type="hidden" name="id" value={props.id} /> : null}
      <FormMessage state={state} />

      <Field
        label="Name der Unterkunde"
        htmlFor={`${prefix}-name`}
        error={errors.name}
        hint="So erscheint sie in Tickets und Listen, z. B. „Filiale Ulm“, „Labor“ oder „Homeoffice Vertrieb“."
      >
        <Input
          {...fieldProps(`${prefix}-name`, errors.name, true)}
          name="name"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={value("name")}
        />
      </Field>

      <div className="space-y-5 border-t border-line pt-5">
        <div>
          <h3 className="text-sm font-bold text-ink">Anschrift und Kontakt</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            Freiwillig. Die Anschrift hilft unseren Technikern bei Terminen vor Ort.
          </p>
        </div>

        <Field label="Straße und Hausnummer" htmlFor={`${prefix}-street`} error={errors.street} optional>
          <Input
            {...fieldProps(`${prefix}-street`, errors.street)}
            name="street"
            maxLength={160}
            autoComplete="off"
            defaultValue={value("street")}
          />
        </Field>

        <div className="grid gap-5 @sm:grid-cols-[8rem_minmax(0,1fr)]">
          <Field label="PLZ" htmlFor={`${prefix}-zip`} error={errors.zip} optional>
            <Input
              {...fieldProps(`${prefix}-zip`, errors.zip)}
              name="zip"
              inputMode="numeric"
              maxLength={10}
              autoComplete="off"
              defaultValue={value("zip")}
            />
          </Field>
          <Field label="Ort" htmlFor={`${prefix}-city`} error={errors.city} optional>
            <Input
              {...fieldProps(`${prefix}-city`, errors.city)}
              name="city"
              maxLength={120}
              autoComplete="off"
              defaultValue={value("city")}
            />
          </Field>
        </div>

        <div className="grid gap-5 @lg:grid-cols-2">
          <Field label="Telefon" htmlFor={`${prefix}-phone`} error={errors.phone} optional>
            <Input
              {...fieldProps(`${prefix}-phone`, errors.phone)}
              name="phone"
              type="tel"
              maxLength={40}
              autoComplete="off"
              defaultValue={value("phone")}
            />
          </Field>
          <Field label="E-Mail-Adresse" htmlFor={`${prefix}-email`} error={errors.email} optional>
            <Input
              {...fieldProps(`${prefix}-email`, errors.email)}
              name="email"
              type="email"
              maxLength={200}
              autoComplete="off"
              defaultValue={value("email")}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <SubmitButton pendingText={props.mode === "create" ? "Wird angelegt …" : "Wird gespeichert …"}>
          {props.mode === "create" ? "Unterkunde anlegen" : "Änderungen speichern"}
        </SubmitButton>
        {props.mode === "create" ? (
          <Link href={props.cancelHref} className={buttonClasses("ghost")}>
            Abbrechen
          </Link>
        ) : null}
      </div>
    </form>
  );
}

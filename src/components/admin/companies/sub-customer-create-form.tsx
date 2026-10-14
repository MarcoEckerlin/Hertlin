"use client";

import { useActionState } from "react";
import { ButtonLink } from "@/components/ui/button";
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
import { createSubCustomerAction } from "@/lib/actions/admin-companies";
import { initialFormState } from "@/lib/forms";

/** Neue Unterkunde unter einem Firmenkunden. */
export function SubCustomerCreateForm({ parentId }: { parentId: string }) {
  const [state, formAction] = useActionState(createSubCustomerAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="parentId" value={parentId} />
      <FormMessage state={state} />

      <FormSection title="Unterkunde">
        <Field
          label="Name"
          htmlFor="sub-name"
          error={errors.name}
          hint="z. B. Standort, Tochterfirma oder Abteilung: „Filiale Ulm“, „Praxis Nord“."
        >
          <Input
            {...fieldProps("sub-name", errors.name, true)}
            name="name"
            required
            maxLength={160}
            autoComplete="off"
            defaultValue={values.name ?? ""}
          />
        </Field>
        <CustomerNumberField prefix="sub" value={values.customerNumber} error={errors.customerNumber} />
        <CompanyAddressFields prefix="sub" values={values} errors={errors} />
      </FormSection>

      <FormSection title="Intern">
        <InternalNoteField prefix="sub" value={values.internalNote} error={errors.internalNote} />
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <SubmitButton pendingText="Wird angelegt …">Unterkunde anlegen</SubmitButton>
        <ButtonLink href={`/admin/kunden/${parentId}`} variant="ghost">
          Abbrechen
        </ButtonLink>
      </div>
    </form>
  );
}

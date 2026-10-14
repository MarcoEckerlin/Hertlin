"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  CompanyAddressFields,
  CustomerNumberField,
  FormSection,
  InternalNoteField,
  type CompanyFieldValues,
} from "@/components/admin/companies/company-fields";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { updateCompanyAction } from "@/lib/actions/admin-companies";
import { initialFormState } from "@/lib/forms";

/** Stammdaten eines Firmenkunden oder einer Unterkunde bearbeiten. */
export function CompanyEditForm({ company, isSub }: { company: CompanyFieldValues & { id: string; name: string }; isSub: boolean }) {
  const [state, formAction] = useActionState(updateCompanyAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values: CompanyFieldValues = state.values ?? company;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <input type="hidden" name="id" value={company.id} />
      <FormMessage state={state} />

      <FormSection title={isSub ? "Unterkunde" : "Firma"}>
        <Field
          label={isSub ? "Name der Unterkunde" : "Firmenname"}
          htmlFor="edit-name"
          error={errors.name}
          hint={isSub ? "Muss innerhalb des Firmenkunden eindeutig sein, z. B. „Filiale Ulm“." : undefined}
        >
          <Input
            {...fieldProps("edit-name", errors.name, isSub)}
            name="name"
            required
            maxLength={160}
            autoComplete="off"
            defaultValue={values.name ?? ""}
          />
        </Field>
        <CustomerNumberField prefix="edit" value={values.customerNumber} error={errors.customerNumber} />
        <CompanyAddressFields prefix="edit" values={values} errors={errors} />
      </FormSection>

      <FormSection title="Intern" id="notiz">
        <InternalNoteField prefix="edit" value={values.internalNote} error={errors.internalNote} />
      </FormSection>

      <div className="border-t border-line pt-6">
        <SubmitButton pendingText="Wird gespeichert …">Stammdaten speichern</SubmitButton>
      </div>
    </form>
  );
}

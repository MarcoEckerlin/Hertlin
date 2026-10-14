"use client";

import { useActionState } from "react";
import { Checkbox, FieldError } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { deleteInquiryAction } from "@/lib/actions/admin-inquiries";
import { initialFormState } from "@/lib/forms";

/** Anfrage endgültig löschen – mit Bestätigung (nur Administratoren). */
export function InquiryDeleteForm({ id, number }: { id: number; number: string }) {
  const [state, formAction] = useActionState(deleteInquiryAction, initialFormState);
  const confirmError = state.fieldErrors?.confirm;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <div>
        <Checkbox
          name="confirm"
          id="inquiry-delete-confirm"
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={confirmError ? "inquiry-delete-confirm-error" : undefined}
          label={`Anfrage ${number} mit allen Angaben endgültig löschen`}
        />
        <FieldError id="inquiry-delete-confirm-error">{confirmError}</FieldError>
      </div>
      <SubmitButton variant="danger" pendingText="Wird gelöscht …">
        Anfrage löschen
      </SubmitButton>
    </form>
  );
}

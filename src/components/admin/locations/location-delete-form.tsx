"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { FormMessage } from "@/components/ui/form-message";
import { ConfirmSubmitButton } from "@/components/admin/tickets/confirm-submit-button";
import { deleteLocationAction } from "@/lib/actions/admin-locations";
import { initialFormState, type FormState } from "@/lib/forms";

/** Standort löschen (nur ohne Zuordnungen; die Prüfung macht der Server). */
export function LocationDeleteForm({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(deleteLocationAction, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <ConfirmSubmitButton
        variant="danger"
        size="sm"
        pendingText="Wird gelöscht …"
        confirmText={`Standort „${name}“ endgültig löschen?`}
      >
        <Trash2 className="size-4" aria-hidden />
        Standort löschen
      </ConfirmSubmitButton>
    </form>
  );
}

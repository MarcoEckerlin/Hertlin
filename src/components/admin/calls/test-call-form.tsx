"use client";

import { useActionState } from "react";
import { PhoneCall } from "lucide-react";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/forms";

/** „Testanruf simulieren“: prüft die Live-Anzeige ohne echte Telefonanlage. */
export function TestCallForm({ action }: { action: (prev: FormState) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Testanruf wird gemeldet …">
        <PhoneCall className="size-4" aria-hidden />
        Testanruf simulieren
      </SubmitButton>
    </form>
  );
}

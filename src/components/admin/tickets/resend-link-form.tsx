"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { resendGuestLinkAction } from "@/lib/actions/admin-tickets";
import { initialFormState } from "@/lib/forms";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

/** „Status-Link erneut senden“ für Privatkunden. */
export function ResendLinkForm({ ticketId }: { ticketId: number }) {
  const [state, action] = useActionState(resendGuestLinkAction, initialFormState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <SubmitButton variant="secondary" size="sm" pendingText="Wird gesendet …">
        <Send className="size-3.5" aria-hidden />
        Status-Link erneut senden
      </SubmitButton>
      <FormMessage state={state} className="text-xs" />
    </form>
  );
}

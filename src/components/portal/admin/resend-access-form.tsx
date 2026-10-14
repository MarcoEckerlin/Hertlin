"use client";

import { useActionState } from "react";
import { resendInviteAction } from "@/lib/actions/portal-admin";
import { initialFormState } from "@/lib/forms";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { InviteLinkBox } from "@/components/portal/admin/invite-link-box";

/**
 * Einladung erneut senden (noch kein Passwort) bzw. Link zum Zurücksetzen des Passworts schicken.
 * Den Link selbst zeigen wir nur bei offenen Einladungen an.
 */
export function ResendAccessForm({ userId, name, invited }: { userId: string; name: string; invited: boolean }) {
  const [state, formAction] = useActionState(resendInviteAction, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={userId} />
      <FormMessage state={state} />
      {state.status === "success" && state.data?.inviteLink ? <InviteLinkBox link={state.data.inviteLink} name={name} /> : null}
      <SubmitButton variant="secondary" pendingText="Wird gesendet …" className="w-full sm:w-auto lg:w-full">
        {invited ? "Einladung erneut senden" : "Link für neues Passwort senden"}
      </SubmitButton>
    </form>
  );
}

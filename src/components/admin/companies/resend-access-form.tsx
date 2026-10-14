"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { InviteLinkBox } from "@/components/admin/companies/invite-link-box";
import type { FormState } from "@/lib/forms";
import { initialFormState } from "@/lib/forms";

/**
 * Zugang erneut zusenden: offene Einladung → neue Einladung, sonst Link zum Zurücksetzen des Passworts.
 * Der neue Link wird nach dem Senden zum Kopieren angezeigt.
 */
export function ResendAccessForm({
  action,
  hidden,
  invited,
  name,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  hidden: Record<string, string>;
  invited: boolean;
  name: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(hidden).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <FormMessage state={state} />
      {state.status === "success" && state.data?.inviteLink ? (
        <InviteLinkBox
          link={state.data.inviteLink}
          name={state.data.name ?? name}
          purpose={state.data.purpose === "reset" ? "reset" : "invite"}
        />
      ) : null}
      <SubmitButton variant="secondary" size="sm" pendingText="Wird gesendet …">
        {invited ? "Einladung erneut senden" : "Link zum Zurücksetzen senden"}
      </SubmitButton>
    </form>
  );
}

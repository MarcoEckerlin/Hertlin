"use client";

import { useActionState } from "react";
import { Checkbox, FieldError } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { setCompanyActiveAction } from "@/lib/actions/admin-companies";
import { initialFormState } from "@/lib/forms";

/** Firmenkunde bzw. Unterkunde sperren oder wieder freigeben. */
export function CompanyStatusForm({
  companyId,
  name,
  active,
  isSub,
  userCount,
  parentInactive,
}: {
  companyId: string;
  name: string;
  active: boolean;
  isSub: boolean;
  userCount: number;
  /** Unterkunde eines deaktivierten Firmenkunden */
  parentInactive?: boolean;
}) {
  const [state, formAction] = useActionState(setCompanyActiveAction, initialFormState);
  const confirmError = state.fieldErrors?.confirm;

  return (
    <form action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="id" value={companyId} />
      <input type="hidden" name="intent" value={active ? "deactivate" : "activate"} />
      <FormMessage state={state} />

      {active ? (
        <>
          <p className="text-sm leading-relaxed text-ink-soft">
            {isSub
              ? `Die Benutzer von ${name} können sich danach nicht mehr anmelden, wer gerade angemeldet ist, wird abgemeldet.`
              : "Das Kundenportal wird gesperrt. Kein Benutzer des Kunden und seiner Unterkunden kann sich mehr anmelden, wer gerade angemeldet ist, wird abgemeldet."}
            {userCount > 0 ? ` Betroffen: ${userCount === 1 ? "1 Benutzer" : `${userCount} Benutzer`}.` : ""} Tickets, Kosten und
            Benutzerkonten bleiben erhalten.
          </p>
          <div>
            <Checkbox
              id="status-confirm"
              name="confirm"
              aria-invalid={confirmError ? true : undefined}
              aria-describedby={confirmError ? "status-confirm-error" : undefined}
              label={`${name} deaktivieren`}
            />
            <FieldError id="status-confirm-error">{confirmError}</FieldError>
          </div>
          <SubmitButton variant="danger" pendingText="Wird deaktiviert …">
            Deaktivieren
          </SubmitButton>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-ink-soft">
            {isSub
              ? parentInactive
                ? "Der Firmenkunde ist ebenfalls deaktiviert. Solange er gesperrt ist, kann sich auch hier niemand anmelden."
                : "Nach dem Aktivieren können sich die Benutzer wieder wie gewohnt anmelden."
              : "Nach dem Aktivieren ist das Kundenportal wieder erreichbar. Benutzer, die einzeln deaktiviert wurden, bleiben gesperrt."}
          </p>
          <SubmitButton variant="secondary" pendingText="Wird aktiviert …">
            Wieder aktivieren
          </SubmitButton>
        </>
      )}
    </form>
  );
}

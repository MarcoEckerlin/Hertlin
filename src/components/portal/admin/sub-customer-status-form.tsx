"use client";

import { useActionState, useEffect, useState } from "react";
import { toggleSubCustomerActiveAction } from "@/lib/actions/portal-admin";
import { initialFormState } from "@/lib/forms";
import { Checkbox, FieldError } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { showToast } from "@/components/ui/toaster";

/**
 * Unterkunde deaktivieren (mit Bestätigung) oder wieder aktivieren.
 * Löschen gibt es bewusst nicht, damit alte Tickets ihrer Unterkunde zugeordnet bleiben.
 */
export function SubCustomerStatusForm({
  id,
  name,
  active,
  userCount,
}: {
  id: string;
  name: string;
  active: boolean;
  userCount: number;
}) {
  const [state, formAction] = useActionState(toggleSubCustomerActiveAction, initialFormState);
  const [confirmed, setConfirmed] = useState(false);

  // Erfolg als kurze Meldung: Der Abschnitt klappt nach dem Aktivieren zu, ein Kasten darin wäre nicht zu sehen
  useEffect(() => {
    if (state.status === "success" && state.message) showToast(state.message);
  }, [state]);

  // Nach einem Wechsel des Status die Bestätigung zurücksetzen
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setConfirmed(false);
  }

  const effect =
    userCount === 0
      ? "Solange sie deaktiviert ist, kann sich dort niemand anmelden."
      : userCount === 1
        ? "Der Benutzer dieser Unterkunde wird sofort abgemeldet und kann sich nicht mehr anmelden."
        : `Alle ${userCount} Benutzer dieser Unterkunde werden sofort abgemeldet und können sich nicht mehr anmelden.`;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="intent" value={active ? "deactivate" : "activate"} />
      {state.status === "error" ? <FormMessage state={state} /> : null}

      {active ? (
        <>
          <div className="space-y-2 text-sm leading-relaxed text-ink-soft">
            <p>
              Sinnvoll, wenn ein Standort schließt oder eine Abteilung aufgelöst wird. {effect}
              {userCount > 0 ? " Offene Einladungen verfallen." : null}
            </p>
            <p>
              Die Tickets von {name} bleiben erhalten und Sie sehen sie weiterhin. Sie können die Unterkunde jederzeit
              wieder aktivieren.
            </p>
          </div>
          <div>
            <Checkbox
              id={`confirm-${id}`}
              name="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.currentTarget.checked)}
              aria-invalid={state.fieldErrors?.confirm ? true : undefined}
              aria-describedby={state.fieldErrors?.confirm ? `confirm-${id}-error` : undefined}
              label="Ich verstehe, dass sich die Benutzer dieser Unterkunde danach nicht mehr anmelden können."
            />
            <FieldError id={`confirm-${id}-error`}>{state.fieldErrors?.confirm}</FieldError>
          </div>
          <SubmitButton variant="danger" disabled={!confirmed} pendingText="Wird deaktiviert …">
            Unterkunde deaktivieren
          </SubmitButton>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-ink-soft">
            Nach dem Aktivieren können sich alle aktiven Benutzer von {name} wieder mit ihrem bisherigen Passwort
            anmelden. Einladungen, die beim Deaktivieren noch offen waren, senden Sie bitte neu.
          </p>
          <SubmitButton pendingText="Wird aktiviert …">Unterkunde wieder aktivieren</SubmitButton>
        </>
      )}
    </form>
  );
}

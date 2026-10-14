"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Checkbox, FieldError } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { useFormFocus } from "@/components/admin/companies/form-helpers";
import { SlugInput } from "@/components/admin/companies/slug-input";
import { changeCompanySlugAction } from "@/lib/actions/admin-companies";
import { initialFormState } from "@/lib/forms";

/** Subdomain eines Firmenkunden ändern – mit deutlicher Warnung. */
export function SlugChangeForm({
  companyId,
  currentSlug,
  rootDomain,
  activeUsers,
}: {
  companyId: string;
  currentSlug: string;
  rootDomain: string;
  activeUsers: number;
}) {
  const [state, formAction] = useActionState(changeCompanySlugAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const [slug, setSlug] = useState(state.values?.slug ?? currentSlug);

  // Nach dem Speichern zeigt das Feld die neue Adresse
  const [prevSlug, setPrevSlug] = useState(currentSlug);
  if (prevSlug !== currentSlug) {
    setPrevSlug(currentSlug);
    setSlug(currentSlug);
  }

  const changed = slug !== currentSlug;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-5">
      <input type="hidden" name="id" value={companyId} />
      <FormMessage state={state} />

      <SlugInput id="slug-new" label="Kürzel" value={slug} onChange={setSlug} rootDomain={rootDomain} error={errors.slug} />

      {changed ? (
        <Alert tone="warning" title={`${currentSlug}.${rootDomain} funktioniert danach nicht mehr`}>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              Alle Benutzer des Kunden{activeUsers > 0 ? ` (${activeUsers})` : ""} werden abgemeldet und melden sich unter der
              neuen Adresse wieder an. Passwörter bleiben gleich.
            </li>
            <li>Lesezeichen, Verknüpfungen und Links in alten E-Mails führen ins Leere.</li>
            <li>Offene Einladungslinks zeigen noch auf die alte Adresse – senden Sie diese Einladungen danach neu.</li>
          </ul>
        </Alert>
      ) : null}

      {changed ? (
        <div>
          <Checkbox
            id="slug-confirm"
            name="confirm"
            aria-invalid={errors.confirm ? true : undefined}
            aria-describedby={errors.confirm ? "slug-confirm-error" : undefined}
            label="Ich habe den Kunden informiert bzw. werde es tun."
          />
          <FieldError id="slug-confirm-error">{errors.confirm}</FieldError>
        </div>
      ) : null}

      <SubmitButton variant="secondary" disabled={!changed} pendingText="Wird geändert …">
        Adresse ändern
      </SubmitButton>
    </form>
  );
}

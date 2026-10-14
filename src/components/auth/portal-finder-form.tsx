"use client";

import { useActionState } from "react";
import { findPortalAction } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/forms";
import { Label } from "@/components/ui/field";
import { FieldError } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

export function PortalFinderForm({ rootDomain }: { rootDomain: string }) {
  const [state, action] = useActionState(findPortalAction, initialFormState);
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <div>
        <Label htmlFor="slug">Adresse Ihres Kundenportals</Label>
        <div className="mt-1.5 flex h-11 items-center rounded-xl border border-line-strong bg-white focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-200/70">
          <input
            id="slug"
            name="slug"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ihrefirma"
            defaultValue={state.values?.slug}
            aria-invalid={!!state.fieldErrors?.slug}
            aria-describedby="slug-suffix"
            className="h-full min-w-0 flex-1 rounded-l-xl bg-transparent px-3.5 text-right text-[0.9375rem] text-ink placeholder:text-ink-muted/70 focus:outline-none"
          />
          <span id="slug-suffix" className="pr-3.5 text-[0.9375rem] text-ink-muted">
            .{rootDomain}
          </span>
        </div>
        <FieldError>{state.fieldErrors?.slug}</FieldError>
      </div>
      <SubmitButton className="w-full" pendingText="Portal wird gesucht …">
        Weiter zur Anmeldung
      </SubmitButton>
    </form>
  );
}

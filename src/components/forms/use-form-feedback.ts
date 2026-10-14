"use client";

import { useEffect, useRef } from "react";
import type { FormState } from "@/lib/forms";
import { useFormKey } from "@/lib/use-form-key";

/**
 * Lenkt nach dem Absenden den Blick dorthin, wo es weitergeht:
 * - bei Fehlern auf das erste markierte Feld (oder die Fehlermeldung),
 * - bei Erfolg auf die Bestätigung, die das Formular ersetzt.
 * Wichtig bei langen Formularen auf dem Handy, wo der Absende-Button weit unten liegt.
 *
 * formKey als key am <form>: baut das Formular nach jedem Ergebnis neu auf, damit Auswahllisten
 * die Werte aus state.values zeigen (siehe useFormKey).
 */
export function useFormFeedback(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const formKey = useFormKey(state);

  useEffect(() => {
    if (state.status === "error") {
      const form = formRef.current;
      if (!form) return;
      const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      // Radio-Gruppen: die Markierung sitzt am fieldset, fokussiert wird die gewählte (oder erste) Option.
      const target =
        invalid instanceof HTMLFieldSetElement
          ? (invalid.querySelector<HTMLElement>("input:checked") ?? invalid.querySelector<HTMLElement>("input"))
          : invalid;
      if (target) {
        target.focus();
        return;
      }
      form.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (state.status === "success") {
      const box = successRef.current;
      if (!box) return;
      box.focus({ preventScroll: true });
      box.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state]);

  return { formRef, successRef, formKey };
}

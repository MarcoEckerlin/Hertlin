"use client";

import { useEffect, useRef } from "react";
import type { FormState } from "@/lib/forms";

/**
 * Setzt nach einem fehlgeschlagenen Absenden den Fokus auf das erste markierte Feld
 * (oder scrollt zur Fehlermeldung, wenn kein Feld markiert ist). Nach dem Speichern
 * wird die Erfolgsmeldung sichtbar gemacht, falls sie aus dem Bild gescrollt ist.
 */
export function useFormFocus(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (state.status === "success") {
      // Erfolgsmeldung steht oben im Formular – nach oben holen, falls sie gerade nicht zu sehen ist
      const message = form.querySelector<HTMLElement>('[role="status"]');
      if (message && message.getBoundingClientRect().top < 0) {
        message.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (state.status !== "error") return;
    const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    const target =
      invalid instanceof HTMLFieldSetElement
        ? (invalid.querySelector<HTMLElement>("input:checked") ?? invalid.querySelector<HTMLElement>("input"))
        : invalid;
    if (target) {
      target.focus();
      return;
    }
    form.querySelector<HTMLElement>('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  return formRef;
}

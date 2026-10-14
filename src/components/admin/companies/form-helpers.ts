import { useEffect, useRef } from "react";
import type { FormState } from "@/lib/forms";

/** id, aria-invalid und aria-describedby passend zur Field-Komponente (Fehler bzw. Hinweis darunter). */
export function fieldProps(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}

/**
 * Nach einem fehlgeschlagenen Absenden den Fokus auf das erste markierte Feld setzen
 * (oder zur Fehlermeldung scrollen). Nach dem Speichern die Erfolgsmeldung sichtbar machen.
 */
export function useFormFocus(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    if (state.status === "success") {
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

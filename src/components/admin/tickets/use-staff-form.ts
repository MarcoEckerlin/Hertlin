"use client";

import { useEffect, useRef, useState } from "react";
import type { FormState } from "@/lib/forms";

/**
 * Hilfen für Formulare der Verwaltung mit useActionState:
 * - formKey wechselt mit jedem Ergebnis der Action. Als key am <form> baut React das Formular neu auf,
 *   damit Felder zuverlässig die Werte aus state.values (Fehler) bzw. die neu geladenen Daten (Erfolg) zeigen.
 * - Bei Fehlern springt der Fokus auf das erste markierte Feld, sonst wird die Meldung sichtbar gemacht.
 */
export function useStaffForm(state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);

  if (state !== lastState) {
    setLastState(state);
    setFormKey((key) => key + 1);
  }

  useEffect(() => {
    const form = formRef.current;
    if (!form || state.status === "idle") return;
    if (state.status === "error") {
      const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
      const target =
        invalid instanceof HTMLFieldSetElement
          ? (invalid.querySelector<HTMLElement>("input:checked") ?? invalid.querySelector<HTMLElement>("input"))
          : invalid;
      if (target) {
        target.focus();
        return;
      }
    }
    form.querySelector<HTMLElement>('[role="alert"], [role="status"]')?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [state]);

  return { formRef, formKey };
}

/** id, aria-invalid und aria-describedby passend zur Field-Komponente. */
export function fieldA11y(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}

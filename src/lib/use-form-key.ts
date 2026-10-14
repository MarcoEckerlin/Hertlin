"use client";

import { useState } from "react";
import type { FormState } from "@/lib/forms";

/**
 * Schlüssel für <form key={…}>, der mit jedem Ergebnis einer Action wechselt.
 *
 * React setzt Formulare nach einer Action zurück. Auswahllisten mit defaultValue springen dabei auf den Wert
 * vom ersten Anzeigen, denn React übernimmt eine geänderte defaultValue-Angabe bei <select> nicht ins DOM.
 * Mit neuem key baut React das Formular neu auf, und alle Felder zeigen die aktuellen Vorgaben:
 * state.values nach einem Fehler, die frisch geladenen Daten nach dem Speichern.
 */
export function useFormKey(state: FormState): number {
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);

  if (state !== lastState) {
    setLastState(state);
    setFormKey((key) => key + 1);
  }

  return formKey;
}

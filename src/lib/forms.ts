import type { z } from "zod";

/**
 * Einheitlicher Rückgabewert für Server Actions mit useActionState.
 * values: Eingaben für die Wiederanzeige (React setzt Formulare nach einer Action zurück).
 */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** Freie Zusatzdaten, z. B. ein Einladungslink zum Kopieren */
  data?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function formValues(formData: FormData, omit: string[] = ["password", "passwordConfirm", "currentPassword"]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$") && !omit.includes(key)) values[key] = value;
  }
  return values;
}

export function errorState(
  message: string,
  formData?: FormData,
  fieldErrors?: Record<string, string>,
): FormState {
  return { status: "error", message, fieldErrors, values: formData ? formValues(formData) : undefined };
}

export function fromZodError(error: z.ZodError, formData?: FormData, message = "Bitte prüfen Sie die markierten Felder."): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return errorState(message, formData, fieldErrors);
}

export function successState(message?: string, data?: Record<string, string>): FormState {
  return { status: "success", message, data };
}

/** Leere Strings aus Formularen zu undefined machen (für optionale Felder). */
export function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

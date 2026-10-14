/** id, aria-invalid und aria-describedby passend zur Field-Komponente (Fehler bzw. Hinweis darunter). */
export function fieldProps(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}

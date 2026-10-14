import type { FormState } from "@/lib/forms";
import { Alert } from "@/components/ui/alert";

/** Zeigt die Gesamtmeldung einer Server Action (Fehler oder Erfolg). */
export function FormMessage({ state, className }: { state: FormState | undefined; className?: string }) {
  if (!state?.message || state.status === "idle") return null;
  return (
    <Alert tone={state.status === "error" ? "error" : "success"} className={className}>
      {state.message}
    </Alert>
  );
}

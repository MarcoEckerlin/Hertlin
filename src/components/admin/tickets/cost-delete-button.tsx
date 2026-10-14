"use client";

import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";

/** Kleiner Lösch-Knopf (nur Symbol) für eine Position, mit Sicherheitsabfrage. */
export function CostDeleteButton({ label, confirmText }: { label: string; confirmText: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title="Löschen"
      onClick={(event) => {
        if (!window.confirm(confirmText)) event.preventDefault();
      }}
      className="inline-flex size-8 items-center justify-center rounded-full text-danger-ink transition-colors hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-55"
    >
      {pending ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
    </button>
  );
}

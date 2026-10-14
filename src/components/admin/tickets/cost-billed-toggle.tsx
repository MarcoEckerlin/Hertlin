"use client";

import { useOptimistic } from "react";
import { toggleCostBilledAction } from "@/lib/actions/admin-costs";
import { cn } from "@/lib/cn";

/**
 * „offen“ / „abgerechnet“ einer Position mit einem Klick umschalten (nur Administratoren).
 * Der neue Stand erscheint sofort; die Seite lädt danach mit dem gespeicherten Stand neu.
 */
export function CostBilledToggle({
  ticketId,
  costId,
  billed,
  billedAtLabel,
  description,
}: {
  ticketId: number;
  costId: string;
  billed: boolean;
  /** z. B. „12.10.2026“ */
  billedAtLabel: string | null;
  description: string;
}) {
  const [shown, setShown] = useOptimistic(billed);
  return (
    <form
      action={async () => {
        setShown(!billed);
        await toggleCostBilledAction(ticketId, costId);
      }}
    >
      <button
        type="submit"
        title={
          shown
            ? `Abgerechnet${billedAtLabel ? ` am ${billedAtLabel}` : ""} – klicken, um auf „offen“ zurückzusetzen`
            : "Als abgerechnet markieren"
        }
        aria-label={shown ? `Abgerechnet. Auf „offen“ zurücksetzen: ${description}` : `Offen. Als abgerechnet markieren: ${description}`}
        aria-pressed={shown}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset transition-colors duration-150",
          shown
            ? "bg-success-soft text-success-ink ring-success-line hover:ring-success-ink/40"
            : "bg-warning-soft text-warning-ink ring-warning-line hover:ring-warning-ink/40",
        )}
      >
        <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
        {shown ? "abgerechnet" : "offen"}
      </button>
    </form>
  );
}

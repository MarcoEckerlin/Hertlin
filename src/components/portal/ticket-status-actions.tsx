import { CircleCheck, RotateCcw } from "lucide-react";
import { OPEN_STATUSES } from "@/lib/constants";
import { markResolvedAction, reopenTicketAction } from "@/lib/actions/portal-tickets";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * „Problem ist gelöst“ bzw. bei Anfragen „Hat sich erledigt“ (solange das Ticket offen ist) oder „Wieder öffnen“ (wenn es gelöst ist).
 * Die gebundene Ticket-ID prüft die Action erneut gegen den Sichtbereich des Benutzers.
 */
export function TicketStatusActions({ ticketId, status, type }: { ticketId: number; status: string; type: string }) {
  if ((OPEN_STATUSES as readonly string[]).includes(status)) {
    return (
      <form action={markResolvedAction.bind(null, ticketId)}>
        <SubmitButton variant="secondary" size="sm" pendingText="Wird gespeichert …">
          <CircleCheck className="size-4 text-success-ink" aria-hidden />
          {type === "ANFRAGE" ? "Hat sich erledigt" : "Problem ist gelöst"}
        </SubmitButton>
      </form>
    );
  }
  if (status === "RESOLVED") {
    return (
      <form action={reopenTicketAction.bind(null, ticketId)}>
        <SubmitButton variant="secondary" size="sm" pendingText="Wird geöffnet …">
          <RotateCcw className="size-4" aria-hidden />
          Wieder öffnen
        </SubmitButton>
      </form>
    );
  }
  return null;
}

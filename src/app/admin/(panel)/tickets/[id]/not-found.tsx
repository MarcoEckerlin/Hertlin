import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminTicketNotFound() {
  return (
    <div className="py-6">
      <EmptyState
        title="Dieses Ticket gibt es nicht"
        action={
          <ButtonLink href="/admin/tickets" variant="secondary" size="sm">
            Zur Ticketliste
          </ButtonLink>
        }
      >
        Vielleicht stimmt die Nummer nicht. Über die Suche in der Ticketliste finden Sie Tickets auch nach Betreff, Kunde
        oder E-Mail-Adresse.
      </EmptyState>
    </div>
  );
}

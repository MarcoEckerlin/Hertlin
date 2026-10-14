import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

/** Ticket gibt es nicht oder es liegt außerhalb des Sichtbereichs – beides sieht für den Benutzer gleich aus. */
export default function PortalTicketNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Übersicht", href: "/" },
          { label: "Tickets", href: "/tickets" },
          { label: "Nicht gefunden" },
        ]}
        title="Dieses Ticket finden wir nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Entweder gibt es die Nummer nicht, oder das Ticket gehört zu einem Bereich, den Ihr Zugang nicht sieht. Mitarbeiter
          sehen nur die Tickets, die sie selbst gemeldet haben – alle Tickets der Firma sieht der Hauptansprechpartner.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/tickets?status=alle">Alle meine Tickets</ButtonLink>
          <ButtonLink href="/tickets/neu" variant="secondary">
            Neues Ticket
          </ButtonLink>
        </div>
      </div>
    </>
  );
}

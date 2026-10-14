import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function AdminTicketNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Tickets", href: "/admin/tickets" }, { label: "Nicht gefunden" }]}
        title="Dieses Ticket gibt es nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Vielleicht stimmt die Nummer nicht. Über die Suche in der Ticketliste finden Sie Tickets auch nach Betreff, Kunde
          oder E-Mail-Adresse.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/tickets">Zur Ticketliste</ButtonLink>
        </div>
      </div>
    </>
  );
}

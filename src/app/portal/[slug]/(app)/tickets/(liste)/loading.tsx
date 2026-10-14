import { PageSkeleton } from "@/components/ui/skeleton";

/** Sofortige Rückmeldung beim Öffnen der Ticketliste. Filterwechsel zeigen stattdessen die gedimmte alte Liste. */
export default function PortalTicketsLoading() {
  return <PageSkeleton rows={6} />;
}

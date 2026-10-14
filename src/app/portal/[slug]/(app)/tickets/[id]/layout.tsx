import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { requirePortalContext } from "@/lib/auth";
import { parseTicketParam, portalTicketExists } from "@/components/portal/portal-data";

/**
 * Prüft vor dem Platzhalter (loading.tsx), ob es das Ticket im Sichtbereich gibt.
 * So antwortet eine fremde oder falsche Nummer weiterhin mit echtem Status 404 statt mit einer gestreamten Seite.
 */
export default async function PortalTicketLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string; id: string }>;
  children: ReactNode;
}) {
  await requirePortalContext();
  const { id } = await params;
  const ticketId = parseTicketParam(id);
  if (!ticketId) notFound();
  // Abgetippte Anzeigeform („T-00042“) auf die richtige Adresse umleiten
  if (id !== String(ticketId)) redirect(`/tickets/${ticketId}`);
  if (!(await portalTicketExists(ticketId))) notFound();
  return children;
}

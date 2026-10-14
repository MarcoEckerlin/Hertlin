import { db } from "@/lib/db";
import { getPortalContext } from "@/lib/auth";
import { portalTicketWhere } from "@/lib/permissions";
import { attachmentResponse } from "@/lib/uploads";

/**
 * Anhang im Kundenportal herunterladen (<kuerzel>.<hauptdomain>/dateien/<id>).
 * Ausgeliefert wird nur, was zu einer nicht internen Nachricht eines Tickets im Sichtbereich
 * des angemeldeten Benutzers gehört – gleiche Regeln wie portalTicketWhere().
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;

  const ctx = await getPortalContext();
  if (!ctx) {
    return plain(401, "Bitte melden Sie sich im Kundenportal an, um diese Datei zu öffnen.");
  }
  // Der Mandant kommt aus dem Host; der Pfad muss dazu passen
  if (ctx.root.slug !== slug || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return notFound();

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: {
      fileName: true,
      storedName: true,
      mimeType: true,
      message: { select: { internal: true, ticketId: true } },
    },
  });
  if (!attachment || attachment.message.internal) return notFound();

  const ticket = await db.ticket.findFirst({
    where: { AND: [{ id: attachment.message.ticketId }, portalTicketWhere(ctx)] },
    select: { id: true },
  });
  if (!ticket) return notFound();

  const response = await attachmentResponse(attachment);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

function notFound(): Response {
  return plain(404, "Datei nicht gefunden.");
}

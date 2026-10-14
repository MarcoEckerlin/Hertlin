import { db } from "@/lib/db";
import { attachmentResponse } from "@/lib/uploads";
import { guestTicketWhere, isPlausibleGuestToken } from "../../guest-ticket";

/**
 * Anhang über den Status-Link herunterladen.
 * Ausgeliefert wird nur, was zu einer nicht internen Nachricht genau dieses Tickets gehört.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  if (!isPlausibleGuestToken(token) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return notFound();

  const attachment = await db.attachment.findFirst({
    where: { id, message: { internal: false, ticket: guestTicketWhere(token) } },
    select: { fileName: true, storedName: true, mimeType: true },
  });
  if (!attachment) return notFound();

  const response = await attachmentResponse(attachment);
  // Der Status-Link steckt in der URL: nicht weitergeben, nicht indexieren.
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function notFound(): Response {
  return new Response("Datei nicht gefunden", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

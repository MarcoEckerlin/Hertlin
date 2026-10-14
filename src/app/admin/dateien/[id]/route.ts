import { db } from "@/lib/db";
import { getStaffUser } from "@/lib/auth";
import { attachmentResponse } from "@/lib/uploads";

/**
 * Anhang in der Verwaltung herunterladen (/admin/dateien/<id>).
 * Nur für angemeldete Hertlin-Mitarbeiter – auch Anhänge interner Notizen.
 * Für alle anderen sieht es aus, als gäbe es die Datei nicht.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const staff = await getStaffUser();
  if (!staff || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return notFound();

  const attachment = await db.attachment.findUnique({
    where: { id },
    select: { fileName: true, storedName: true, mimeType: true },
  });
  if (!attachment) return notFound();

  const response = await attachmentResponse(attachment);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function notFound(): Response {
  return new Response("Datei nicht gefunden.", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

import { db } from "@/lib/db";
import { mediaResponse } from "@/cms/media";

/** Öffentliche Auslieferung von Website-Bildern aus der Mediathek. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9]{8,40}$/i.test(id)) return notFound();
  const file = await db.mediaFile.findUnique({
    where: { id },
    select: { fileName: true, storedName: true, mimeType: true },
  });
  if (!file) return notFound();
  return mediaResponse(file);
}

function notFound() {
  return new Response("Nicht gefunden", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

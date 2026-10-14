import { db } from "@/lib/db";

/** Lebenszeichen für Docker/Monitoring: antwortet 200, wenn Server und Datenbank erreichbar sind. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

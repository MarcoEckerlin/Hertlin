import "server-only";
import { headers } from "next/headers";

/**
 * Einfaches In-Memory-Rate-Limit (pro Serverprozess).
 * Reicht für eine Instanz; bei mehreren Instanzen auf Redis o. Ä. umstellen.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  bucket.count += 1;
  return { ok: bucket.count <= limit, retryAfterMs: bucket.resetAt - now };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Ist die Grenze schon erreicht? Zählt nicht mit. Für Sperren, die nur Fehlversuche zählen:
 * vorher hiermit prüfen, bei einem Fehlversuch rateLimit() aufrufen.
 */
export function rateLimitReached(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  return !!bucket && bucket.resetAt >= Date.now() && bucket.count >= limit;
}

/**
 * IP-Adresse des Besuchers. Hinter einem Reverse Proxy muss dieser X-Forwarded-For
 * selbst setzen (nicht vom Client übernehmen), siehe README.
 * Wir nehmen den letzten Eintrag: Den hat der eigene Proxy angehängt. Frühere Einträge
 * kann der Client selbst mitschicken, wenn der Proxy die Liste nur ergänzt.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded?.at(-1) || h.get("x-real-ip") || "unknown";
}

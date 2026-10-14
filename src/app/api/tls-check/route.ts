import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { normalizeHost, parseHost, rootDomain } from "@/lib/hosts";

/**
 * Für Caddy „On-Demand TLS“ (docker/Caddyfile): Caddy fragt vor jedem neuen Zertifikat,
 * ob der Hostname zu dieser Installation gehört. Zertifikate gibt es nur für die Hauptdomain,
 * www und die Subdomains aktiver Firmenkunden – sonst könnte jeder beliebige Namen auf den
 * Server zeigen lassen und Zertifikate anfordern.
 *
 * Caddy ruft die Adresse intern auf; von außen sperrt der Caddyfile sie.
 */
export async function GET(request: NextRequest) {
  const domain = normalizeHost(request.nextUrl.searchParams.get("domain"));
  if (!domain || domain.includes(":")) return new Response("nein", { status: 404 });

  // ROOT_DOMAIN ohne Port vergleichen (Zertifikate gelten für Hostnamen)
  const root = rootDomain().replace(/:\d+$/, "");
  if (domain === root || domain === `www.${root}`) return new Response("ok");

  const info = parseHost(domain, root);
  if (info.kind !== "portal") return new Response("nein", { status: 404 });

  const company = await db.company.findFirst({ where: { slug: info.slug, parentId: null, active: true }, select: { id: true } });
  return company ? new Response("ok") : new Response("nein", { status: 404 });
}

import { NextResponse, type NextRequest } from "next/server";
import { parseHost } from "@/lib/hosts";

/**
 * Leitet Anfragen anhand des Hostnamens weiter:
 * - Hauptdomain: Website, Privatkunden-Support und Verwaltung (/admin)
 * - <kuerzel>.<hauptdomain>: Kundenportal des Firmenkunden, intern unter /portal/<kuerzel>
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const info = parseHost(host);
  const url = request.nextUrl.clone();
  const { pathname } = url;

  if (info.kind === "invalid") {
    url.pathname = "/__unbekannt";
    return NextResponse.rewrite(url, { status: 404 });
  }

  if (info.kind === "main") {
    // Portalseiten sind nur über die Subdomain erreichbar.
    if (pathname === "/portal" || pathname.startsWith("/portal/")) {
      url.pathname = "/__unbekannt";
      return NextResponse.rewrite(url, { status: 404 });
    }
    return NextResponse.next();
  }

  // Gemeinsame API-Routen (z. B. Website-Übersetzer) gelten auf allen Hosts
  if (pathname.startsWith("/api/") || pathname.startsWith("/medien/")) return NextResponse.next();

  url.pathname = `/portal/${info.slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Alles außer Next.js-Assets und Dateien mit Endung (Bilder, Fonts, robots.txt …)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]{2,5}$).*)",
  ],
};

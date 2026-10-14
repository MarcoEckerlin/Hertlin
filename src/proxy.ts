import { NextResponse, type NextRequest } from "next/server";
import { REQUEST_PATH_HEADER, parseHost } from "@/lib/hosts";

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
    // Pfad ohne passende Route: schlichte 404-Seite (app/not-found.tsx) ohne Website-Menü, dessen relative Links
    // auf diesem Host wieder ins Leere führten. Ihr Link führt absolut zur Hauptdomain.
    // (Ein einteiliger Pfad wie „/__unbekannt“ landet bei der Website-Seite /[slug] samt Menü.)
    url.pathname = "/__unbekannt/host";
    return NextResponse.rewrite(url, { status: 404 });
  }

  // Angefragter Pfad für den Rücksprung nach der Anmeldung (?next=…), siehe requireStaff/requirePortalContext.
  // Immer neu setzen, damit kein mitgeschickter Header durchgeht.
  const requestHeaders = new Headers(request.headers);
  const requestedPath = `${pathname}${url.search}`;
  if (requestedPath.length <= 1000) requestHeaders.set(REQUEST_PATH_HEADER, requestedPath);
  else requestHeaders.delete(REQUEST_PATH_HEADER);

  if (info.kind === "main") {
    // Portalseiten sind nur über die Subdomain erreichbar.
    if (pathname === "/portal" || pathname.startsWith("/portal/")) {
      url.pathname = "/__unbekannt";
      return NextResponse.rewrite(url, { status: 404 });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Gemeinsame API-Routen (z. B. Website-Übersetzer) gelten auf allen Hosts
  if (pathname.startsWith("/api/") || pathname.startsWith("/medien/")) return NextResponse.next();

  url.pathname = `/portal/${info.slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    // Alles außer Next.js-Assets und Dateien mit Endung (Bilder, Fonts, robots.txt …)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]{2,5}$).*)",
  ],
};

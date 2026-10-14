import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { mainUrl, parseHost } from "@/lib/hosts";

// ROOT_DOMAIN und Host werden pro Anfrage ausgewertet
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = parseHost(h.get("x-forwarded-host") ?? h.get("host"));

  // Kundenportale (Subdomains) sollen gar nicht in Suchmaschinen auftauchen.
  if (host.kind !== "main") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/status", "/portal"],
    },
    sitemap: mainUrl("/sitemap.xml"),
  };
}

import type { MetadataRoute } from "next";
import { mainUrl } from "@/lib/hosts";
import { listPublishedPaths, pagePath, type PublishedPath } from "@/cms/store";
import { SYSTEM_PAGE_SLUGS } from "@/cms/schema";

// mainUrl() liest ROOT_DOMAIN zur Laufzeit, die Seiten kommen aus der Datenbank
export const dynamic = "force-dynamic";

const PRIORITY: Record<string, number> = {
  "/": 1,
  "/leistungen": 0.9,
  "/unternehmen": 0.9,
  "/privatkunden": 0.9,
  "/kontakt": 0.8,
  "/support": 0.7,
  "/ueber-uns": 0.6,
  "/impressum": 0.2,
  "/datenschutz": 0.2,
  "/agb": 0.2,
};

const LEGAL = new Set(["/impressum", "/datenschutz", "/agb"]);

/** Öffentliche Seiten der Hauptdomain (aus dem Website-Editor). Portal, Verwaltung und Status-Links gehören nicht hinein. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let paths: PublishedPath[];
  try {
    paths = await listPublishedPaths();
  } catch {
    paths = SYSTEM_PAGE_SLUGS.map((slug) => ({ path: pagePath(slug), updatedAt: null, system: true }));
  }
  return paths
    .sort((a, b) => (PRIORITY[b.path] ?? 0.5) - (PRIORITY[a.path] ?? 0.5) || a.path.localeCompare(b.path))
    .map((p) => ({
      url: mainUrl(p.path),
      lastModified: p.updatedAt ?? undefined,
      changeFrequency: LEGAL.has(p.path) ? ("yearly" as const) : ("monthly" as const),
      priority: PRIORITY[p.path] ?? 0.5,
    }));
}

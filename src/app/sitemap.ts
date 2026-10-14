import type { MetadataRoute } from "next";
import { mainUrl } from "@/lib/hosts";

// mainUrl() liest ROOT_DOMAIN zur Laufzeit
export const dynamic = "force-dynamic";

type Entry = { path: string; changeFrequency: "monthly" | "yearly"; priority: number };

/** Öffentliche Seiten der Hauptdomain. Portal, Verwaltung und Status-Links gehören nicht hinein. */
const pages: Entry[] = [
  { path: "/", changeFrequency: "monthly", priority: 1 },
  { path: "/leistungen", changeFrequency: "monthly", priority: 0.9 },
  { path: "/unternehmen", changeFrequency: "monthly", priority: 0.9 },
  { path: "/privatkunden", changeFrequency: "monthly", priority: 0.9 },
  { path: "/kontakt", changeFrequency: "yearly", priority: 0.8 },
  { path: "/support", changeFrequency: "yearly", priority: 0.7 },
  { path: "/ueber-uns", changeFrequency: "yearly", priority: 0.6 },
  { path: "/impressum", changeFrequency: "yearly", priority: 0.2 },
  { path: "/datenschutz", changeFrequency: "yearly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((p) => ({
    url: mainUrl(p.path),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getSiteSettings } from "@/lib/settings";
import { getPublishedPage } from "@/cms/store";
import { isPublicPageSlug } from "@/cms/schema";
import { replacePlaceholders } from "@/cms/placeholders";
import { buildBlockContext, PageBlocks, type SearchParams } from "@/cms/render";

/**
 * Alle Seiten aus dem Website-Editor (Leistungen, Kontakt, Impressum, AGB, eigene Seiten …).
 * Eigene Routen wie /login, /status oder /anfrage liegen als feste Ordner daneben und haben Vorrang;
 * reservierte Adressen werden hier zusätzlich abgewiesen.
 * Unbekannte Seiten weist schon layout.tsx mit 404 ab – vor dem Ladezustand (loading.tsx), damit der
 * Statuscode stimmt.
 */

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // Unbekannte Seite: Titel passend zur 404-Seite statt des Standardtitels der Startseite
  if (!isPublicPageSlug(slug)) return { title: "Seite nicht gefunden" };
  const [page, settings] = await Promise.all([getPublishedPage(slug), getSiteSettings()]);
  if (!page) return { title: "Seite nicht gefunden" };
  const ctx = buildBlockContext(settings);
  return {
    title: replacePlaceholders(page.title, ctx.text),
    description: page.description ? replacePlaceholders(page.description, ctx.text) : undefined,
  };
}

export default async function CmsPage({ params, searchParams }: Props) {
  await connection();
  const { slug } = await params;
  if (!isPublicPageSlug(slug)) notFound();
  const page = await getPublishedPage(slug);
  if (!page) notFound();
  const [settings, query] = await Promise.all([getSiteSettings(), searchParams]);
  const ctx = buildBlockContext(settings, { searchParams: query });
  return <PageBlocks title={page.title} blocks={page.blocks} ctx={ctx} />;
}

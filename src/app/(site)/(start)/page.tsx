import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getSiteSettings } from "@/lib/settings";
import { getPublishedPage } from "@/cms/store";
import { replacePlaceholders } from "@/cms/placeholders";
import { buildBlockContext, PageBlocks, type SearchParams } from "@/cms/render";

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPublishedPage(""), getSiteSettings()]);
  const ctx = buildBlockContext(settings);
  return {
    // Startseite: Firmenname und Kurzbeschreibung statt des internen Seitentitels „Startseite“
    title: { absolute: [settings.name, settings.tagline].filter((v) => v.trim()).join(" – ") },
    description: page?.description ? replacePlaceholders(page.description, ctx.text) : undefined,
  };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const page = await getPublishedPage("");
  if (!page) notFound();
  const [settings, query] = await Promise.all([getSiteSettings(), searchParams]);
  const ctx = buildBlockContext(settings, { searchParams: query });
  return <PageBlocks title={page.title} blocks={page.blocks} ctx={ctx} />;
}

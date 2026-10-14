import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublishedPage } from "@/cms/store";
import { isPublicPageSlug } from "@/cms/schema";

/**
 * Prüft vor dem Ladezustand (loading.tsx), ob es die Seite gibt. Ein notFound() erst in der Seite käme
 * nach dem Platzhalter und damit nach dem Statuscode 200 – hier antwortet die Adresse richtig mit 404.
 * getPublishedPage ist pro Anfrage zwischengespeichert, die Seite liest dieselben Daten ohne zweite Abfrage.
 */
export default async function CmsPageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  if (!isPublicPageSlug(slug) || !(await getPublishedPage(slug))) notFound();
  return children;
}

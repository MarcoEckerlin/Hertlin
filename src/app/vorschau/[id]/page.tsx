import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { getNavigation, getPreviewPage } from "@/cms/store";
import { buildBlockContext, PageBlocks, type SearchParams } from "@/cms/render";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = {
  title: "Vorschau",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Vorschau einer Seite aus dem Website-Editor (nur Administratoren): zeigt den Entwurf mit Kopf- und Fußzeile. */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { id } = await params;
  const page = await getPreviewPage(id);
  if (!page) notFound();

  const [settings, nav, query] = await Promise.all([getSiteSettings(), getNavigation(), searchParams]);
  const ctx = buildBlockContext(settings, { searchParams: query, preview: true });
  const hiddenCount = page.blocks.filter((b) => b.hidden).length;

  const banner = (
    <div className="bg-navy text-white" data-no-translate role="region" aria-label="Hinweis zur Vorschau">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 text-sm sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-start gap-2.5">
          <Eye className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">Vorschau – so sieht die Seite nach dem Veröffentlichen aus</p>
            <p className="mt-0.5 text-white/70">
              {page.isDraft ? "Entwurf, noch nicht veröffentlicht" : "Entspricht dem veröffentlichten Stand"} · Adresse{" "}
              <span className="font-semibold text-white">{page.path}</span>
              {!page.published ? " · Seite ist auf der Website noch nicht sichtbar" : null}
              {hiddenCount > 0
                ? ` · ${hiddenCount === 1 ? "1 ausgeblendetes Modul" : `${hiddenCount} ausgeblendete Module`} (blass dargestellt)`
                : null}
            </p>
          </div>
        </div>
        {/* Heller Knopf auf dem dunklen Band – in Hell und Dunkel gleich (helle Insel) */}
        <Link
          href={`/admin/website/seiten/${page.id}`}
          data-theme="light"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-4 py-2 font-semibold text-ink hover:bg-brand-100"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Zurück zum Editor
        </Link>
      </div>
    </div>
  );

  return (
    <SiteShell nav={nav} banner={banner}>
      <PageBlocks title={page.title} blocks={page.blocks} ctx={ctx} />
    </SiteShell>
  );
}

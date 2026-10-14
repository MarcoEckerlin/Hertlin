import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ExternalLink, Plus, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { rootDomain } from "@/lib/hosts";
import { getSiteSettings, unfinishedSettings } from "@/lib/settings";
import { ensureSystemPages, listPages, type PageSummary } from "@/cms/store";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { FlashToast } from "@/components/ui/toaster";
import { aboveRowLinkClass, rowLinkClass } from "@/components/admin/companies/list-tools";
import { settingsLabelList } from "@/components/admin/website/settings-labels";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Website" };

const NOTICES: Record<string, string> = {
  "seite-geloescht": "Die Seite wurde gelöscht.",
};

function StatusBadges({ page }: { page: PageSummary }) {
  return (
    <div className="flex flex-wrap justify-end gap-1.5 sm:justify-start">
      {page.published ? (
        <Badge tone="green">Veröffentlicht</Badge>
      ) : page.publishedAt ? (
        <Badge tone="gray">Ausgeblendet</Badge>
      ) : (
        <Badge tone="gray">Noch nicht veröffentlicht</Badge>
      )}
      {page.hasDraft ? <Badge tone="amber">Entwurf mit Änderungen</Badge> : null}
      <LinkedIn page={page} />
    </div>
  );
}

/** Wo die Seite verlinkt ist; nichts, wenn nirgends */
function LinkedIn({ page }: { page: PageSummary }) {
  return (
    <>
      {page.showInNav ? <Badge tone="blue">Hauptmenü</Badge> : null}
      {page.showInFooter ? <Badge tone="blue">Fußzeile</Badge> : null}
    </>
  );
}

function PagesTable({ pages, editors, host }: { pages: PageSummary[]; editors: Map<string, string>; host: string }) {
  return (
    <Table stack>
      <THead>
        <tr>
          <TH>Seite</TH>
          <TH>Adresse</TH>
          <TH>Status und Menü</TH>
          <TH>Zuletzt geändert</TH>
        </tr>
      </THead>
      <tbody>
        {pages.map((page) => {
          const editor = page.updatedById ? editors.get(page.updatedById) : undefined;
          return (
            <TR key={page.id} className="relative">
              <TD className="min-w-[13rem]">
                <span className="min-w-0">
                  <Link
                    href={`/admin/website/seiten/${page.id}`}
                    className={cn("font-semibold text-ink hover:underline", rowLinkClass)}
                  >
                    {page.title}
                  </Link>
                  {page.usesDefaults ? <span className="block text-xs text-ink-muted">Zeigt den Standardinhalt</span> : null}
                </span>
              </TD>
              <TD label="Adresse">
                {page.published ? (
                  <a
                    href={page.path}
                    target="_blank"
                    rel="noopener"
                    className={cn(
                      "inline-flex min-h-6 items-center gap-1 py-1 font-mono text-[0.8rem] text-brand-700 hover:underline",
                      aboveRowLinkClass,
                    )}
                    title={`${host}${page.path} in neuem Tab öffnen`}
                  >
                    {page.path}
                    <ExternalLink className="size-3.5" aria-hidden />
                    <span className="sr-only"> (öffnet in neuem Tab)</span>
                  </a>
                ) : (
                  <span className="font-mono text-[0.8rem] text-ink-muted">{page.path}</span>
                )}
              </TD>
              <TD label="Status">
                <StatusBadges page={page} />
              </TD>
              <TD label="Geändert" className="whitespace-nowrap">
                <span>
                  {formatDateTime(page.updatedAt)}
                  {editor ? <span className="block text-xs text-ink-muted">von {editor}</span> : null}
                </span>
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Kachel mit Link (ganze Fläche klickbar) */
function LinkCard({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="relative transition-colors hover:border-brand-300">
      <CardBody className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href={href} className={cn("font-semibold text-ink hover:underline", rowLinkClass)}>
            {title}
          </Link>
          <div className="mt-0.5 text-sm text-ink-soft">{children}</div>
        </div>
        <ChevronRight className="mt-0.5 size-5 shrink-0 text-ink-muted" aria-hidden />
      </CardBody>
    </Card>
  );
}

export default async function WebsiteOverviewPage({ searchParams }: { searchParams: Promise<{ hinweis?: string }> }) {
  await requireAdmin();
  await ensureSystemPages();
  const { hinweis } = await searchParams;

  const [pages, settings, mediaCount] = await Promise.all([listPages(), getSiteSettings(), db.mediaFile.count()]);
  const editorIds = [...new Set(pages.map((p) => p.updatedById).filter((id): id is string => !!id))];
  const editors = new Map(
    (await db.user.findMany({ where: { id: { in: editorIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );
  const unfinished = unfinishedSettings(settings);
  const systemPages = pages.filter((p) => p.system);
  const customPages = pages.filter((p) => !p.system);
  const host = rootDomain();

  return (
    <>
      <FlashToast param="hinweis" value={hinweis} messages={NOTICES} />
      <PageHeader
        title="Website"
        description="Texte, Seiten und Bilder der Website. Änderungen erscheinen erst nach „Veröffentlichen“."
        actions={
          <ButtonLink href="/admin/website/seiten/neu">
            <Plus className="size-4" aria-hidden />
            Neue Seite
          </ButtonLink>
        }
      />

      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <LinkCard href="/admin/website/firmendaten" title="Firmendaten">
            {unfinished.length > 0 ? (
              <p className="flex items-start gap-1.5 font-medium text-warning-ink">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Noch mit Platzhalter: {settingsLabelList(unfinished)}. Diese Angaben stehen im Impressum, in der Fußzeile und in
                  E-Mails.
                </span>
              </p>
            ) : (
              <p>Anschrift, Telefon, E-Mail und Zeiten – an einer Stelle gepflegt, überall auf der Website verwendet.</p>
            )}
          </LinkCard>
          <LinkCard href="/admin/website/medien" title="Medien">
            <p>
              {mediaCount === 0
                ? "Noch keine Bilder hochgeladen."
                : mediaCount === 1
                  ? "1 Bild in der Mediathek."
                  : `${mediaCount} Bilder in der Mediathek.`}{" "}
              Bilder für Kopfbereiche und „Bild und Text“-Module.
            </p>
          </LinkCard>
        </div>

        <section aria-labelledby="system-pages" className="space-y-3">
          <div>
            <h2 id="system-pages" className="text-lg font-bold tracking-tight text-ink">
              Kernseiten
            </h2>
            <p className="text-sm text-ink-muted">Diese Seiten gibt es immer. Inhalt und Menü lassen sich anpassen, die Adresse bleibt fest.</p>
          </div>
          <PagesTable pages={systemPages} editors={editors} host={host} />
        </section>

        <section aria-labelledby="custom-pages" className="space-y-3">
          <div>
            <h2 id="custom-pages" className="text-lg font-bold tracking-tight text-ink">
              Eigene Seiten
            </h2>
            <p className="text-sm text-ink-muted">Zusätzliche Seiten, z. B. für Stellenangebote oder ein bestimmtes Angebot.</p>
          </div>
          {customPages.length > 0 ? (
            <PagesTable pages={customPages} editors={editors} host={host} />
          ) : (
            <EmptyState
              title="Noch keine eigenen Seiten"
              action={
                <ButtonLink href="/admin/website/seiten/neu" variant="secondary">
                  <Plus className="size-4" aria-hidden />
                  Neue Seite anlegen
                </ButtonLink>
              }
            >
              Legen Sie eine Seite an, wenn ein Thema auf den Kernseiten keinen Platz hat. Sie bestimmen selbst, ob sie im Menü oder in der
              Fußzeile erscheint.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}

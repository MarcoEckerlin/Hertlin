import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { rootDomain } from "@/lib/hosts";
import { getSiteSettings, unfinishedSettings } from "@/lib/settings";
import { ensureSystemPages, listPages, type PageSummary } from "@/cms/store";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { settingsLabelList } from "@/components/admin/website/settings-labels";

export const metadata: Metadata = { title: "Website" };

const NOTICES: Record<string, string> = {
  "seite-geloescht": "Die Seite wurde gelöscht.",
};

function StatusBadges({ page }: { page: PageSummary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {page.published ? (
        <Badge tone="green">Veröffentlicht</Badge>
      ) : page.publishedAt ? (
        <Badge tone="gray">Ausgeblendet</Badge>
      ) : (
        <Badge tone="gray">Noch nicht veröffentlicht</Badge>
      )}
      {page.hasDraft ? <Badge tone="amber">Entwurf mit Änderungen</Badge> : null}
    </div>
  );
}

function LinkedIn({ page }: { page: PageSummary }) {
  if (!page.showInNav && !page.showInFooter) return <span className="text-ink-muted">–</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {page.showInNav ? <Badge tone="blue">Hauptmenü</Badge> : null}
      {page.showInFooter ? <Badge tone="blue">Footer</Badge> : null}
    </div>
  );
}

function PagesTable({ pages, editors, host }: { pages: PageSummary[]; editors: Map<string, string>; host: string }) {
  return (
    <Table>
      <THead>
        <tr>
          <TH>Seite</TH>
          <TH>Adresse</TH>
          <TH>Status</TH>
          <TH>Verlinkt im</TH>
          <TH>Zuletzt geändert</TH>
          <TH>
            <span className="sr-only">Aktionen</span>
          </TH>
        </tr>
      </THead>
      <tbody>
        {pages.map((page) => {
          const editor = page.updatedById ? editors.get(page.updatedById) : undefined;
          return (
            <TR key={page.id}>
              <TD>
                <Link href={`/admin/website/seiten/${page.id}`} className="font-semibold text-ink hover:underline">
                  {page.title}
                </Link>
                {page.usesDefaults ? <span className="block text-xs text-ink-muted">Zeigt den Standardinhalt</span> : null}
              </TD>
              <TD>
                {page.published ? (
                  <a
                    href={page.path}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 font-mono text-[0.8rem] text-brand-700 hover:underline"
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
              <TD>
                <StatusBadges page={page} />
              </TD>
              <TD>
                <LinkedIn page={page} />
              </TD>
              <TD className="whitespace-nowrap">
                {formatDateTime(page.updatedAt)}
                {editor ? <span className="block text-xs text-ink-muted">von {editor}</span> : null}
              </TD>
              <TD className="text-right">
                <ButtonLink href={`/admin/website/seiten/${page.id}`} variant="secondary" size="sm">
                  Bearbeiten<span className="sr-only"> – {page.title}</span>
                </ButtonLink>
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
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
  const notice = typeof hinweis === "string" ? NOTICES[hinweis] : undefined;

  return (
    <>
      <PageHeader
        title="Website"
        description="Texte, Seiten und Bilder der Website pflegen. Änderungen speichern Sie zuerst als Entwurf – auf der Website erscheinen sie erst nach „Veröffentlichen“."
        actions={
          <>
            <ButtonLink href="/admin/website/firmendaten" variant="secondary">
              Firmendaten
            </ButtonLink>
            <ButtonLink href="/admin/website/medien" variant="secondary">
              Medien
            </ButtonLink>
            <ButtonLink href="/admin/website/seiten/neu">
              <Plus className="size-4" aria-hidden />
              Neue Seite
            </ButtonLink>
          </>
        }
      />

      <div className="space-y-8">
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {unfinished.length > 0 ? (
          <Alert tone="warning" title="Die Firmendaten sind noch nicht vollständig">
            <p>
              Noch mit Platzhalter („TODO“): {settingsLabelList(unfinished)}. Diese Angaben erscheinen im Impressum, in der Fußzeile und in
              E-Mails an Kunden.{" "}
              <Link href="/admin/website/firmendaten" className="font-semibold underline underline-offset-2">
                Jetzt ergänzen
              </Link>
            </p>
          </Alert>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardBody>
              <Link href="/admin/website/firmendaten" className="font-semibold text-ink hover:underline">
                Firmendaten
              </Link>
              <p className="mt-0.5 text-sm text-ink-soft">
                Anschrift, Telefon, E-Mail, Öffnungszeiten und Reaktionszeiten – an einer Stelle gepflegt, überall auf der Website verwendet.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Link href="/admin/website/medien" className="font-semibold text-ink hover:underline">
                Medien
              </Link>
              <p className="mt-0.5 text-sm text-ink-soft">
                {mediaCount === 0
                  ? "Noch keine Bilder hochgeladen."
                  : mediaCount === 1
                    ? "1 Bild in der Mediathek."
                    : `${mediaCount} Bilder in der Mediathek.`}{" "}
                Bilder für Kopfbereiche und „Bild und Text“-Module.
              </p>
            </CardBody>
          </Card>
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
                <ButtonLink href="/admin/website/seiten/neu">
                  <Plus className="size-4" aria-hidden />
                  Neue Seite anlegen
                </ButtonLink>
              }
            >
              Legen Sie eine Seite an, wenn ein Thema auf den Kernseiten keinen Platz hat. Sie bestimmen selbst, ob sie im Menü oder im Footer
              erscheint.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}

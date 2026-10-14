import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatFileSize } from "@/lib/format";
import { listMedia, MAX_MEDIA_FILES, MAX_MEDIA_SIZE_LABEL, MEDIA_ACCEPT, MEDIA_TYPES_LABEL } from "@/cms/media";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MediaAltForm, MediaDeleteButton, MediaUploadForm } from "@/components/admin/website/media-library";

export const metadata: Metadata = { title: "Medien" };

const TYPE_LABELS: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP",
  "image/gif": "GIF",
};

export default async function MediaLibraryPage() {
  await requireAdmin();
  const items = await listMedia();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Website", href: "/admin/website" }, { label: "Medien" }]}
        title="Medien"
        description="Bilder für die Website. Im Seiten-Editor wählen Sie sie bei den Modulen „Kopfbereich“ und „Bild und Text“ aus."
      />

      <div className="space-y-8">
        <Card>
          <CardHeader
            title="Bilder hochladen"
            description={`${MEDIA_TYPES_LABEL}, höchstens ${MAX_MEDIA_SIZE_LABEL} pro Bild. SVG-Grafiken sind aus Sicherheitsgründen nicht möglich.`}
          />
          <CardBody>
            <MediaUploadForm
              accept={MEDIA_ACCEPT}
              hint="Tipp: Fotos vorher auf etwa 2000 Pixel Breite verkleinern – das spart Ladezeit."
              maxFiles={MAX_MEDIA_FILES}
            />
          </CardBody>
        </Card>

        <section aria-labelledby="media-list" className="space-y-3">
          <h2 id="media-list" className="text-lg font-bold tracking-tight text-ink">
            Mediathek{" "}
            <span className="text-base font-semibold text-ink-muted">({items.length})</span>
          </h2>

          {items.length === 0 ? (
            <EmptyState title="Noch keine Bilder">
              Laden Sie oben Bilder hoch, z. B. Fotos von Ihrem Team oder Ihren Räumen. Bitte nur eigene Bilder oder solche, für die Sie
              die Nutzungsrechte haben.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <li key={item.id}>
                  <Card className="flex h-full flex-col overflow-hidden">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener"
                      className="group relative block aspect-[4/3] bg-mist"
                      aria-label={`${item.fileName} in voller Größe öffnen (neuer Tab)`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.alt ?? ""} loading="lazy" className="size-full object-contain" />
                      <span className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white/90 text-ink-soft opacity-0 shadow-card transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        <ExternalLink className="size-4" aria-hidden />
                      </span>
                    </a>
                    <div className="flex flex-1 flex-col gap-4 border-t border-line p-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink" title={item.fileName}>
                          {item.fileName}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {TYPE_LABELS[item.mimeType] ?? item.mimeType} · {formatFileSize(item.size)} · hochgeladen am{" "}
                          {formatDate(item.createdAt)}
                        </p>
                      </div>

                      <div className="text-sm">
                        <p className="mb-1 text-xs font-semibold text-ink-soft">Verwendet auf</p>
                        {item.usage.length === 0 ? (
                          <Badge tone="gray">Nicht verwendet</Badge>
                        ) : (
                          <ul className="space-y-1">
                            {item.usage.map((u) => (
                              <li key={u.pageId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <Link href={`/admin/website/seiten/${u.pageId}`} className="font-medium text-brand-700 hover:underline">
                                  {u.title}
                                </Link>
                                {u.live ? <Badge tone="green">Website</Badge> : null}
                                {u.draft ? <Badge tone="amber">Entwurf</Badge> : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <MediaAltForm id={item.id} alt={item.alt} />

                      <div className="mt-auto flex justify-end border-t border-line pt-3">
                        <MediaDeleteButton
                          id={item.id}
                          fileName={item.fileName}
                          usage={item.usage.map((u) => ({ pageId: u.pageId, title: u.title, path: u.path, live: u.live, draft: u.draft }))}
                        />
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

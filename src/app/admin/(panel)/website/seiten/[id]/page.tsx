import { portalHost } from "@/lib/hosts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { rootDomain } from "@/lib/hosts";
import { getSiteSettings } from "@/lib/settings";
import { getPageForEditing, listPages } from "@/cms/store";
import { MAX_MEDIA_SIZE_LABEL, MEDIA_ACCEPT, MEDIA_TYPES_LABEL, mediaUrl } from "@/cms/media";
import { PageEditor } from "@/components/admin/website/page-editor";
import { PageSettingsForm } from "@/components/admin/website/page-settings-form";
import type { LinkTarget, MediaItem, PlaceholderInfo } from "@/components/admin/website/types";

export const metadata: Metadata = { title: "Seite bearbeiten" };

export default async function EditWebsitePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ neu?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { neu } = await searchParams;
  const page = await getPageForEditing(id);
  if (!page) notFound();

  const [files, settings, pages] = await Promise.all([
    db.mediaFile.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, alt: true } }),
    getSiteSettings(),
    listPages(),
  ]);

  const media: MediaItem[] = files.map((f) => ({ id: f.id, url: mediaUrl(f.id), fileName: f.fileName, alt: f.alt }));

  const anchors = page.content.blocks
    .filter((b) => b.anchor)
    .map((b) => ({ value: `#${b.anchor}`, label: "Abschnitt auf dieser Seite" }));
  const linkTargets: LinkTarget[] = [
    ...pages.filter((p) => p.published).map((p) => ({ value: p.path, label: p.title })),
    ...anchors,
    { value: "/login", label: "Anmeldung zum Kundenportal" },
    { value: "{fernwartung}", label: "Fernwartung (Link aus den Firmendaten)" },
    ...(settings.phoneHref ? [{ value: `tel:${settings.phoneHref}`, label: "Anrufen" }] : []),
    ...(settings.email ? [{ value: `mailto:${settings.email}`, label: "E-Mail schreiben" }] : []),
  ];
  const uniqueTargets = [...new Map(linkTargets.map((t) => [t.value, t])).values()];

  const address = [settings.street, [settings.zip, settings.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const placeholders: PlaceholderInfo[] = [
    { token: "{firma}", label: "Name der Firma (Kurzname)", value: settings.name },
    { token: "{telefon}", label: "Telefonnummer", value: settings.phone },
    { token: "{email}", label: "E-Mail-Adresse", value: settings.email },
    { token: "{support_email}", label: "E-Mail-Adresse für den Support", value: settings.supportEmail },
    { token: "{region}", label: "Einsatzgebiet", value: settings.region },
    { token: "{adresse}", label: "Anschrift", value: address },
    { token: "{firmierung}", label: "Vollständige Firmierung (z. B. in AGB und Datenschutz)", value: settings.legalName },
    { token: "{hosting}", label: "Hosting-Anbieter (Datenschutzerklärung)", value: settings.hostingProvider },
    { token: "{log_tage}", label: "Speicherdauer der Server-Logs in Tagen", value: String(settings.logRetentionDays) },
    { token: "{portal_beispiel}", label: "Beispieladresse eines Kundenportals", value: portalHost("ihrefirma") },
    { token: "{fernwartung}", label: "Nur als Link-Ziel: Link zur Fernwartung", value: settings.remoteSupportUrl },
  ];

  const siteHost = rootDomain();

  return (
    <PageEditor
      key={page.id}
      page={{
        id: page.id,
        slug: page.slug,
        path: page.path,
        system: page.system,
        published: page.published,
        publishedAt: page.publishedAt?.toISOString() ?? null,
        hasDraft: page.hasDraft,
        updatedAt: page.updatedAt.toISOString(),
        usesDefaults: page.usesDefaults,
      }}
      initial={page.content}
      media={media}
      linkTargets={uniqueTargets}
      placeholders={placeholders}
      siteHost={siteHost}
      isNew={neu === "1"}
      mediaAccept={MEDIA_ACCEPT}
      mediaUploadHint={`${MEDIA_TYPES_LABEL}, höchstens ${MAX_MEDIA_SIZE_LABEL}.`}
      settings={
        <PageSettingsForm
          siteHost={siteHost}
          page={{
            id: page.id,
            slug: page.slug,
            title: page.title,
            navLabel: page.navLabel,
            showInNav: page.showInNav,
            showInFooter: page.showInFooter,
            navOrder: page.navOrder,
            published: page.published,
            system: page.system,
            everPublished: page.publishedAt !== null,
          }}
        />
      }
    />
  );
}

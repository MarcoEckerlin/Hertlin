import "server-only";
import { cache } from "react";
import { Prisma, type Page } from "@prisma/client";
import type { z } from "zod";
import { db } from "@/lib/db";
import { getDefaultPage, type DefaultPage } from "@/cms/defaults";
import {
  PAGE_SLUG_PATTERN,
  RESERVED_PAGE_SLUGS,
  SYSTEM_PAGE_SLUGS,
  newBlockId,
  pageDraftSchema,
  pageMetaSchema,
  parseBlocks,
  type Block,
  type PageDraft,
} from "@/cms/schema";

/**
 * Speicherung der Website-Seiten (Content-Management).
 *
 * - Page.blocks enthält die veröffentlichten Module, Page.draft den Entwurf { title, description, blocks }.
 * - Kernseiten (SYSTEM_PAGE_SLUGS) gibt es immer. Solange eine Kernseite noch nie im Editor veröffentlicht
 *   wurde (publishedAt = null), zeigt die Website Titel, Beschreibung und Module aus src/cms/defaults.ts.
 *   So kommen spätere Verbesserungen der Standardtexte automatisch an, bis jemand die Seite selbst pflegt.
 * - Menü-Einstellungen (navLabel, showInNav, showInFooter, navOrder, published) gelten sofort.
 */

export type PageMeta = z.infer<typeof pageMetaSchema>;

/** Fehler mit verständlicher Meldung für die Verwaltung. */
export class CmsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CmsError";
  }
}

const SYSTEM_SLUGS: ReadonlySet<string> = new Set<string>(SYSTEM_PAGE_SLUGS);

export function isSystemSlug(slug: string): boolean {
  return SYSTEM_SLUGS.has(slug);
}

/** Pfad auf der Website: "" → "/", "agb" → "/agb" */
export function pagePath(slug: string): string {
  return slug ? `/${slug}` : "/";
}

/** "/agb/" → "agb", "/" → "" */
export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
}

/** Prüft nur das Format einer Seitenadresse. Gibt eine Fehlermeldung oder null zurück. */
export function slugFormatError(slug: string): string | null {
  if (!slug) return "Bitte eine Adresse angeben.";
  if (slug.length > 60) return "Die Adresse darf höchstens 60 Zeichen lang sein.";
  if (!PAGE_SLUG_PATTERN.test(slug)) {
    return "Nur Kleinbuchstaben, Ziffern und Bindestriche verwenden (nicht am Anfang oder Ende), z. B. „stellenangebote“.";
  }
  if (RESERVED_PAGE_SLUGS.has(slug)) return "Diese Adresse wird von der Anwendung selbst verwendet. Bitte eine andere wählen.";
  if (isSystemSlug(slug)) return "Diese Adresse gehört zu einer Kernseite. Bitte eine andere wählen.";
  return null;
}

/** Prüft Format und Verfügbarkeit einer Adresse. exceptId: die Seite selbst (beim Umbenennen). */
export async function slugError(slug: string, exceptId?: string): Promise<string | null> {
  const formatError = slugFormatError(slug);
  if (formatError) return formatError;
  const existing = await db.page.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== exceptId) return "Unter dieser Adresse gibt es schon eine Seite.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Inhalte lesen                                                       */
/* ------------------------------------------------------------------ */

type Content = { title: string; description: string | null; blocks: Block[] };

/** Module der Vorgabe, durch das Schema normalisiert (Standardwerte ergänzt, Ungültiges entfernt). */
function defaultBlocks(def: DefaultPage): Block[] {
  return parseBlocks(JSON.stringify(def.blocks));
}

/** Kernseite, die noch nie im Editor veröffentlicht wurde: Inhalte kommen aus den Vorgaben. */
function usesDefaults(page: Pick<Page, "system" | "publishedAt" | "slug">): boolean {
  return page.system && !page.publishedAt && getDefaultPage(page.slug) !== null;
}

/** Veröffentlichter Inhalt einer Seite (inkl. ausgeblendeter Module). */
function liveContent(page: Pick<Page, "slug" | "system" | "publishedAt" | "title" | "description" | "blocks">): Content {
  if (usesDefaults(page)) {
    const def = getDefaultPage(page.slug)!;
    return { title: def.title || page.title, description: def.description ?? page.description, blocks: defaultBlocks(def) };
  }
  return { title: page.title, description: page.description, blocks: parseBlocks(page.blocks) };
}

/** Liest einen gespeicherten Entwurf robust ein (ungültige Module werden übersprungen). */
function parseDraft(json: string | null, fallbackTitle: string): PageDraft | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = pageDraftSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 120) : fallbackTitle;
  const description = typeof r.description === "string" && r.description.trim() ? r.description.trim().slice(0, 300) : undefined;
  return { title, description, blocks: parseBlocks(JSON.stringify(Array.isArray(r.blocks) ? r.blocks : [])) };
}

function toDraft(content: Content): PageDraft {
  return { title: content.title, description: content.description || undefined, blocks: content.blocks };
}

/** Vergleicht zwei Inhalte nach Normalisierung durch das Schema. */
function sameContent(a: PageDraft, b: PageDraft): boolean {
  const na = pageDraftSchema.safeParse(a);
  const nb = pageDraftSchema.safeParse(b);
  if (!na.success || !nb.success) return false;
  return JSON.stringify(na.data) === JSON.stringify(nb.data);
}

export type PageSummary = {
  id: string;
  slug: string;
  path: string;
  title: string;
  description: string | null;
  navLabel: string | null;
  showInNav: boolean;
  showInFooter: boolean;
  navOrder: number;
  system: boolean;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  updatedById: string | null;
  /** Es gibt einen gespeicherten Entwurf mit Änderungen gegenüber der Website */
  hasDraft: boolean;
  /** Kernseite zeigt noch die mitgelieferten Standardinhalte */
  usesDefaults: boolean;
};

export type EditablePage = PageSummary & {
  /** Veröffentlichter Stand */
  live: PageDraft;
  /** Gespeicherter Entwurf oder null */
  draft: PageDraft | null;
  /** Ausgangspunkt für den Editor: Entwurf, sonst veröffentlichter Stand */
  content: PageDraft;
};

export type PublishedPage = {
  /** null, wenn die Seite noch nicht in der Datenbank liegt (Vorgabe aus defaults.ts) */
  id: string | null;
  slug: string;
  path: string;
  title: string;
  description: string | null;
  /** Nur sichtbare Module (ausgeblendete sind bereits entfernt) */
  blocks: Block[];
  system: boolean;
  updatedAt: Date | null;
};

export type PreviewPage = {
  id: string;
  slug: string;
  path: string;
  title: string;
  description: string | null;
  /** Alle Module des Entwurfs (bzw. des veröffentlichten Stands), inkl. ausgeblendeter (Feld hidden) */
  blocks: Block[];
  /** true: zeigt einen Entwurf, der noch nicht veröffentlicht ist */
  isDraft: boolean;
  published: boolean;
};

function summarize(page: Page): PageSummary {
  const live = liveContent(page);
  return {
    id: page.id,
    slug: page.slug,
    path: pagePath(page.slug),
    title: live.title,
    description: live.description,
    navLabel: page.navLabel,
    showInNav: page.showInNav,
    showInFooter: page.showInFooter,
    navOrder: page.navOrder,
    system: page.system,
    published: page.system ? true : page.published,
    publishedAt: page.publishedAt,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
    updatedById: page.updatedById,
    hasDraft: page.draft !== null,
    usesDefaults: usesDefaults(page),
  };
}

function systemIndex(slug: string): number {
  const i = (SYSTEM_PAGE_SLUGS as readonly string[]).indexOf(slug);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

/** Alle Seiten für die Verwaltung: Kernseiten in fester Reihenfolge, danach eigene Seiten. */
export async function listPages(): Promise<PageSummary[]> {
  const pages = await db.page.findMany();
  return pages
    .map(summarize)
    .sort((a, b) => {
      if (a.system !== b.system) return a.system ? -1 : 1;
      if (a.system) return systemIndex(a.slug) - systemIndex(b.slug);
      return a.navOrder - b.navOrder || a.title.localeCompare(b.title, "de");
    });
}

export async function getPageForEditing(id: string): Promise<EditablePage | null> {
  if (!id || id.length > 40) return null;
  const page = await db.page.findUnique({ where: { id } });
  if (!page) return null;
  const summary = summarize(page);
  const live = toDraft(liveContent(page));
  const draft = parseDraft(page.draft, live.title);
  return { ...summary, live, draft, content: draft ?? live };
}

/** Veröffentlichte Seite für die Website. Kernseiten ohne Datenbankeintrag kommen aus den Vorgaben. */
export const getPublishedPage = cache(async (slug: string): Promise<PublishedPage | null> => {
  const s = normalizeSlug(slug);
  const page = await db.page.findUnique({ where: { slug: s } });
  if (page) {
    if (!page.system && !page.published) return null;
    const live = liveContent(page);
    return {
      id: page.id,
      slug: page.slug,
      path: pagePath(page.slug),
      title: live.title,
      description: live.description,
      blocks: live.blocks.filter((b) => !b.hidden),
      system: page.system,
      updatedAt: page.updatedAt,
    };
  }
  if (!isSystemSlug(s)) return null;
  const def = getDefaultPage(s);
  if (!def) return null;
  return {
    id: null,
    slug: s,
    path: pagePath(s),
    title: def.title,
    description: def.description ?? null,
    blocks: defaultBlocks(def).filter((b) => !b.hidden),
    system: true,
    updatedAt: null,
  };
});

/** Entwurf (falls vorhanden) bzw. veröffentlichter Stand für die Vorschau in der Verwaltung. Rechte vorher prüfen! */
export async function getPreviewPage(id: string): Promise<PreviewPage | null> {
  const page = await getPageForEditing(id);
  if (!page) return null;
  return {
    id: page.id,
    slug: page.slug,
    path: page.path,
    title: page.content.title,
    description: page.content.description ?? null,
    blocks: page.content.blocks,
    isDraft: page.draft !== null || !page.published,
    published: page.published,
  };
}

/** Pfade aller öffentlich erreichbaren Seiten, z. B. für die Sitemap. */
export type PublishedPath = { path: string; updatedAt: Date | null; system: boolean };

export async function listPublishedPaths(): Promise<PublishedPath[]> {
  const pages = await db.page.findMany({ select: { slug: true, system: true, published: true, updatedAt: true } });
  const seen = new Set(pages.map((p) => p.slug));
  const out: PublishedPath[] = pages
    .filter((p) => p.system || p.published)
    .map((p) => ({ path: pagePath(p.slug), updatedAt: p.updatedAt, system: p.system }));
  for (const slug of SYSTEM_PAGE_SLUGS) {
    if (!seen.has(slug) && getDefaultPage(slug)) out.push({ path: pagePath(slug), updatedAt: null, system: true });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export type NavLink = { href: string; label: string };
export type Navigation = { main: NavLink[]; footer: NavLink[] };

type NavEntry = { slug: string; label: string; showInNav: boolean; showInFooter: boolean; navOrder: number };

/** Hauptmenü und Footer aus den veröffentlichten Seiten. Fehlende Kernseiten kommen aus den Vorgaben. */
export const getNavigation = cache(async (): Promise<Navigation> => {
  // Fällt die Datenbank aus, bleibt die Website mit dem Standardmenü bedienbar
  const pages = await db.page
    .findMany({
      select: {
        slug: true,
        title: true,
        navLabel: true,
        showInNav: true,
        showInFooter: true,
        navOrder: true,
        published: true,
        system: true,
        publishedAt: true,
      },
    })
    .catch((error: unknown) => {
      console.error("[cms] Navigation konnte nicht geladen werden:", error instanceof Error ? error.message : error);
      return [];
    });

  const entries: NavEntry[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    seen.add(p.slug);
    if (!p.system && !p.published) continue;
    if (!p.showInNav && !p.showInFooter) continue;
    const title = usesDefaults(p) ? (getDefaultPage(p.slug)?.title ?? p.title) : p.title;
    entries.push({
      slug: p.slug,
      label: p.navLabel?.trim() || title,
      showInNav: p.showInNav,
      showInFooter: p.showInFooter,
      navOrder: p.navOrder,
    });
  }
  for (const slug of SYSTEM_PAGE_SLUGS) {
    if (seen.has(slug)) continue;
    const def = getDefaultPage(slug);
    if (!def || (!def.showInNav && !def.showInFooter)) continue;
    entries.push({
      slug,
      label: def.navLabel?.trim() || def.title,
      showInNav: def.showInNav,
      showInFooter: def.showInFooter,
      navOrder: def.navOrder,
    });
  }

  entries.sort((a, b) => a.navOrder - b.navOrder || a.label.localeCompare(b.label, "de"));
  const link = (e: NavEntry): NavLink => ({ href: pagePath(e.slug), label: e.label });
  return {
    main: entries.filter((e) => e.showInNav).map(link),
    footer: entries.filter((e) => e.showInFooter).map(link),
  };
});

/* ------------------------------------------------------------------ */
/* Schreiben                                                           */
/* ------------------------------------------------------------------ */

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Legt fehlende Kernseiten mit den Vorgaben an (veröffentlicht, Module aus defaults.ts).
 * Idempotent; bestehende Seiten bleiben unverändert. Gibt die Zahl neu angelegter Seiten zurück.
 */
export async function ensureSystemPages(): Promise<number> {
  const existing = await db.page.findMany({
    where: { slug: { in: [...SYSTEM_PAGE_SLUGS] } },
    select: { slug: true },
  });
  const have = new Set(existing.map((p) => p.slug));
  let created = 0;
  for (const slug of SYSTEM_PAGE_SLUGS) {
    if (have.has(slug)) continue;
    const def = getDefaultPage(slug);
    try {
      await db.page.create({
        data: {
          slug,
          title: def?.title ?? (slug || "Startseite"),
          description: def?.description ?? null,
          navLabel: def?.navLabel ?? null,
          showInNav: def?.showInNav ?? false,
          showInFooter: def?.showInFooter ?? false,
          navOrder: def?.navOrder ?? 100,
          system: true,
          published: true,
          blocks: JSON.stringify(def ? defaultBlocks(def) : []),
        },
      });
      created++;
    } catch (error) {
      // Gleichzeitiger Aufruf hat die Seite schon angelegt
      if (!isUniqueViolation(error)) throw error;
    }
  }
  return created;
}

async function loadPage(id: string): Promise<Page> {
  const page = id && id.length <= 40 ? await db.page.findUnique({ where: { id } }) : null;
  if (!page) throw new CmsError("Diese Seite gibt es nicht mehr. Bitte laden Sie die Übersicht neu.");
  return page;
}

export type SaveDraftResult = { hasDraft: boolean; updatedAt: Date };

/**
 * Speichert einen Entwurf. Entspricht er genau dem veröffentlichten Stand, wird kein Entwurf gespeichert
 * (es gibt dann nichts zu veröffentlichen).
 */
export async function saveDraft(id: string, input: PageDraft, userId?: string | null): Promise<SaveDraftResult> {
  const draft = pageDraftSchema.parse(input);
  const page = await loadPage(id);
  const live = toDraft(liveContent(page));
  // Eigene Seiten, die noch nie veröffentlicht wurden, haben ihren Inhalt nur im Entwurf.
  const unchanged = sameContent(draft, live) && (page.system || page.publishedAt !== null);
  const updated = await db.page.update({
    where: { id },
    data: { draft: unchanged ? null : JSON.stringify(draft), updatedById: userId ?? null },
    select: { draft: true, updatedAt: true },
  });
  return { hasDraft: updated.draft !== null, updatedAt: updated.updatedAt };
}

export type PublishResult = { published: boolean; publishedAt: Date; updatedAt: Date };

/** Entwurf → Website: Titel, Beschreibung und Module übernehmen, Entwurf leeren. */
export async function publish(id: string, userId?: string | null): Promise<PublishResult> {
  const page = await loadPage(id);
  const content = parseDraft(page.draft, page.title) ?? toDraft(liveContent(page));
  const checked = pageDraftSchema.parse(content);
  // Neue Seiten werden beim ersten Veröffentlichen sichtbar; bewusst ausgeblendete bleiben ausgeblendet.
  const published = page.system ? true : page.publishedAt ? page.published : true;
  const updated = await db.page.update({
    where: { id },
    data: {
      title: checked.title,
      description: checked.description ?? null,
      blocks: JSON.stringify(checked.blocks),
      draft: null,
      published,
      publishedAt: new Date(),
      updatedById: userId ?? null,
    },
    select: { published: true, publishedAt: true, updatedAt: true },
  });
  return { published: updated.published, publishedAt: updated.publishedAt ?? new Date(), updatedAt: updated.updatedAt };
}

/** Verwirft den Entwurf und gibt den veröffentlichten Stand zurück. */
export async function discardDraft(id: string, userId?: string | null): Promise<{ content: PageDraft; updatedAt: Date }> {
  const page = await loadPage(id);
  const updated = await db.page.update({
    where: { id },
    data: { draft: null, updatedById: userId ?? null },
    select: { updatedAt: true },
  });
  return { content: toDraft(liveContent(page)), updatedAt: updated.updatedAt };
}

export type CreatePageInput = {
  slug: string;
  title: string;
  description?: string;
  navLabel?: string;
  showInNav?: boolean;
  showInFooter?: boolean;
  navOrder?: number;
  /** Start-Module des Entwurfs; Standard: Kopfbereich + Text */
  blocks?: Block[];
};

/** Start-Module für neue Seiten: Kopfbereich mit dem Seitentitel und ein Textabschnitt. */
export function starterBlocks(title: string): Block[] {
  return [
    { id: newBlockId(), type: "hero", title, visual: "none", tone: "blue" },
    { id: newBlockId(), type: "text", body: "", width: "narrow", tone: "white" },
  ];
}

/** Legt eine eigene Seite an (noch nicht veröffentlicht, Inhalt als Entwurf). Gibt die id zurück. */
export async function createPage(input: CreatePageInput, userId?: string | null): Promise<string> {
  const slug = normalizeSlug(input.slug);
  const error = await slugError(slug);
  if (error) throw new CmsError(error);
  const meta = pageMetaSchema.parse({
    title: input.title,
    description: input.description || undefined,
    navLabel: input.navLabel || undefined,
    showInNav: input.showInNav ?? false,
    showInFooter: input.showInFooter ?? false,
    navOrder: input.navOrder ?? 100,
  });
  const draft = pageDraftSchema.parse({
    title: meta.title,
    description: meta.description,
    blocks: input.blocks ?? starterBlocks(meta.title),
  });
  try {
    const page = await db.page.create({
      data: {
        slug,
        title: meta.title,
        description: meta.description ?? null,
        navLabel: meta.navLabel ?? null,
        showInNav: meta.showInNav,
        showInFooter: meta.showInFooter,
        navOrder: meta.navOrder,
        system: false,
        published: false,
        blocks: "[]",
        draft: JSON.stringify(draft),
        updatedById: userId ?? null,
      },
      select: { id: true },
    });
    return page.id;
  } catch (e) {
    if (isUniqueViolation(e)) throw new CmsError("Unter dieser Adresse gibt es schon eine Seite.");
    throw e;
  }
}

/** Löscht eine eigene Seite. Kernseiten lassen sich nicht löschen. */
export async function deletePage(id: string): Promise<{ slug: string; title: string }> {
  const page = await loadPage(id);
  if (page.system) throw new CmsError("Kernseiten wie Startseite, Impressum oder Datenschutz lassen sich nicht löschen.");
  await db.page.delete({ where: { id } });
  return { slug: page.slug, title: page.title };
}

export type MetaUpdate = Partial<PageMeta> & {
  /** Nur eigene Seiten lassen sich ausblenden */
  published?: boolean;
  /** Nur eigene Seiten können ihre Adresse ändern */
  slug?: string;
};

/**
 * Ändert Einstellungen einer Seite sofort (ohne Veröffentlichen). Nicht übergebene Felder bleiben unverändert.
 * Titel und Beschreibung werden hier nur geändert, wenn sie ausdrücklich übergeben werden; im Editor gehören
 * sie zum Entwurf.
 */
export async function updateMeta(id: string, meta: MetaUpdate, userId?: string | null): Promise<void> {
  const page = await loadPage(id);
  // Achtung: partial() wendet Standardwerte trotzdem an – deshalb unten auf die übergebenen Schlüssel prüfen.
  const parsed = pageMetaSchema.partial().parse(meta);
  const data: Prisma.PageUpdateInput = { updatedById: userId ?? null };

  if (meta.title !== undefined && parsed.title !== undefined) data.title = parsed.title;
  if ("description" in meta) data.description = parsed.description || null;
  if ("navLabel" in meta) data.navLabel = parsed.navLabel || null;
  if (meta.showInNav !== undefined) data.showInNav = parsed.showInNav;
  if (meta.showInFooter !== undefined) data.showInFooter = parsed.showInFooter;
  if (meta.navOrder !== undefined) data.navOrder = parsed.navOrder;

  if (meta.published !== undefined && !page.system) {
    if (meta.published && !page.publishedAt) {
      throw new CmsError("Die Seite wurde noch nie veröffentlicht. Bitte zuerst im Editor auf „Veröffentlichen“ klicken.");
    }
    data.published = meta.published;
  }

  if (meta.slug !== undefined) {
    const slug = normalizeSlug(meta.slug);
    if (slug !== page.slug) {
      if (page.system) throw new CmsError("Die Adresse einer Kernseite lässt sich nicht ändern.");
      const error = await slugError(slug, page.id);
      if (error) throw new CmsError(error);
      data.slug = slug;
    }
  }

  try {
    await db.page.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueViolation(e)) throw new CmsError("Unter dieser Adresse gibt es schon eine Seite.");
    throw e;
  }
}

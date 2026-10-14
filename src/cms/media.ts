import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import type { MediaFile } from "@prisma/client";
import { db } from "@/lib/db";
import { UPLOAD_DIR } from "@/lib/uploads";
import { CmsError, pagePath } from "@/cms/store";
import { formatFileSize } from "@/lib/format";

/**
 * Bilder für die Website (Mediathek). Gespeichert außerhalb von public/ in UPLOAD_DIR/media,
 * öffentlich ausgeliefert über /medien/<id>.
 * Erlaubt sind nur Rasterbilder (PNG, JPEG, WebP, GIF). SVG ist ausgeschlossen, weil es Skripte enthalten kann.
 * Der Dateityp wird am Inhalt erkannt, nicht an der Endung.
 */

export const MEDIA_DIR = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, "media");
export const MAX_MEDIA_SIZE = 5 * 1024 * 1024;
export const MAX_MEDIA_FILES = 10;
export const MEDIA_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif";
export const MEDIA_TYPES_LABEL = "PNG, JPG, WebP oder GIF";
export const MAX_MEDIA_SIZE_LABEL = formatFileSize(MAX_MEDIA_SIZE);

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

type ImageKind = { mimeType: string; ext: string };

/** Erkennt das Bildformat an den ersten Bytes der Datei. */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  const at = (i: number) => bytes[i];
  const ascii = (start: number, text: string) => [...text].every((c, i) => at(start + i) === c.charCodeAt(0));
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)) {
    return { mimeType: "image/png", ext: ".png" };
  }
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { mimeType: "image/jpeg", ext: ".jpg" };
  }
  if (bytes.length >= 6 && (ascii(0, "GIF87a") || ascii(0, "GIF89a"))) {
    return { mimeType: "image/gif", ext: ".gif" };
  }
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    return { mimeType: "image/webp", ext: ".webp" };
  }
  return null;
}

function safeFileName(name: string): string {
  const base = path
    .basename(name)
    .replace(/[\u0000-\u001f"\\/<>:|?*]+/g, "_")
    .trim();
  return base.slice(0, 180) || "bild";
}

/** Prüft Endung und Größe (der Inhalt wird beim Speichern geprüft). Gibt eine Fehlermeldung oder null zurück. */
export function validateMediaFiles(files: File[]): string | null {
  if (files.length === 0) return "Bitte wählen Sie ein Bild aus.";
  if (files.length > MAX_MEDIA_FILES) return `Bitte höchstens ${MAX_MEDIA_FILES} Bilder auf einmal hochladen.`;
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (ext === ".svg" || file.type === "image/svg+xml") {
      return `„${file.name}“ ist eine SVG-Grafik. SVG-Dateien sind aus Sicherheitsgründen nicht erlaubt – bitte als PNG speichern.`;
    }
    if (!ALLOWED_EXTENSIONS.has(ext)) return `„${file.name}“ hat kein unterstütztes Format (erlaubt: ${MEDIA_TYPES_LABEL}).`;
    if (file.size > MAX_MEDIA_SIZE) return `„${file.name}“ ist größer als ${MAX_MEDIA_SIZE_LABEL}. Bitte verkleinern Sie das Bild.`;
    if (file.size === 0) return `„${file.name}“ ist leer.`;
  }
  return null;
}

/** Speichert ein Bild und legt den Datensatz an. Wirft CmsError mit verständlicher Meldung. */
export async function storeMedia(file: File, opts: { alt?: string | null; uploadedById?: string | null } = {}): Promise<MediaFile> {
  const error = validateMediaFiles([file]);
  if (error) throw new CmsError(error);
  const data = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(data);
  if (!kind) throw new CmsError(`„${file.name}“ ist keine gültige Bilddatei (erlaubt: ${MEDIA_TYPES_LABEL}).`);

  await mkdir(MEDIA_DIR, { recursive: true });
  const storedName = `${randomBytes(16).toString("hex")}${kind.ext}`;
  await writeFile(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, storedName), data);
  try {
    return await db.mediaFile.create({
      data: {
        fileName: safeFileName(file.name),
        storedName,
        mimeType: kind.mimeType,
        size: data.byteLength,
        alt: opts.alt?.trim() ? opts.alt.trim().slice(0, 200) : null,
        uploadedById: opts.uploadedById ?? null,
      },
    });
  } catch (e) {
    await unlink(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, storedName)).catch(() => undefined);
    throw e;
  }
}

export function mediaUrl(id: string): string {
  return `/medien/${id}`;
}

/* ------------------------------------------------------------------ */
/* Verwendung auf Seiten                                               */
/* ------------------------------------------------------------------ */

export type MediaUsage = {
  pageId: string;
  title: string;
  path: string;
  /** auf der Website sichtbar (veröffentlichter Stand) */
  live: boolean;
  /** im gespeicherten Entwurf */
  draft: boolean;
};

/** Sammelt alle Werte von "imageId" in beliebig verschachteltem JSON. */
function collectImageIds(json: string | null, into: Set<string>): void {
  if (!json) return;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return;
  }
  const walk = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === "object") {
      for (const [key, v] of Object.entries(value)) {
        if (key === "imageId" && typeof v === "string" && v) into.add(v);
        else walk(v);
      }
    }
  };
  walk(raw);
}

/** Wo wird welches Bild verwendet? Map mediaId → Seiten. */
export async function findMediaUsage(): Promise<Map<string, MediaUsage[]>> {
  const pages = await db.page.findMany({ select: { id: true, slug: true, title: true, blocks: true, draft: true } });
  const usage = new Map<string, MediaUsage[]>();
  for (const page of pages) {
    const live = new Set<string>();
    const draft = new Set<string>();
    collectImageIds(page.blocks, live);
    collectImageIds(page.draft, draft);
    for (const id of new Set([...live, ...draft])) {
      const list = usage.get(id) ?? [];
      list.push({ pageId: page.id, title: page.title, path: pagePath(page.slug), live: live.has(id), draft: draft.has(id) });
      usage.set(id, list);
    }
  }
  return usage;
}

export type MediaListItem = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  alt: string | null;
  createdAt: Date;
  usage: MediaUsage[];
};

export async function listMedia(): Promise<MediaListItem[]> {
  const [files, usage] = await Promise.all([db.mediaFile.findMany({ orderBy: { createdAt: "desc" } }), findMediaUsage()]);
  return files.map((f) => ({
    id: f.id,
    url: mediaUrl(f.id),
    fileName: f.fileName,
    mimeType: f.mimeType,
    size: f.size,
    alt: f.alt,
    createdAt: f.createdAt,
    usage: usage.get(f.id) ?? [],
  }));
}

export async function updateMediaAlt(id: string, alt: string | null): Promise<void> {
  const file = await db.mediaFile.findUnique({ where: { id }, select: { id: true } });
  if (!file) throw new CmsError("Dieses Bild gibt es nicht mehr.");
  await db.mediaFile.update({ where: { id }, data: { alt: alt?.trim() ? alt.trim().slice(0, 200) : null } });
}

/** Entfernt alle Verweise auf ein Bild (imageId) aus JSON. Gibt null zurück, wenn nichts geändert wurde. */
function stripImageId(json: string | null, mediaId: string): string | null {
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  let changed = false;
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, v] of Object.entries(value)) {
        if (key === "imageId" && v === mediaId) {
          changed = true;
          continue;
        }
        out[key] = walk(v);
      }
      return out;
    }
    return value;
  };
  const result = walk(raw);
  return changed ? JSON.stringify(result) : null;
}

/**
 * Löscht ein Bild. Wird es noch verwendet, nur mit force: Die Verweise werden dann aus den Seiten entfernt
 * (das Bild verschwindet dort, der übrige Inhalt bleibt).
 */
export async function deleteMedia(id: string, opts: { force?: boolean; userId?: string | null } = {}): Promise<{ removedFrom: number }> {
  const file = await db.mediaFile.findUnique({ where: { id } });
  if (!file) throw new CmsError("Dieses Bild gibt es nicht mehr.");
  const usage = (await findMediaUsage()).get(id) ?? [];
  if (usage.length > 0 && !opts.force) {
    throw new CmsError(`Das Bild wird noch auf ${usage.length === 1 ? "einer Seite" : `${usage.length} Seiten`} verwendet.`);
  }

  for (const u of usage) {
    const page = await db.page.findUnique({ where: { id: u.pageId }, select: { blocks: true, draft: true } });
    if (!page) continue;
    const blocks = stripImageId(page.blocks, id);
    const draft = stripImageId(page.draft, id);
    if (blocks === null && draft === null) continue;
    await db.page.update({
      where: { id: u.pageId },
      data: {
        ...(blocks !== null ? { blocks } : {}),
        ...(draft !== null ? { draft } : {}),
        updatedById: opts.userId ?? null,
      },
    });
  }

  await db.mediaFile.delete({ where: { id } });
  await unlink(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, path.basename(file.storedName))).catch(() => undefined);
  return { removedFrom: usage.length };
}

/* ------------------------------------------------------------------ */
/* Auslieferung                                                        */
/* ------------------------------------------------------------------ */

/** Antwort für /medien/<id>: Bild mit langem Cache (die id ändert sich bei jedem Hochladen). */
export async function mediaResponse(file: Pick<MediaFile, "fileName" | "storedName" | "mimeType">): Promise<Response> {
  let data: Buffer;
  try {
    data = await readFile(path.join(/*turbopackIgnore: true*/ MEDIA_DIR, path.basename(file.storedName)));
  } catch {
    return new Response("Nicht gefunden", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const encoded = encodeURIComponent(file.fileName);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `inline; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

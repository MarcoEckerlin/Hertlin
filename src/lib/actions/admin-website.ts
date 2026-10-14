"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { checkbox, optionalText, requiredText, trimmed } from "@/lib/validation";
import { formatDateTime } from "@/lib/format";
import { TICKET_PRIORITIES } from "@/lib/constants";
import { saveSiteSettings } from "@/lib/settings";
import { pageDraftSchema } from "@/cms/schema";
import { CmsError, createPage, deletePage, discardDraft, normalizeSlug, publish, saveDraft, slugError, updateMeta } from "@/cms/store";
import { deleteMedia, MAX_MEDIA_FILES, storeMedia, updateMediaAlt, validateMediaFiles } from "@/cms/media";
import { issuesFromZod } from "@/components/admin/website/issues";
import { normalizeUnknownDraft } from "@/components/admin/website/draft-utils";
import type { ActionResult, DiscardResult, SaveOptions, SaveResult } from "@/components/admin/website/types";

/* ------------------------------------------------------------------ */
/* Hilfen                                                              */
/* ------------------------------------------------------------------ */

const GENERIC_ERROR = "Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal.";

function messageOf(error: unknown): string {
  if (error instanceof CmsError) return error.message;
  console.error("[website]", error instanceof Error ? error.message : error);
  return GENERIC_ERROR;
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 40 && /^[a-z0-9]+$/i.test(id);
}

function revalidateWebsite() {
  // Website, Navigation und Footer sofort aktualisieren (auch die Verwaltungsseiten)
  revalidatePath("/", "layout");
}

/**
 * Wurde die Seite inzwischen von jemand anderem geändert? Dann nicht stillschweigend überschreiben.
 * Gibt ein Fehlerergebnis zurück oder null, wenn gespeichert werden darf.
 */
async function conflictCheck(pageId: string, userId: string, options?: SaveOptions): Promise<SaveResult | null> {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { updatedAt: true, updatedById: true } });
  if (!page) return { ok: false, message: "Diese Seite gibt es nicht mehr. Bitte öffnen Sie die Übersicht neu." };
  if (options?.force || !options?.baseUpdatedAt) return null;
  const base = new Date(options.baseUpdatedAt);
  if (Number.isNaN(base.getTime())) return null;
  if (page.updatedAt.getTime() <= base.getTime() || page.updatedById === userId) return null;
  const other = page.updatedById
    ? await db.user.findUnique({ where: { id: page.updatedById }, select: { name: true } })
    : null;
  return {
    ok: false,
    conflict: true,
    message: `${other?.name ?? "Jemand anderes"} hat diese Seite zwischenzeitlich geändert (${formatDateTime(page.updatedAt)}). Wenn Sie jetzt speichern, werden diese Änderungen überschrieben.`,
  };
}

function parseDraftInput(draft: unknown) {
  return pageDraftSchema.safeParse(normalizeUnknownDraft(draft));
}

async function pageState(pageId: string) {
  return db.page.findUnique({ where: { id: pageId }, select: { published: true, system: true, publishedAt: true } });
}

/* ------------------------------------------------------------------ */
/* Seiten                                                              */
/* ------------------------------------------------------------------ */

const newPageSchema = z.object({
  title: requiredText("einen Seitentitel", 120),
  slug: z.string({ error: "Bitte eine Adresse angeben." }).trim().max(60, "Höchstens 60 Zeichen."),
  navLabel: optionalText(40),
  showInNav: checkbox,
  showInFooter: checkbox,
});

export async function createPageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const parsed = newPageSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    navLabel: formData.get("navLabel") ?? undefined,
    showInNav: formData.get("showInNav"),
    showInFooter: formData.get("showInFooter"),
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const slug = normalizeSlug(parsed.data.slug);
  const slugProblem = await slugError(slug);
  if (slugProblem) return errorState("Bitte prüfen Sie die Adresse.", formData, { slug: slugProblem });

  const last = await db.page.aggregate({ _max: { navOrder: true }, where: { system: false } });
  const navOrder = Math.min(999, Math.max(100, (last._max.navOrder ?? 90) + 10));

  let id: string;
  try {
    id = await createPage(
      {
        slug,
        title: parsed.data.title,
        navLabel: parsed.data.navLabel,
        showInNav: parsed.data.showInNav,
        showInFooter: parsed.data.showInFooter,
        navOrder,
      },
      user.id,
    );
  } catch (error) {
    return errorState(messageOf(error), formData);
  }
  revalidatePath("/admin/website");
  redirect(`/admin/website/seiten/${id}?neu=1`);
}

export async function saveDraftAction(pageId: string, draft: unknown, options?: SaveOptions): Promise<SaveResult> {
  const user = await requireAdmin();
  if (!validId(pageId)) return { ok: false, message: "Diese Seite gibt es nicht." };
  const parsed = parseDraftInput(draft);
  if (!parsed.success) {
    return { ok: false, message: "Bitte prüfen Sie die markierten Felder.", issues: issuesFromZod(parsed.error) };
  }
  const conflict = await conflictCheck(pageId, user.id, options);
  if (conflict) return conflict;

  try {
    const result = await saveDraft(pageId, parsed.data, user.id);
    const state = await pageState(pageId);
    revalidatePath("/admin/website");
    return {
      ok: true,
      message: result.hasDraft
        ? "Entwurf gespeichert. Auf der Website ist noch der bisherige Stand zu sehen."
        : "Gespeichert. Der Inhalt entspricht dem veröffentlichten Stand.",
      hasDraft: result.hasDraft,
      published: state?.system ? true : (state?.published ?? false),
      publishedAt: state?.publishedAt?.toISOString() ?? null,
      updatedAt: result.updatedAt.toISOString(),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export async function publishPageAction(pageId: string, draft: unknown, options?: SaveOptions): Promise<SaveResult> {
  const user = await requireAdmin();
  if (!validId(pageId)) return { ok: false, message: "Diese Seite gibt es nicht." };
  const parsed = parseDraftInput(draft);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Bitte prüfen Sie die markierten Felder. Veröffentlicht wurde noch nichts.",
      issues: issuesFromZod(parsed.error),
    };
  }
  const conflict = await conflictCheck(pageId, user.id, options);
  if (conflict) return conflict;

  try {
    await saveDraft(pageId, parsed.data, user.id);
    const result = await publish(pageId, user.id);
    revalidateWebsite();
    return {
      ok: true,
      message: result.published
        ? "Veröffentlicht. Die Änderungen sind jetzt auf der Website zu sehen."
        : "Änderungen übernommen. Die Seite ist ausgeblendet und deshalb auf der Website nicht zu sehen.",
      hasDraft: false,
      published: result.published,
      publishedAt: result.publishedAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export async function discardDraftAction(pageId: string): Promise<DiscardResult> {
  const user = await requireAdmin();
  if (!validId(pageId)) return { ok: false, message: "Diese Seite gibt es nicht." };
  try {
    const result = await discardDraft(pageId, user.id);
    revalidatePath("/admin/website");
    return {
      ok: true,
      message: "Entwurf verworfen. Sie sehen wieder den veröffentlichten Stand.",
      content: result.content,
      updatedAt: result.updatedAt.toISOString(),
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

export async function deletePageAction(pageId: string): Promise<ActionResult> {
  await requireAdmin();
  if (!validId(pageId)) return { ok: false, message: "Diese Seite gibt es nicht." };
  try {
    await deletePage(pageId);
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
  revalidateWebsite();
  redirect("/admin/website?hinweis=seite-geloescht");
}

const settingsSchema = z.object({
  navLabel: optionalText(40),
  showInNav: checkbox,
  showInFooter: checkbox,
  navOrder: z.coerce
    .number({ error: "Bitte eine Zahl angeben." })
    .int("Bitte eine ganze Zahl angeben.")
    .min(0, "Bitte eine Zahl von 0 bis 999 angeben.")
    .max(999, "Bitte eine Zahl von 0 bis 999 angeben."),
  published: checkbox,
  slug: z.string().trim().max(60, "Höchstens 60 Zeichen.").optional(),
});

/** Menü, Reihenfolge, Sichtbarkeit und Adresse – gelten sofort. */
export async function updatePageSettingsAction(pageId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();
  if (!validId(pageId)) return errorState("Diese Seite gibt es nicht.");
  const page = await db.page.findUnique({ where: { id: pageId }, select: { system: true, publishedAt: true, published: true } });
  if (!page) return errorState("Diese Seite gibt es nicht mehr.");

  const parsed = settingsSchema.safeParse({
    navLabel: formData.get("navLabel") ?? undefined,
    showInNav: formData.get("showInNav"),
    showInFooter: formData.get("showInFooter"),
    navOrder: formData.get("navOrder") || "100",
    published: formData.get("published"),
    slug: formData.get("slug") ?? undefined,
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const data = parsed.data;
  const update: Parameters<typeof updateMeta>[1] = {
    navLabel: data.navLabel,
    showInNav: data.showInNav,
    showInFooter: data.showInFooter,
    navOrder: data.navOrder,
  };
  if (!page.system) {
    // Vor dem ersten Veröffentlichen bleibt die Seite ausgeblendet (Kästchen ist dann gesperrt). Stammt das
    // Formular noch aus dieser Zeit (z. B. zweiter Tab), fehlt „publishedEditable“: Sichtbarkeit nicht anfassen.
    if (page.publishedAt && formData.get("publishedEditable") === "1") update.published = data.published;
    if (data.slug !== undefined) {
      const slug = normalizeSlug(data.slug);
      const problem = await slugError(slug, pageId);
      if (problem) return errorState("Bitte prüfen Sie die Adresse.", formData, { slug: problem });
      update.slug = slug;
    }
  }

  try {
    await updateMeta(pageId, update, user.id);
  } catch (error) {
    return errorState(messageOf(error), formData);
  }
  revalidateWebsite();
  return successState("Einstellungen übernommen.");
}

/* ------------------------------------------------------------------ */
/* Firmendaten                                                         */
/* ------------------------------------------------------------------ */

const emailField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Bitte ${label} angeben.`)
    .max(160, "Höchstens 160 Zeichen.")
    .pipe(z.email("Bitte eine gültige E-Mail-Adresse angeben."));

const siteSettingsInput = z.object({
  name: requiredText("einen Namen", 80),
  legalName: requiredText("die Firmierung", 160),
  tagline: trimmed(160),
  owner: trimmed(160),
  street: trimmed(160),
  zip: trimmed(20),
  city: trimmed(80),
  region: trimmed(120),
  phone: trimmed(40),
  phoneHref: trimmed(40).regex(/^(\+?[0-9]{3,20})?$/, "Nur Ziffern, am Anfang ein +, ohne Leerzeichen – z. B. +49711123456."),
  email: emailField("eine E-Mail-Adresse"),
  supportEmail: emailField("eine E-Mail-Adresse für den Support"),
  vatId: trimmed(40),
  register: trimmed(200),
  remoteSupportUrl: trimmed(300).regex(
    /^(https?:\/\/[^\s]+)?$/,
    "Bitte die vollständige Adresse mit https:// angeben oder das Feld leer lassen.",
  ),
  openingHours: z
    .array(z.object({ days: requiredText("die Tage", 80), hours: requiredText("die Uhrzeiten", 80) }))
    .max(10, "Höchstens 10 Zeilen."),
  responseTimes: z
    .array(
      z.object({
        priority: z.enum(TICKET_PRIORITIES, "Bitte eine Priorität auswählen."),
        label: requiredText("eine Beschreibung", 120),
        time: requiredText("die Reaktionszeit", 80),
      }),
    )
    .max(8, "Höchstens 8 Zeilen."),
  hostingProvider: trimmed(300),
  logRetentionDays: z.coerce
    .number("Bitte eine Zahl angeben.")
    .int("Bitte eine ganze Zahl angeben.")
    .min(1, "Mindestens 1 Tag.")
    .max(365, "Höchstens 365 Tage."),
});

function rowIsEmpty(row: unknown, keys: string[]): boolean {
  if (!row || typeof row !== "object") return true;
  return keys.every((k) => {
    const v = (row as Record<string, unknown>)[k];
    return typeof v !== "string" || v.trim() === "";
  });
}

export async function saveSiteSettingsAction(input: unknown): Promise<FormState> {
  await requireAdmin();
  const raw = input && typeof input === "object" ? { ...(input as Record<string, unknown>) } : {};
  // Komplett leere Zeilen ignorieren
  if (Array.isArray(raw.openingHours)) raw.openingHours = raw.openingHours.filter((r) => !rowIsEmpty(r, ["days", "hours"]));
  if (Array.isArray(raw.responseTimes)) raw.responseTimes = raw.responseTimes.filter((r) => !rowIsEmpty(r, ["label", "time"]));

  const parsed = siteSettingsInput.safeParse(raw);
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    await saveSiteSettings(parsed.data);
  } catch (error) {
    return errorState(messageOf(error));
  }
  revalidateWebsite();
  return successState("Firmendaten gespeichert. Website, Impressum und E-Mails verwenden ab sofort die neuen Angaben.");
}

/* ------------------------------------------------------------------ */
/* Medien                                                              */
/* ------------------------------------------------------------------ */

export async function uploadMediaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "size" in f && f.size > 0);
  const altRaw = formData.get("alt");
  const alt = typeof altRaw === "string" ? altRaw.trim().slice(0, 200) : "";

  const problem = validateMediaFiles(files);
  if (problem) return errorState(problem, formData);
  if (files.length > MAX_MEDIA_FILES) return errorState(`Bitte höchstens ${MAX_MEDIA_FILES} Bilder auf einmal hochladen.`, formData);

  const stored: { id: string; fileName: string; alt: string | null }[] = [];
  const failed: string[] = [];
  for (const file of files) {
    try {
      const media = await storeMedia(file, { alt: alt || null, uploadedById: user.id });
      stored.push({ id: media.id, fileName: media.fileName, alt: media.alt });
    } catch (error) {
      failed.push(messageOf(error));
    }
  }
  revalidatePath("/admin/website/medien");

  if (stored.length === 0) return errorState(failed[0] ?? GENERIC_ERROR, formData);
  const last = stored[stored.length - 1];
  const message =
    (stored.length === 1 ? `„${last.fileName}“ wurde hochgeladen.` : `${stored.length} Bilder wurden hochgeladen.`) +
    (failed.length > 0 ? ` Nicht übernommen: ${failed.join(" ")}` : "");
  return successState(message, { id: last.id, url: `/medien/${last.id}`, fileName: last.fileName, alt: last.alt ?? "" });
}

export async function updateMediaAltAction(mediaId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  if (!validId(mediaId)) return errorState("Dieses Bild gibt es nicht.");
  const parsed = z.object({ alt: trimmed(200) }).safeParse({ alt: formData.get("alt") ?? "" });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  try {
    await updateMediaAlt(mediaId, parsed.data.alt || null);
  } catch (error) {
    return errorState(messageOf(error), formData);
  }
  revalidatePath("/admin/website/medien");
  return successState("Bildbeschreibung gespeichert.");
}

export async function deleteMediaAction(mediaId: string, force: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  if (!validId(mediaId)) return { ok: false, message: "Dieses Bild gibt es nicht." };
  try {
    const { removedFrom } = await deleteMedia(mediaId, { force: force === true, userId: user.id });
    revalidatePath("/admin/website/medien");
    if (removedFrom > 0) revalidateWebsite();
    return {
      ok: true,
      message:
        removedFrom > 0
          ? `Bild gelöscht und von ${removedFrom === 1 ? "einer Seite" : `${removedFrom} Seiten`} entfernt.`
          : "Bild gelöscht.",
    };
  } catch (error) {
    return { ok: false, message: messageOf(error) };
  }
}

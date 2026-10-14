import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";
import { site as defaults } from "@/config/site";

/**
 * Firmendaten und Kontaktangaben. Vorgaben stehen in src/config/site.ts,
 * Änderungen aus der Verwaltung (Website > Firmendaten) liegen in SiteSetting "company".
 */

const openingHourSchema = z.object({ days: z.string().max(80), hours: z.string().max(80) });
const responseTimeSchema = z.object({ priority: z.string().max(20), label: z.string().max(120), time: z.string().max(80) });

export const siteSettingsSchema = z.object({
  name: z.string().max(80),
  legalName: z.string().max(160),
  tagline: z.string().max(160),
  owner: z.string().max(160),
  street: z.string().max(160),
  zip: z.string().max(20),
  city: z.string().max(80),
  region: z.string().max(120),
  phone: z.string().max(40),
  phoneHref: z.string().max(40),
  email: z.string().max(160),
  supportEmail: z.string().max(160),
  vatId: z.string().max(40),
  register: z.string().max(200),
  openingHours: z.array(openingHourSchema).max(10),
  responseTimes: z.array(responseTimeSchema).max(8),
  remoteSupportUrl: z.string().max(300),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  name: defaults.name,
  legalName: defaults.legalName,
  tagline: defaults.tagline,
  owner: defaults.owner,
  street: defaults.street,
  zip: defaults.zip,
  city: defaults.city,
  region: defaults.region,
  phone: defaults.phone,
  phoneHref: defaults.phoneHref,
  email: defaults.email,
  supportEmail: defaults.supportEmail,
  vatId: defaults.vatId,
  register: defaults.register,
  openingHours: defaults.openingHours.map((o) => ({ ...o })),
  responseTimes: defaults.responseTimes.map((r) => ({ ...r })),
  remoteSupportUrl: defaults.remoteSupportUrl,
};

const SETTINGS_KEY = "company";

/** Firmendaten (pro Anfrage zwischengespeichert). Fehlende/ungültige Werte fallen auf die Vorgaben zurück. */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  let stored: unknown = null;
  try {
    const row = await db.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
    stored = row ? JSON.parse(row.value) : null;
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== "object") return DEFAULT_SITE_SETTINGS;
  const merged: Record<string, unknown> = { ...DEFAULT_SITE_SETTINGS };
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    const field = siteSettingsSchema.shape[key as keyof SiteSettings];
    if (field && field.safeParse(value).success) merged[key] = value;
  }
  return merged as SiteSettings;
});

export async function saveSiteSettings(settings: SiteSettings): Promise<void> {
  const value = JSON.stringify(siteSettingsSchema.parse(settings));
  await db.siteSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
}

/** Werte, die noch mit "TODO" beginnen (Hinweis vor dem Livegang). */
export function unfinishedSettings(s: SiteSettings): string[] {
  return Object.entries(s)
    .filter(([, v]) => typeof v === "string" && v.trim().startsWith("TODO"))
    .map(([k]) => k);
}

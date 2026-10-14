import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSiteSettings, type SiteSettings } from "@/lib/settings";
import {
  DEFAULT_BILLING_SETTINGS,
  billingProblems,
  billingSettingsSchema,
  type BillingProblem,
  type BillingSettings,
} from "@/lib/invoices/settings-schema";

export { DEFAULT_BILLING_SETTINGS, billingProblems, type BillingProblem, type BillingSettings };

/**
 * Rechnungseinstellungen in SiteSetting "billing" (JSON). Fehlende oder ungültige Werte fallen auf die Vorgaben zurück –
 * wie bei den Firmendaten (src/lib/settings.ts).
 */

const SETTINGS_KEY = "billing";

export const getBillingSettings = cache(async (): Promise<BillingSettings> => {
  let stored: unknown = null;
  try {
    const row = await db.siteSetting.findUnique({ where: { key: SETTINGS_KEY } });
    stored = row ? JSON.parse(row.value) : null;
  } catch {
    stored = null;
  }
  if (!stored || typeof stored !== "object") return DEFAULT_BILLING_SETTINGS;
  const merged: Record<string, unknown> = { ...DEFAULT_BILLING_SETTINGS };
  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    const field = billingSettingsSchema.shape[key as keyof BillingSettings];
    if (field && field.safeParse(value).success) merged[key] = value;
  }
  return merged as BillingSettings;
});

export async function saveBillingSettings(settings: BillingSettings): Promise<void> {
  const value = JSON.stringify(billingSettingsSchema.parse(settings));
  await db.siteSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });
}

export type InvoiceIssuer = {
  billing: BillingSettings;
  site: SiteSettings;
  /** Fehlende Pflichtangaben – solange vorhanden, keine neuen Rechnungen */
  problems: BillingProblem[];
};

/** Absenderdaten und Einstellungen für Rechnungen inklusive Prüfung der Pflichtangaben. */
export async function getInvoiceIssuer(): Promise<InvoiceIssuer> {
  const [billing, site] = await Promise.all([getBillingSettings(), getSiteSettings()]);
  return { billing, site, problems: billingProblems(billing, site) };
}

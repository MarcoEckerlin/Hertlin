import { SAFE_HREF } from "@/cms/schema";
import type { SiteSettings } from "@/lib/settings";

/**
 * Platzhalter in Website-Texten.
 *
 * Offiziell (im Editor beschrieben, siehe src/cms/schema.ts):
 *   {firma} {telefon} {email} {support_email} {region} {adresse}  sowie das Link-Ziel {fernwartung}
 *
 * Zusätzlich kennt die Darstellung (für Rechtstexte und Beispiele):
 *   {firmierung}       – vollständige Firmierung (settings.legalName)
 *   {hosting}          – Hosting-Anbieter (settings.hostingProvider), für die Datenschutzerklärung
 *   {log_tage}         – Speicherdauer der Server-Logs in Tagen (settings.logRetentionDays)
 *   {portal_beispiel}  – Beispieladresse eines Kundenportals, z. B. „ihrefirma.hertlin.de“
 *
 * Unbekannte Platzhalter bleiben unverändert stehen, damit Tippfehler in der Vorschau auffallen.
 * Die Ersetzung erzeugt nur Text – nie HTML. Werte werden von React escaped.
 */

export const PLACEHOLDER_KEYS = [
  "firma",
  "telefon",
  "email",
  "support_email",
  "region",
  "adresse",
  "firmierung",
  "hosting",
  "log_tage",
  "portal_beispiel",
] as const;

export type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number];

export type PlaceholderContext = {
  /** Platzhalter (ohne Klammern) → Anzeigetext */
  values: Record<string, string>;
  /** Platzhalter, die im Fließtext automatisch verlinkt werden (z. B. telefon → tel:+49…) */
  autoLinks: Record<string, string>;
  /** Ziel für {fernwartung} oder null, wenn kein gültiger http(s)-Link hinterlegt ist */
  remoteSupportUrl: string | null;
};

export type PlaceholderSettings = Pick<
  SiteSettings,
  | "name"
  | "legalName"
  | "phone"
  | "phoneHref"
  | "email"
  | "supportEmail"
  | "region"
  | "street"
  | "zip"
  | "city"
  | "remoteSupportUrl"
  | "hostingProvider"
  | "logRetentionDays"
>;

const PHONE_HREF = /^\+?[0-9][0-9\s/()-]{2,30}$/;
const EMAIL = /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[^\s@<>()"',;:]+$/;
const HTTP_URL = /^https?:\/\/[^\s<>"'`\\]+$/i;

/** "Musterstraße 1, 12345 Musterstadt" – leere Teile werden ausgelassen. */
export function formatAddress(s: Pick<SiteSettings, "street" | "zip" | "city">): string {
  const place = [s.zip, s.city].map((v) => v.trim()).filter(Boolean).join(" ");
  return [s.street.trim(), place].filter(Boolean).join(", ");
}

export function buildPlaceholderContext(
  settings: PlaceholderSettings,
  extra: { portalExample?: string } = {},
): PlaceholderContext {
  const values: Record<PlaceholderKey, string> = {
    firma: settings.name,
    telefon: settings.phone,
    email: settings.email,
    support_email: settings.supportEmail,
    region: settings.region,
    adresse: formatAddress(settings),
    firmierung: settings.legalName || settings.name,
    hosting: settings.hostingProvider,
    log_tage: String(settings.logRetentionDays),
    portal_beispiel: extra.portalExample ?? "",
  };

  const autoLinks: Record<string, string> = {};
  const phoneHref = settings.phoneHref.replace(/\s+/g, "");
  if (settings.phone.trim() && PHONE_HREF.test(phoneHref)) autoLinks.telefon = `tel:${phoneHref}`;
  if (EMAIL.test(settings.email.trim())) autoLinks.email = `mailto:${settings.email.trim()}`;
  if (EMAIL.test(settings.supportEmail.trim())) autoLinks.support_email = `mailto:${settings.supportEmail.trim()}`;

  const remote = settings.remoteSupportUrl.trim();
  return { values, autoLinks, remoteSupportUrl: HTTP_URL.test(remote) ? remote : null };
}

const TOKEN = /\{([a-z_]+)\}/g;

/** Ersetzt alle bekannten Platzhalter. Unbekannte bleiben stehen. */
export function replacePlaceholders(text: string | null | undefined, ctx: PlaceholderContext): string {
  if (!text) return "";
  return text.replace(TOKEN, (match, key: string) => (Object.hasOwn(ctx.values, key) ? ctx.values[key] : match));
}

export type TextPart = { text: string; href?: string };

/**
 * Zerlegt Text in Abschnitte und ersetzt Platzhalter. Telefon und E-Mail-Adressen bekommen ein Link-Ziel,
 * damit sie im Fließtext anklickbar sind (nur außerhalb von Links verwenden).
 */
export function splitPlaceholders(text: string, ctx: PlaceholderContext): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  let plain = "";
  for (const match of text.matchAll(TOKEN)) {
    const key = match[1];
    const index = match.index ?? 0;
    plain += text.slice(last, index);
    last = index + match[0].length;
    if (!Object.hasOwn(ctx.values, key)) {
      plain += match[0];
      continue;
    }
    const value = ctx.values[key];
    const href = Object.hasOwn(ctx.autoLinks, key) ? ctx.autoLinks[key] : undefined;
    if (href && value) {
      if (plain) parts.push({ text: plain });
      plain = "";
      parts.push({ text: value, href });
    } else {
      plain += value;
    }
  }
  plain += text.slice(last);
  if (plain) parts.push({ text: plain });
  return parts;
}

export type ResolvedHref = { href: string; external: boolean };

/**
 * Prüft ein Link-Ziel gegen SAFE_HREF und löst {fernwartung} auf.
 * Gibt null zurück, wenn das Ziel nicht erlaubt ist (z. B. javascript:, data:, //fremde-seite).
 */
export function resolveHref(raw: string | null | undefined, ctx: PlaceholderContext): ResolvedHref | null {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (!href || href.length > 500) return null;
  // Steuerzeichen und Backslashes: Browser machen aus "/\ziel" eine fremde Adresse
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(href)) return null;
  if (!SAFE_HREF.test(href)) return null;
  if (href === "{fernwartung}") {
    return ctx.remoteSupportUrl ? { href: ctx.remoteSupportUrl, external: true } : null;
  }
  return { href, external: /^https?:\/\//i.test(href) };
}

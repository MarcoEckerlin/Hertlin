/** Sprachen für Chat-Übersetzung und Website-Übersetzer (ISO 639-1). Ohne server-only, auch im Browser nutzbar. */
export const LANGUAGES = [
  { code: "de", label: "Deutsch", native: "Deutsch" },
  { code: "en", label: "Englisch", native: "English" },
  { code: "tr", label: "Türkisch", native: "Türkçe" },
  { code: "pl", label: "Polnisch", native: "Polski" },
  { code: "ru", label: "Russisch", native: "Русский" },
  { code: "uk", label: "Ukrainisch", native: "Українська" },
  { code: "ro", label: "Rumänisch", native: "Română" },
  { code: "it", label: "Italienisch", native: "Italiano" },
  { code: "fr", label: "Französisch", native: "Français" },
  { code: "es", label: "Spanisch", native: "Español" },
  { code: "el", label: "Griechisch", native: "Ελληνικά" },
  { code: "bg", label: "Bulgarisch", native: "Български" },
  { code: "cs", label: "Tschechisch", native: "Čeština" },
  { code: "hu", label: "Ungarisch", native: "Magyar" },
  { code: "nl", label: "Niederländisch", native: "Nederlands" },
  { code: "pt", label: "Portugiesisch", native: "Português" },
  { code: "ar", label: "Arabisch", native: "العربية" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as readonly LangCode[];

export function isLangCode(value: unknown): value is LangCode {
  return typeof value === "string" && (LANGUAGE_CODES as readonly string[]).includes(value);
}

export function languageLabel(code: string | null | undefined): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? (code ? code.toUpperCase() : "unbekannt");
}

export function languageNative(code: string | null | undefined): string {
  return LANGUAGES.find((l) => l.code === code)?.native ?? (code ? code.toUpperCase() : "");
}

/** Schreibrichtung für dir-Attribute */
export function isRtl(code: string | null | undefined): boolean {
  return code === "ar";
}

/** Cookie, in dem Gäste (Status-Link, Website) ihre Sprache speichern */
export const LANGUAGE_COOKIE = "hertlin_lang";

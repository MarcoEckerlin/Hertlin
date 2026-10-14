/**
 * Vorschlag für das Subdomain-Kürzel aus dem Firmennamen (läuft im Browser und auf dem Server).
 * „Bäckerei Müller GmbH & Co. KG“ → „baeckerei-mueller“
 */

/** Rechtsformen und Zusätze, die im Kürzel nichts verloren haben (klein, ohne Punkte). */
const LEGAL_FORMS = new Set([
  "gmbh",
  "ggmbh",
  "mbh",
  "ag",
  "kg",
  "kgaa",
  "ohg",
  "gbr",
  "ug",
  "ek",
  "ekfr",
  "ev",
  "eg",
  "se",
  "partg",
  "partgmbb",
  "mbb",
  "ltd",
  "llc",
  "inc",
  "co",
  "haftungsbeschränkt",
  "haftungsbeschraenkt",
]);

const MAX_LENGTH = 40;

export function suggestSlug(name: string): string {
  let s = name
    .trim()
    // „& Co. KG“, „& Co KGaA“, „und Co.“
    .replace(/\s*(?:&|\+|und)\s*co\.?(?:\s*kg(?:aa)?)?(?=$|[\s,])/gi, " ")
    // „e. K.“, „e.K.“, „e. V.“
    .replace(/(?:^|\s)e\.\s?(?:k|v|kfr)\.?(?=$|[\s,])/gi, " ")
    .replace(/[()]/g, " ");

  const words = s.split(/[\s,]+/).filter(Boolean);
  const kept = words.filter((w, i) => i === 0 || !LEGAL_FORMS.has(w.toLowerCase().replace(/\./g, "")));
  s = (kept.length > 0 ? kept : words).join(" ");

  s = s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (s.length > MAX_LENGTH) {
    const cut = s.slice(0, MAX_LENGTH);
    const dash = cut.lastIndexOf("-");
    s = (dash >= 10 ? cut.slice(0, dash) : cut).replace(/-+$/, "");
  }
  return s;
}

/** Eingabe beim Tippen bereinigen: Großbuchstaben, Umlaute und Leerzeichen sofort umwandeln. */
export function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, MAX_LENGTH);
}

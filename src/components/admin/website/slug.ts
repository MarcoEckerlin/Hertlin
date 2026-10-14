/** Adressvorschlag aus einem Seitentitel: „Über uns & Team“ → „ueber-uns-team“. */
export function slugify(input: string, max = 60): string {
  const replaced = input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return replaced.slice(0, max).replace(/-+$/g, "");
}

import "server-only";
import { translateTexts, translationEnabled } from "@/lib/translate";
import { isLangCode } from "@/lib/languages";

/**
 * Übersetzt Chat-Nachrichten für den Leser.
 * Ergebnis: id -> { text, from } nur für Nachrichten, die NICHT schon in der Sprache des Lesers sind.
 */
export async function translateForViewer(
  items: { id: string; body: string }[],
  viewerLang: string | null | undefined,
): Promise<Record<string, { text: string; from: string | null }>> {
  if (!translationEnabled() || !isLangCode(viewerLang) || items.length === 0) return {};
  const results = await translateTexts(
    items.map((i) => i.body),
    viewerLang,
    { context: "Nachricht in einem IT-Support-Ticket" },
  );
  const out: Record<string, { text: string; from: string | null }> = {};
  items.forEach((item, i) => {
    const r = results[i];
    if (r && !r.unchanged && r.detected !== viewerLang && r.text.trim() !== item.body.trim()) {
      out[item.id] = { text: r.text, from: r.detected };
    }
  });
  return out;
}

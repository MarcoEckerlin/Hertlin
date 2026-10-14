import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { isLangCode, type LangCode } from "@/lib/languages";

/**
 * Maschinelle Übersetzung für Chat-Nachrichten und den Website-Übersetzer.
 *
 * Anbieter über TRANSLATION_PROVIDER:
 *   "deepl"     – DeepL API (DEEPL_API_KEY; Free-Schlüssel enden auf ":fx")
 *   "anthropic" – Claude über die Anthropic API (ANTHROPIC_API_KEY)
 *   nicht gesetzt: automatisch DeepL, wenn DEEPL_API_KEY vorhanden, sonst Claude, wenn ANTHROPIC_API_KEY vorhanden, sonst aus.
 *
 * Jede Übersetzung wird in TranslationCache gespeichert, damit derselbe Text nur einmal übersetzt wird.
 */

export type Provider = "deepl" | "anthropic";

export type TranslationResult = {
  text: string;
  /** erkannte Ausgangssprache (kleingeschrieben, z. B. "tr") oder null */
  detected: string | null;
  /** true, wenn der Text schon in der Zielsprache war */
  unchanged: boolean;
};

export function translationProvider(): Provider | null {
  const configured = process.env.TRANSLATION_PROVIDER?.trim().toLowerCase();
  if (configured === "off" || configured === "none") return null;
  if (configured === "deepl") return process.env.DEEPL_API_KEY ? "deepl" : null;
  if (configured === "anthropic" || configured === "claude") return process.env.ANTHROPIC_API_KEY ? "anthropic" : null;
  if (process.env.DEEPL_API_KEY) return "deepl";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function translationEnabled(): boolean {
  return translationProvider() !== null;
}

/* ---------------------------------------------------------------- */
/* DeepL                                                             */
/* ---------------------------------------------------------------- */

function deeplTarget(lang: LangCode): string {
  if (lang === "en") return "EN-GB";
  if (lang === "pt") return "PT-PT";
  return lang.toUpperCase();
}

async function translateWithDeepL(texts: string[], target: LangCode, context?: string): Promise<{ text: string; detected: string | null }[]> {
  const key = process.env.DEEPL_API_KEY!;
  const endpoint = key.endsWith(":fx") ? "https://api-free.deepl.com/v2/translate" : "https://api.deepl.com/v2/translate";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: texts,
      target_lang: deeplTarget(target),
      preserve_formatting: true,
      ...(context ? { context } : {}),
    }),
    // Lieber ohne Übersetzung anzeigen als die Seite lange warten lassen
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DeepL antwortet mit ${res.status}`);
  const data = (await res.json()) as { translations?: { text: string; detected_source_language?: string }[] };
  if (!data.translations || data.translations.length !== texts.length) throw new Error("DeepL: unerwartete Antwort");
  return data.translations.map((t) => ({
    text: t.text,
    detected: t.detected_source_language ? t.detected_source_language.slice(0, 2).toLowerCase() : null,
  }));
}

/* ---------------------------------------------------------------- */
/* Claude (Anthropic API)                                            */
/* ---------------------------------------------------------------- */

let anthropicClient: Anthropic | null = null;

const ClaudeTranslationSchema = z.object({
  translations: z.array(
    z.object({
      detected_language: z.string(),
      text: z.string(),
    }),
  ),
});

const CLAUDE_SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          detected_language: { type: "string", description: "ISO 639-1 code of the source text, lowercase" },
          text: { type: "string", description: "The translation (or the unchanged text if it already is in the target language)" },
        },
        required: ["detected_language", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["translations"],
  additionalProperties: false,
} as const;

const CLAUDE_SYSTEM = `You translate texts for Hertlin, a German IT service company: website copy and messages in support tickets between technicians and customers.

Rules:
- Translate each input text into the requested target language. Keep the meaning, tone and level of formality (German "Sie" maps to polite forms).
- Keep line breaks, lists, URLs, e-mail addresses, phone numbers, ticket numbers (e.g. T-00042), file names, product and brand names unchanged.
- If a text already is in the target language, return it unchanged.
- Return exactly one entry per input text, in the same order. Do not add explanations.`;

async function translateWithClaude(texts: string[], target: LangCode, context?: string): Promise<{ text: string; detected: string | null }[]> {
  anthropicClient ??= new Anthropic();
  const model = process.env.ANTHROPIC_TRANSLATION_MODEL || "claude-opus-5-5";

  const response = await anthropicClient.beta.messages.create({
    model,
    max_tokens: 16000,
    // Bei einer Ablehnung durch die Sicherheitsfilter springt automatisch ein Ersatzmodell ein
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: CLAUDE_SCHEMA } },
    system: CLAUDE_SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({ target_language: target, context: context ?? null, texts }),
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude hat die Übersetzung abgelehnt");
  if (response.stop_reason === "max_tokens") throw new Error("Claude: Antwort abgeschnitten");
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude: keine Textantwort");

  const parsed = ClaudeTranslationSchema.safeParse(JSON.parse(textBlock.text));
  if (!parsed.success || parsed.data.translations.length !== texts.length) throw new Error("Claude: unerwartete Antwort");
  return parsed.data.translations.map((t) => ({ text: t.text, detected: t.detected_language.slice(0, 2).toLowerCase() || null }));
}

/* ---------------------------------------------------------------- */
/* Öffentliche Funktionen                                            */
/* ---------------------------------------------------------------- */

const BATCH_SIZE = 40;

/**
 * Übersetzt mehrere Texte in die Zielsprache (mit Zwischenspeicher).
 * Bei ausgeschaltetem Dienst oder Fehlern kommen die Originale zurück (unchanged = true).
 * cachedOnly: nur gespeicherte Übersetzungen liefern, keine neuen anfragen (gibt null für Fehlende).
 */
export async function translateTexts(
  texts: string[],
  target: LangCode,
  opts: { context?: string; cachedOnly?: boolean } = {},
): Promise<(TranslationResult | null)[]> {
  const provider = translationProvider();
  const results: (TranslationResult | null)[] = texts.map((t) => (t.trim() ? null : { text: t, detected: null, unchanged: true }));
  if (!isLangCode(target)) return texts.map((t) => ({ text: t, detected: null, unchanged: true }));

  const hashes = texts.map((t) => sha256(t));
  const pending = [...new Set(hashes.filter((_, i) => results[i] === null))];
  if (pending.length === 0) return results;

  const cached = await db.translationCache.findMany({ where: { hash: { in: pending }, targetLang: target } });
  const byHash = new Map(cached.map((c) => [c.hash, c]));
  texts.forEach((t, i) => {
    const hit = byHash.get(hashes[i]);
    if (hit && results[i] === null) results[i] = { text: hit.text, detected: hit.sourceLang, unchanged: hit.sourceLang === target };
  });

  if (opts.cachedOnly || !provider) {
    return results.map((r, i) => r ?? (opts.cachedOnly ? null : { text: texts[i], detected: null, unchanged: true }));
  }

  // Fehlende Texte (eindeutig) übersetzen
  const missing: { hash: string; text: string }[] = [];
  const seen = new Set<string>();
  texts.forEach((t, i) => {
    if (results[i] === null && !seen.has(hashes[i])) {
      seen.add(hashes[i]);
      missing.push({ hash: hashes[i], text: t });
    }
  });

  const fresh = new Map<string, { text: string; detected: string | null }>();
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    try {
      const out =
        provider === "deepl"
          ? await translateWithDeepL(batch.map((b) => b.text), target, opts.context)
          : await translateWithClaude(batch.map((b) => b.text), target, opts.context);
      batch.forEach((b, j) => fresh.set(b.hash, out[j]));
    } catch (error) {
      console.error("[translate]", error instanceof Error ? error.message : error);
    }
  }

  if (fresh.size > 0) {
    await Promise.all(
      [...fresh.entries()].map(([hash, value]) =>
        db.translationCache
          .upsert({
            where: { hash_targetLang: { hash, targetLang: target } },
            create: { hash, targetLang: target, sourceLang: value.detected, text: value.text, provider },
            update: { sourceLang: value.detected, text: value.text, provider },
          })
          .catch(() => undefined),
      ),
    );
  }

  return results.map((r, i) => {
    if (r) return r;
    const value = fresh.get(hashes[i]);
    if (!value) return { text: texts[i], detected: null, unchanged: true };
    return { text: value.text, detected: value.detected, unchanged: value.detected === target || value.text === texts[i] };
  });
}

/** Einzelner Text, z. B. eine Chat-Nachricht. */
export async function translateText(text: string, target: LangCode, context?: string): Promise<TranslationResult> {
  const [result] = await translateTexts([text], target, { context });
  return result ?? { text, detected: null, unchanged: true };
}

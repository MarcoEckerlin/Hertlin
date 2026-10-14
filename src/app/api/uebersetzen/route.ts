import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { translateTexts, translationEnabled } from "@/lib/translate";
import { isLangCode } from "@/lib/languages";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Website-Übersetzer: übersetzt sichtbare Texte einer Seite in die gewählte Sprache.
 * Öffentlich erreichbar, deshalb begrenzt (Anfragen pro IP, Textmenge, Tagesbudget für neue Übersetzungen).
 */

const bodySchema = z.object({
  lang: z.string().refine((v) => isLangCode(v) && v !== "de"),
  texts: z.array(z.string().max(1000)).min(1).max(100),
});

const DAILY_LIMIT = Number(process.env.TRANSLATION_DAILY_LIMIT || 500_000);
const g = globalThis as unknown as { __hertlinTranslateBudget?: { day: string; used: number } };

function budgetLeft(): number {
  const day = new Date().toISOString().slice(0, 10);
  if (!g.__hertlinTranslateBudget || g.__hertlinTranslateBudget.day !== day) g.__hertlinTranslateBudget = { day, used: 0 };
  return DAILY_LIMIT - g.__hertlinTranslateBudget.used;
}

export async function POST(request: NextRequest) {
  if (!translationEnabled()) return NextResponse.json({ error: "Übersetzung ist nicht eingerichtet." }, { status: 503 });

  const ip = await clientIp();
  if (!rateLimit(`translate:${ip}`, 60, 10 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Zu viele Anfragen." }, { status: 429 });
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  const { texts } = parsed.data;
  const lang = parsed.data.lang as Parameters<typeof translateTexts>[1];
  if (texts.reduce((n, t) => n + t.length, 0) > 15_000) return NextResponse.json({ error: "Zu viel Text." }, { status: 413 });

  // Erst nur Zwischenspeicher, dann Fehlendes im Rahmen des Tagesbudgets übersetzen
  const cached = await translateTexts(texts, lang, { cachedOnly: true });
  const missingChars = texts.reduce((n, t, i) => n + (cached[i] ? 0 : t.length), 0);

  let results = cached;
  if (missingChars > 0 && budgetLeft() >= missingChars) {
    g.__hertlinTranslateBudget!.used += missingChars;
    results = await translateTexts(texts, lang, { context: "Website eines IT-Dienstleisters" });
  }

  return NextResponse.json(
    { translations: texts.map((t, i) => results[i]?.text ?? t) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

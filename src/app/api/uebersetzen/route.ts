import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { translateTexts, translationEnabled } from "@/lib/translate";
import { isLangCode } from "@/lib/languages";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * Website-Übersetzer: übersetzt sichtbare Texte einer Seite in die gewählte Sprache.
 * Öffentlich erreichbar, deshalb begrenzt (Anfragen pro IP, Textmenge, Tagesbudget für neue Übersetzungen
 * insgesamt und pro Absender) und nur für Aufrufe von den eigenen Seiten.
 */

const bodySchema = z.object({
  lang: z.string().refine((v) => isLangCode(v) && v !== "de"),
  texts: z.array(z.string().max(1000)).min(1).max(100),
});

const DAILY_LIMIT = Number(process.env.TRANSLATION_DAILY_LIMIT || 500_000);
/** Neue Übersetzungen pro Absender und Tag, damit niemand allein das Tagesbudget aller Besucher aufbraucht. */
const IP_DAILY_LIMIT = Math.min(40_000, DAILY_LIMIT);
/** So viele Absender merken wir uns pro Tag höchstens (Speicher). Danach übersetzen nur noch bekannte Absender neu. */
const MAX_TRACKED_IPS = 50_000;
/** 15.000 Zeichen als JSON, auch mit Umlauten und Sonderzeichen */
const MAX_BODY_BYTES = 128 * 1024;

type Budget = { day: string; used: number; perIp: Map<string, number> };
const g = globalThis as unknown as { __hertlinTranslateBudget?: Budget };

function todaysBudget(): Budget {
  const day = new Date().toISOString().slice(0, 10);
  const current = g.__hertlinTranslateBudget;
  if (!current || current.day !== day || !current.perIp) {
    g.__hertlinTranslateBudget = { day, used: 0, perIp: new Map() };
  }
  return g.__hertlinTranslateBudget!;
}

/** Nimmt Zeichen aus dem Tagesbudget, wenn beide Grenzen (gesamt und pro Absender) es erlauben. */
function takeBudget(ip: string, chars: number): boolean {
  const budget = todaysBudget();
  const usedByIp = budget.perIp.get(ip) ?? 0;
  if (!budget.perIp.has(ip) && budget.perIp.size >= MAX_TRACKED_IPS) return false;
  if (DAILY_LIMIT - budget.used < chars || IP_DAILY_LIMIT - usedByIp < chars) return false;
  budget.used += chars;
  budget.perIp.set(ip, usedByIp + chars);
  return true;
}

export async function POST(request: NextRequest) {
  if (!translationEnabled()) return NextResponse.json({ error: "Übersetzung ist nicht eingerichtet." }, { status: 503 });

  // Nur für die eigenen Seiten: Fremde Seiten könnten sonst über die Browser ihrer Besucher (ohne CORS-Vorabfrage,
  // z. B. als text/plain) unser Budget verbrauchen. JSON erzwingt dort eine Vorabfrage, die wir nicht beantworten.
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!contentType.startsWith("application/json") || (fetchSite !== null && fetchSite !== "same-origin")) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Zu viel Text." }, { status: 413 });
  }

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
  if (missingChars > 0 && takeBudget(ip, missingChars)) {
    results = await translateTexts(texts, lang, { context: "Website eines IT-Dienstleisters" });
  }

  // null = gerade nicht übersetzt (Anbieter ausgefallen oder Tagesbudget erschöpft).
  // translateTexts liefert in dem Fall den Originaltext ohne erkannte Sprache zurück.
  // Der Browser zeigt dann einen Hinweis und speichert nichts im Zwischenspeicher.
  const translations = texts.map((t, i) => {
    const r = results[i];
    if (!t.trim()) return t;
    return r && !(r.detected === null && r.unchanged) ? r.text : null;
  });

  return NextResponse.json({ translations }, { headers: { "Cache-Control": "no-store" } });
}

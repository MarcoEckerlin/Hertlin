"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { LANGUAGES, LANGUAGE_COOKIE, isLangCode, isRtl, languageNative, type LangCode } from "@/lib/languages";
import { cn } from "@/lib/cn";

/**
 * Website-Übersetzer: übersetzt die sichtbaren Texte der Seite maschinell
 * (über /api/uebersetzen) und merkt sich die Sprache im Browser.
 * Elemente mit data-no-translate werden ausgelassen.
 */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "SVG", "KBD"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"] as const;
const STORAGE_KEY = "hertlin_lang";

type TextRecord = { original: string; translatedFor: LangCode | null; applied: string | null };

const textRecords = new WeakMap<Text, TextRecord>();
const attrRecords = new WeakMap<Element, Record<string, { original: string; applied: string | null }>>();
const touchedTexts = new Set<Text>();
const touchedElements = new Set<Element>();
const memoryCache = new Map<string, Map<string, string>>();

function cacheFor(lang: LangCode): Map<string, string> {
  let map = memoryCache.get(lang);
  if (!map) {
    map = new Map();
    try {
      const stored = sessionStorage.getItem(`hertlin_tr_${lang}`);
      if (stored) for (const [k, v] of Object.entries(JSON.parse(stored) as Record<string, string>)) map.set(k, v);
    } catch {
      // Ohne sessionStorage geht es auch
    }
    memoryCache.set(lang, map);
  }
  return map;
}

function persistCache(lang: LangCode) {
  try {
    const map = cacheFor(lang);
    const entries = [...map.entries()].slice(-2000);
    sessionStorage.setItem(`hertlin_tr_${lang}`, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignorieren
  }
}

function worthTranslating(text: string): boolean {
  const t = text.trim();
  return t.length > 1 && /\p{L}{2,}/u.test(t);
}

function skipped(el: Element | null): boolean {
  for (let node = el; node; node = node.parentElement) {
    if (SKIP_TAGS.has(node.tagName.toUpperCase())) return true;
    if (node.hasAttribute("data-no-translate") || (node as HTMLElement).isContentEditable) return true;
  }
  return false;
}

function collect(root: Node): { texts: Text[]; elements: Element[] } {
  const texts: Text[] = [];
  const elements: Element[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node as Text;
      if (worthTranslating(text.data) && !skipped(text.parentElement)) texts.push(text);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (ATTRS.some((a) => el.hasAttribute(a)) && !skipped(el)) elements.push(el);
    }
    node = walker.nextNode();
  }
  return { texts, elements };
}

async function fetchTranslations(lang: LangCode, strings: string[]): Promise<void> {
  const cache = cacheFor(lang);
  const missing = [...new Set(strings.filter((s) => !cache.has(s)))];
  for (let i = 0; i < missing.length; i += 80) {
    const chunk = missing.slice(i, i + 80);
    const res = await fetch("/api/uebersetzen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, texts: chunk }),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { translations: string[] };
    chunk.forEach((s, j) => cache.set(s, data.translations[j] ?? s));
  }
  if (missing.length) persistCache(lang);
}

function splitWhitespace(value: string): [string, string, string] {
  const m = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return m ? [m[1], m[2], m[3]] : ["", value, ""];
}

async function applyLanguage(lang: LangCode, root: Node = document.body): Promise<void> {
  const { texts, elements } = collect(root);

  // Originale merken (auch wenn React den Text inzwischen neu gesetzt hat)
  for (const t of texts) {
    const rec = textRecords.get(t);
    if (!rec || (t.data !== rec.applied && t.data !== rec.original)) {
      textRecords.set(t, { original: t.data, translatedFor: null, applied: null });
    }
  }
  for (const el of elements) {
    const rec = attrRecords.get(el) ?? {};
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v === null || !worthTranslating(v)) continue;
      if (!rec[a] || (v !== rec[a].applied && v !== rec[a].original)) rec[a] = { original: v, applied: null };
    }
    attrRecords.set(el, rec);
  }

  if (lang === "de") {
    restoreAll();
    return;
  }

  const strings: string[] = [];
  for (const t of texts) strings.push(splitWhitespace(textRecords.get(t)!.original)[1]);
  for (const el of elements) for (const r of Object.values(attrRecords.get(el) ?? {})) strings.push(r.original);
  await fetchTranslations(lang, strings);

  const cache = cacheFor(lang);
  for (const t of texts) {
    const rec = textRecords.get(t)!;
    const [lead, core, trail] = splitWhitespace(rec.original);
    const translated = cache.get(core);
    if (!translated) continue;
    const next = `${lead}${translated}${trail}`;
    rec.applied = next;
    rec.translatedFor = lang;
    if (t.data !== next) t.data = next;
    touchedTexts.add(t);
  }
  for (const el of elements) {
    const rec = attrRecords.get(el)!;
    for (const [a, r] of Object.entries(rec)) {
      const translated = cache.get(r.original);
      if (!translated) continue;
      r.applied = translated;
      if (el.getAttribute(a) !== translated) el.setAttribute(a, translated);
    }
    touchedElements.add(el);
  }
}

function restoreAll() {
  for (const t of touchedTexts) {
    const rec = textRecords.get(t);
    if (rec && t.isConnected && t.data === rec.applied) t.data = rec.original;
    if (rec) {
      rec.applied = null;
      rec.translatedFor = null;
    }
  }
  touchedTexts.clear();
  for (const el of touchedElements) {
    const rec = attrRecords.get(el);
    if (!rec) continue;
    for (const [a, r] of Object.entries(rec)) {
      if (el.getAttribute(a) === r.applied) el.setAttribute(a, r.original);
      r.applied = null;
    }
  }
  touchedElements.clear();
}

function readStoredLanguage(): LangCode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isLangCode(v)) return v;
  } catch {
    // ignorieren
  }
  return "de";
}

function storeLanguage(lang: LangCode) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignorieren
  }
  document.cookie = `${LANGUAGE_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
}

export function PageTranslator({ enabled, className, compact = false }: { enabled: boolean; className?: string; compact?: boolean }) {
  const [lang, setLang] = useState<LangCode>("de");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const langRef = useRef<LangCode>("de");
  const menuRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (next: LangCode, root?: Node) => {
    langRef.current = next;
    document.documentElement.lang = next;
    document.documentElement.dir = isRtl(next) ? "rtl" : "ltr";
    if (next === "de") {
      restoreAll();
      return;
    }
    setBusy(true);
    try {
      await applyLanguage(next, root);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  // Gespeicherte Sprache nach dem Laden anwenden
  useEffect(() => {
    if (!enabled) return;
    const stored = readStoredLanguage();
    if (stored !== "de") {
      // Zustand aus dem Browser-Speicher übernehmen (erst nach der Hydration verfügbar)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLang(stored);
      void run(stored);
    }
  }, [enabled, run]);

  // Neue Inhalte (Navigation, nachgeladene Daten) automatisch mitübersetzen
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver((mutations) => {
      if (langRef.current === "de") return;
      const relevant = mutations.some((m) => {
        if (m.type === "characterData") {
          const rec = textRecords.get(m.target as Text);
          return !rec || (m.target as Text).data !== rec.applied;
        }
        return m.addedNodes.length > 0;
      });
      if (!relevant) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void applyLanguage(langRef.current).catch(() => setFailed(true)), 250);
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!enabled) return null;

  const choose = (next: LangCode) => {
    setOpen(false);
    setLang(next);
    storeLanguage(next);
    void run(next);
  };

  return (
    <div ref={menuRef} className={cn("relative", className)} data-no-translate>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft hover:bg-brand-50 hover:text-ink"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sprache: ${languageNative(lang)}`}
      >
        <Languages className="size-4" aria-hidden />
        {compact ? lang.toUpperCase() : languageNative(lang)}
        {busy ? <span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 max-h-80 w-56 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-lift" role="listbox" aria-label="Sprache wählen">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === lang}
              onClick={() => choose(l.code)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-brand-50",
                l.code === lang ? "bg-brand-100 font-semibold text-ink" : "text-ink-soft",
              )}
            >
              <span>{l.native}</span>
              <span className="text-xs text-ink-muted">{l.code.toUpperCase()}</span>
            </button>
          ))}
          <p className="px-3 pt-2 pb-1 text-xs leading-snug text-ink-muted">
            Maschinelle Übersetzung. Verbindlich ist die deutsche Fassung.
          </p>
        </div>
      ) : null}
      {lang !== "de" ? (
        <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-xs text-ink-soft shadow-lift">
          <Languages className="size-3.5 text-brand-700" aria-hidden />
          {failed ? "Übersetzung gerade nicht verfügbar" : `Maschinell übersetzt (${languageNative(lang)})`}
          <button type="button" onClick={() => choose("de")} className="font-semibold text-brand-700 hover:underline">
            Original (Deutsch)
          </button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

/** Abstand zum oberen Rand (mobile Kopfzeile ist 3,5 rem hoch) bzw. zum unteren Rand beim Mitscrollen. */
const TOP_GAP = 80;
const BOTTOM_GAP = 24;
/** Unsichtbares Zeichen, damit Screenreader eine gleichlautende Ansage erneut vorlesen */
const ZWSP = "\u200b";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Tippt jemand gerade in ein Feld? Dann wird nicht automatisch gescrollt. */
function isEditing(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) {
    return !["button", "submit", "reset", "checkbox", "radio", "file", "hidden"].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Letzter sichtbarer Eintrag vor der Endmarke (das letzte <li> der Liste). */
function lastEntry(sentinel: HTMLElement): HTMLElement | null {
  const container = sentinel.previousElementSibling;
  if (!(container instanceof HTMLElement)) return null;
  const items = container.querySelectorAll<HTMLElement>(":scope > li, :scope > ol > li, :scope > ul > li");
  return items.length > 0 ? items[items.length - 1] : container;
}

/**
 * Hülle um einen Ticketverlauf, der per Live-Verbindung neu geladen wird (router.refresh):
 * - Kommt etwas Neues von anderen und war man schon am Ende des Verlaufs, scrollt die Seite weich mit.
 * - Liest man weiter oben (oder tippt gerade), bleibt alles stehen; ein Knopf „Neue Nachricht“ führt hin.
 * - Screenreader bekommen eine kurze, höfliche Ansage. Der Fokus bleibt, wo er ist.
 * Eigene Nachrichten lösen nichts aus – die Bestätigung kommt vom Formular.
 */
export function LiveTimeline({
  lastKey,
  lastFromSelf,
  announcement,
  follow = true,
  aboveBottomNav = false,
  children,
}: {
  /** Kennung des letzten Eintrags; ändert sie sich, ist etwas Neues da */
  lastKey: string;
  lastFromSelf: boolean;
  /** Ansage für Screenreader, z. B. „Neue Antwort von Hertlin (Max Muster)“ */
  announcement: string;
  /** false: Neues nur ansagen, nicht hinscrollen (z. B. ein Statuswechsel, der nicht im Verlauf steht) */
  follow?: boolean;
  /** Seite mit Schnellzugriff-Leiste unten (Portal/Verwaltung auf dem Handy): Knopf „Neue Nachricht“ darüber setzen */
  aboveBottomNav?: boolean;
  children: ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const atEnd = useRef(false);
  const handledKey = useRef(lastKey);
  const [jump, setJump] = useState<"up" | "down" | null>(null);

  // Ansage merken, sobald ein neuer Eintrag von anderen da ist (Muster „vorherigen Wert im State merken“).
  // Ein unsichtbares Zeichen im Wechsel sorgt dafür, dass gleichlautende Ansagen erneut vorgelesen werden.
  const [seenKey, setSeenKey] = useState(lastKey);
  const [liveText, setLiveText] = useState("");
  if (lastKey !== seenKey) {
    setSeenKey(lastKey);
    if (!lastFromSelf && announcement) setLiveText((prev) => (prev.endsWith(ZWSP) ? announcement : `${announcement}${ZWSP}`));
  }

  // Merken, ob das Ende des Verlaufs gerade zu sehen ist (oder knapp darunter)
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        atEnd.current = entry.isIntersecting;
        if (entry.isIntersecting) setJump(null);
      },
      { rootMargin: "0px 0px 200px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Neuer Eintrag: vor dem Zeichnen entscheiden (atEnd beschreibt noch den Stand vor der Änderung)
  useLayoutEffect(() => {
    if (handledKey.current === lastKey) return;
    handledKey.current = lastKey;
    if (lastFromSelf || !follow) return;
    const wasAtEnd = atEnd.current;

    const frame = requestAnimationFrame(() => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const target = lastEntry(sentinel) ?? sentinel;
      const rect = target.getBoundingClientRect();
      const inView = rect.bottom > TOP_GAP && rect.top < window.innerHeight;
      // Das Ende der neuen Nachricht ist schon zu sehen: nichts zu tun
      if (inView && rect.bottom <= window.innerHeight) return;

      if (wasAtEnd && !isEditing(document.activeElement) && rect.top > 0) {
        // Nur nach unten mitscrollen; lange Nachrichten oben bündig, sonst unten bündig
        const delta =
          rect.height + TOP_GAP + BOTTOM_GAP > window.innerHeight ? rect.top - TOP_GAP : rect.bottom + BOTTOM_GAP - window.innerHeight;
        if (delta > 0) {
          window.scrollBy({ top: delta, behavior: prefersReducedMotion() ? "instant" : "smooth" });
          return;
        }
      }
      setJump(rect.bottom <= TOP_GAP ? "up" : "down");
    });
    return () => cancelAnimationFrame(frame);
  }, [lastKey, lastFromSelf, follow]);

  function goToNewest() {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const target = lastEntry(sentinel) ?? sentinel;
    const rect = target.getBoundingClientRect();
    const delta =
      rect.height + TOP_GAP + BOTTOM_GAP > window.innerHeight ? rect.top - TOP_GAP : rect.bottom + BOTTOM_GAP - window.innerHeight;
    window.scrollBy({ top: delta, behavior: prefersReducedMotion() ? "instant" : "smooth" });
    // Bewusst angeklickt: Tastatur- und Screenreader-Nutzer landen direkt bei der Nachricht
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    setJump(null);
  }

  return (
    <>
      {children}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveText}
      </p>
      {jump ? (
        <button
          type="button"
          onClick={goToNewest}
          className={cn(
            "fixed right-4 z-30 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-on-ink shadow-lift transition-[opacity,translate] duration-200 hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 starting:translate-y-2 starting:opacity-0 sm:right-6",
            aboveBottomNav ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6" : "bottom-4 sm:bottom-6",
          )}
        >
          {jump === "up" ? <ArrowUp className="size-4" aria-hidden /> : <ArrowDown className="size-4" aria-hidden />}
          Neue Nachricht
        </button>
      ) : null}
    </>
  );
}

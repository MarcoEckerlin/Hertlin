"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

/** Abstand in Pixeln, ab dem das Ende des Verlaufs noch als „unten“ gilt. */
const NEAR_PX = 160;

function isTextField(element: Element | null): boolean {
  if (!element) return false;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) return !["button", "submit", "reset", "checkbox", "radio", "file"].includes(element.type);
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Ist der Eintrag im Bild? Kurze Einträge ganz, lange zumindest mit ihrem Anfang. */
function startVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const height = window.innerHeight;
  if (rect.top < 0 || rect.top > height - 48) return false;
  return rect.bottom <= height || rect.height > height * 0.8;
}

/**
 * Hält den Ticketverlauf im Blick, wenn neue Einträge live dazukommen (router.refresh()).
 * - Wer gerade das Ende des Verlaufs bzw. das Antwortformular vor Augen hat, wird weich zum neuen Eintrag gescrollt.
 * - Wer weiter oben liest oder gerade tippt, wird nicht verschoben – dann erscheint ein Knopf zum Springen
 *   (oben, wenn der neue Eintrag über dem sichtbaren Bereich liegt, sonst unten).
 * - Eigene Einträge (gerade gesendete Antwort, eigene Statusänderung) lösen kein Scrollen aus.
 *
 * Die Einträge des Verlaufs tragen das Attribut data-timeline-item.
 */
export function TimelineFollower({
  lastKey,
  lastFromSelf,
  jumpLabel,
  children,
}: {
  /** Kennung des letzten Eintrags; ändert sie sich, ist etwas Neues da */
  lastKey: string;
  lastFromSelf: boolean;
  /** Beschriftung des Knopfs, z. B. „Neue Nachricht“ */
  jumpLabel: string;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const seenKey = useRef(lastKey);
  /** Knopf „Neue Nachricht“: Richtung, in der der neue Eintrag liegt, oder null */
  const [jump, setJump] = useState<"up" | "down" | null>(null);

  const lastItem = useCallback((): HTMLElement | null => {
    const items = wrapperRef.current?.querySelectorAll<HTMLElement>("[data-timeline-item]");
    return items && items.length > 0 ? items[items.length - 1] : null;
  }, []);

  // Laufend merken, ob das Ende des Verlaufs im Blick ist – entscheidend ist der Stand VOR einer Aktualisierung
  useEffect(() => {
    function measure() {
      const end = endRef.current;
      if (!end) return;
      const top = end.getBoundingClientRect().top;
      const height = window.innerHeight;
      // Ende sichtbar oder knapp darunter – oder darüber, solange das Antwortformular darunter noch im Blick ist
      nearEnd.current = top <= height + NEAR_PX && top >= -height * 0.6;
    }
    function onScroll() {
      measure();
      const last = lastItem();
      if (last && startVisible(last)) setJump(null);
    }
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [lastItem]);

  // Neuer Eintrag: vor dem Zeichnen entscheiden, damit der Stand von vorher zählt
  useLayoutEffect(() => {
    if (seenKey.current === lastKey) return;
    seenKey.current = lastKey;
    if (lastFromSelf) return;

    const wasNear = nearEnd.current;
    const frame = requestAnimationFrame(() => {
      const last = lastItem();
      if (!last || startVisible(last)) return;
      const rect = last.getBoundingClientRect();
      if (wasNear && !isTextField(document.activeElement)) {
        const tall = rect.height > window.innerHeight * 0.8;
        last.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "nearest" });
      } else {
        setJump(rect.top < 0 ? "up" : "down");
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [lastKey, lastFromSelf, lastItem]);

  function jumpToLatest() {
    lastItem()?.scrollIntoView({ behavior: "smooth", block: "start" });
    setJump(null);
  }

  const Arrow = jump === "up" ? ArrowUp : ArrowDown;

  return (
    <div ref={wrapperRef}>
      {children}
      <div ref={endRef} aria-hidden />
      {jump ? (
        <button
          type="button"
          onClick={jumpToLatest}
          className={cn(
            // Mittig über dem Inhaltsbereich (ab lg steht links die Navigation mit 16rem)
            "fixed left-1/2 z-40 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold whitespace-nowrap text-on-ink shadow-lift transition-[opacity,translate] duration-200 starting:translate-y-1 starting:opacity-0 hover:bg-brand-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:left-[calc(50%_+_8rem)]",
            // Auf dem Handy über dem Schnellzugriff am unteren Rand
            jump === "up" ? "top-[4.5rem] lg:top-5" : "bottom-20 lg:bottom-5",
          )}
        >
          <Arrow className="size-4" aria-hidden />
          {jumpLabel}
        </button>
      ) : null}
    </div>
  );
}

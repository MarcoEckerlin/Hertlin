"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Scrollbereich für den Chat-Verlauf.
 * - Beim Öffnen steht der Verlauf am Ende.
 * - Kommt eine neue Nachricht, scrollt er mit – außer man liest gerade weiter oben.
 *   Dann erscheint ein Knopf „Neue Nachricht“, statt den Leser aus dem Text zu reißen.
 * - Eigene Nachrichten scrollen immer ans Ende.
 */
export function ChatScroller({
  lastKey,
  lastFromSelf,
  label,
  className,
  children,
}: {
  /** Kennung der letzten Nachricht; ändert sie sich, ist etwas Neues da */
  lastKey: string;
  lastFromSelf: boolean;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const seenKey = useRef<string | null>(null);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seenKey.current === lastKey) return;
    const firstRender = seenKey.current === null;
    seenKey.current = lastKey;

    const frame = requestAnimationFrame(() => {
      if (firstRender || lastFromSelf || nearBottom.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: firstRender ? "auto" : "smooth" });
        nearBottom.current = true;
        setShowJump(false);
      } else {
        setShowJump(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [lastKey, lastFromSelf]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    nearBottom.current = atEnd;
    if (atEnd && showJump) setShowJump(false);
  }

  function jumpToEnd() {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowJump(false);
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={onScroll}
        role="log"
        aria-label={label}
        aria-live="polite"
        // Scrollbare Bereiche müssen per Tastatur erreichbar sein
        tabIndex={0}
        className={cn(
          "overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500",
          className,
        )}
      >
        {children}
      </div>
      {showJump ? (
        <button
          type="button"
          onClick={jumpToEnd}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-on-ink shadow-lift hover:bg-brand-900"
        >
          <ArrowDown className="size-4" aria-hidden />
          Neue Nachricht
        </button>
      ) : null}
    </div>
  );
}

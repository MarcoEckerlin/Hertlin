"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Container } from "@/components/site/sections/layout";

export type AnchorNavItem = { id: string; label: string };

/** Abstand vom oberen Fensterrand, ab dem ein Abschnitt als „aktuell“ gilt (Kopfzeile + diese Leiste + Luft). */
const ACTIVE_OFFSET = 160;

/**
 * Leiste „Auf dieser Seite“ unter dem Seitenkopf: Sprungmarken zu den Abschnitten einer langen Seite
 * (z. B. die Leistungsbereiche). Bleibt beim Scrollen unter der Kopfzeile stehen und markiert den Abschnitt,
 * in dem man gerade liest. Auf dem Handy lässt sie sich seitlich wischen.
 */
export function AnchorNav({ items }: { items: AnchorNavItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Aktuellen Abschnitt beim Scrollen bestimmen (gedrosselt auf einen Durchlauf pro Bild)
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const item of items) {
        const element = document.getElementById(item.id);
        if (element && element.getBoundingClientRect().top <= ACTIVE_OFFSET) current = item.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  // Markierten Eintrag in der Leiste sichtbar halten (nur seitlich, die Seite selbst scrollt nicht)
  useEffect(() => {
    const list = listRef.current;
    if (!list || !active) return;
    const link = list.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(active)}"]`);
    if (!link) return;
    const left = link.offsetLeft - list.offsetLeft;
    const right = left + link.offsetWidth;
    if (left < list.scrollLeft || right > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [active]);

  return (
    <nav aria-label="Auf dieser Seite" className="sticky top-[calc(4.5rem+1px)] z-30 border-b border-line bg-surface">
      <Container>
        <ul
          ref={listRef}
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => {
            const current = item.id === active;
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  data-anchor={item.id}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap ring-1 transition-colors ring-inset",
                    current
                      ? "bg-brand-100 text-ink ring-brand-200"
                      : "text-ink-soft ring-line hover:bg-brand-50 hover:text-ink",
                  )}
                >
                  {item.label}
                </a>
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}

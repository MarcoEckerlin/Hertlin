"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type ListNavigationState = {
  /** Neue Ergebnisse werden gerade geladen */
  pending: boolean;
  /** Zu einer anderen Filter-Adresse derselben Liste wechseln, ohne nach oben zu springen */
  navigate: (href: string) => void;
};

const ListNavigationContext = createContext<ListNavigationState | null>(null);

/** Filter und Reiter einer Liste: Navigation im Übergang, damit die alte Liste sichtbar „wartet“. */
export function useListNavigation(): ListNavigationState {
  const context = useContext(ListNavigationContext);
  const router = useRouter();
  return context ?? { pending: false, navigate: (href) => router.push(href, { scroll: false }) };
}

/**
 * Hülle um Filter, Reiter und Ergebnisliste einer Liste.
 * Links in einem Bereich mit data-list-nav (Reiter, „Zurücksetzen“), die auf dieselbe Seite führen, laufen als
 * Übergang: Die Liste bleibt stehen und wird leicht ausgegraut, bis die neuen Ergebnisse da sind – und die Seite
 * springt nicht nach oben. Alle anderen Links (ein Ticket, Seitenzahlen) bleiben normale Links.
 */
export function ListNavigation({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  function onClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return;
    if (!anchor.closest("[data-list-nav]")) return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) return;
    event.preventDefault();
    navigate(`${url.pathname}${url.search}`);
  }

  return (
    <ListNavigationContext.Provider value={{ pending, navigate }}>
      <div onClickCapture={onClickCapture} className={className}>
        {children}
      </div>
    </ListNavigationContext.Provider>
  );
}

/** Ergebnisbereich: während des Ladens gedimmt und für Screenreader als „beschäftigt“ markiert. */
export function ListResults({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useListNavigation();
  return (
    <div
      aria-busy={pending || undefined}
      className={cn("transition-opacity duration-200", pending && "opacity-55", className)}
    >
      {children}
    </div>
  );
}

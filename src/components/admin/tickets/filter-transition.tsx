"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

type FilterNavigation = { navigate: (href: string) => void; pending: boolean };

const FilterContext = createContext<FilterNavigation | null>(null);

/**
 * Klammer um Filter und Ergebnisliste einer Liste: Filter navigieren in einer Transition,
 * die Liste (FilterResults) zeigt währenddessen, dass sie gleich neu kommt, statt einzufrieren.
 */
export function FilterTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = (href: string) => startTransition(() => router.push(href, { scroll: false }));
  return <FilterContext.Provider value={{ navigate, pending }}>{children}</FilterContext.Provider>;
}

/** Navigation für Filterformulare; ohne FilterTransition eine normale Navigation. */
export function useFilterNavigation(): FilterNavigation {
  const router = useRouter();
  const context = useContext(FilterContext);
  return context ?? { navigate: (href) => router.push(href, { scroll: false }), pending: false };
}

/** Ergebnisliste: blasst während des Ladens leicht ab. */
export function FilterResults({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFilterNavigation();
  return (
    <div
      aria-busy={pending || undefined}
      className={cn("transition-opacity duration-200", pending && "opacity-60 delay-100", className)}
    >
      {children}
    </div>
  );
}

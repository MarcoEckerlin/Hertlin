import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Aufzählung mit Haken – für konkrete Punkte, nicht für Werbesprüche. */
export function CheckList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cn("space-y-2.5 text-[0.9375rem] leading-relaxed text-ink-soft", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <Check className="mt-[0.3em] size-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

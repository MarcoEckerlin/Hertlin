import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Aufzählung mit Haken – für konkrete Punkte, nicht für Werbesprüche. */
export function CheckList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cn("space-y-3 text-[0.9375rem] leading-relaxed text-ink-soft", className)}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-200 text-brand-800">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

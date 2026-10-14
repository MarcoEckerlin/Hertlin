import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Sanftes Auf- und Zuklappen von <details> ohne JavaScript (Browser mit ::details-content;
 * andere klappen einfach ohne Animation). Bei „weniger Bewegung“ entfällt die Animation global.
 */
export const detailsAnimationClass =
  "[&::details-content]:h-0 [&::details-content]:overflow-clip [&::details-content]:transition-[height,content-visibility] [&::details-content]:duration-200 [&::details-content]:[transition-behavior:allow-discrete] open:[&::details-content]:h-auto";

/**
 * Karte, die eingeklappt startet – für Selteneres wie „Anfrage löschen“, damit es die Seite nicht verlängert.
 * summary: kurze Zeile unter dem Titel, auch im eingeklappten Zustand sichtbar.
 */
export function DisclosureCard({
  title,
  summary,
  children,
  id,
  className,
}: {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <details id={id} className={cn("group rounded-2xl border border-line bg-surface shadow-card", detailsAnimationClass, className)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 select-none hover:bg-brand-50/50 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-ink">{title}</span>
          {summary ? <span className="mt-0.5 block text-sm text-ink-muted">{summary}</span> : null}
        </span>
        <ChevronDown className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t border-line px-5 py-5 sm:px-6">{children}</div>
    </details>
  );
}

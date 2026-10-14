import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Weiches Auf- und Zuklappen ohne JavaScript (Höhe „auto“ ist über interpolate-size in globals.css animierbar). */
const ANIMATION =
  "details-content:h-0 details-content:overflow-clip details-content:transition-[height,content-visibility] details-content:duration-200 details-content:[transition-behavior:allow-discrete] open:details-content:h-auto";

/**
 * Aufklappbarer Abschnitt (<details>) für Erklärungen und Nebensächliches, das nicht ständig Platz braucht.
 * Funktioniert ohne JavaScript, per Tastatur und mit Screenreadern wie gewohnt.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  summaryClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  summaryClassName?: string;
}) {
  return (
    <details className={cn("group", ANIMATION, className)} open={defaultOpen || undefined}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg [&::-webkit-details-marker]:hidden",
          summaryClassName,
        )}
      >
        <span className="min-w-0">{summary}</span>
        <ChevronDown
          className="size-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      {children}
    </details>
  );
}

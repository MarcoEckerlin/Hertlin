import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export type FaqItem = { question: ReactNode; answer: ReactNode };

/**
 * Häufige Fragen als aufklappbare Liste (ohne JavaScript, per details/summary), getrennt durch feine Linien.
 * Die Antwort klappt weich auf (::details-content mit interpolate-size aus globals.css); Browser ohne
 * Unterstützung klappen ohne Bewegung auf.
 */
export function Faq({ items, onBlue = false, className }: { items: FaqItem[]; onBlue?: boolean; className?: string }) {
  const line = onBlue ? "border-line-strong divide-line-strong" : "border-line divide-line";
  return (
    <div className={cn("divide-y border-y", line, className)}>
      {items.map((item, i) => (
        <details
          key={i}
          className="group details-content:h-0 details-content:overflow-clip details-content:transition-[height,content-visibility] details-content:duration-200 details-content:ease-out details-content:[transition-behavior:allow-discrete] open:details-content:h-auto motion-reduce:details-content:transition-none"
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-base font-semibold text-ink transition-colors hover:text-brand-800 sm:text-[1.0625rem] [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <Plus
              className="mt-0.5 size-5 shrink-0 text-brand-600 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <div className="max-w-prose pr-10 pb-6">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

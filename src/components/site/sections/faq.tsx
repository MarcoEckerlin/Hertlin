import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export type FaqItem = { question: ReactNode; answer: ReactNode };

/** Häufige Fragen als aufklappbare Liste (ohne JavaScript, per details/summary). */
export function Faq({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-line rounded-3xl border border-line bg-white shadow-card", className)}>
      {items.map((item, i) => (
        <details key={i} className="group px-5 py-1 sm:px-7">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-left text-base font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <Plus
              className="mt-0.5 size-5 shrink-0 text-brand-700 transition-transform duration-150 group-open:rotate-45"
              aria-hidden
            />
          </summary>
          <div className="max-w-prose pb-5">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

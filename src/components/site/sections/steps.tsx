import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Step = { title: string; text: ReactNode };

/** Nummerierte Ablaufschritte, nebeneinander ab Desktopbreite. */
export function Steps({
  steps,
  columns = 4,
  tone = "white",
  className,
}: {
  steps: Step[];
  /** Spalten ab Desktopbreite; 2 = auch auf großen Bildschirmen zweispaltig (z. B. in einer Seitenspalte) */
  columns?: 2 | 3 | 4;
  /** Hintergrund der Karten: auf hellblauen Abschnitten "white", auf weißen "brand" */
  tone?: "white" | "brand";
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "grid gap-4 sm:grid-cols-2 sm:gap-5",
        columns === 4 ? "lg:grid-cols-4" : columns === 3 ? "lg:grid-cols-3" : undefined,
        className,
      )}
    >
      {steps.map((step, i) => (
        <li
          key={step.title}
          className={cn(
            "rounded-2xl p-6",
            tone === "white" ? "border border-line bg-white shadow-card" : "bg-brand-50",
          )}
        >
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full bg-brand-400 text-base font-bold text-ink"
          >
            {i + 1}
          </span>
          <h3 className="mt-5 text-lg font-bold text-ink">{step.title}</h3>
          <div className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{step.text}</div>
        </li>
      ))}
    </ol>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Seitenbreite der Website mit einheitlichen Seitenabständen. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/**
 * Kleine Zeile über einer Überschrift (Seitenkopf). Bewusst ohne Großbuchstaben:
 * eine kurze hellblaue Linie und normaler Satzbau.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-[0.9375rem] font-semibold text-brand-800", className)}>
      <span aria-hidden="true" className="h-0.5 w-7 shrink-0 rounded-full bg-primary" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * Feine Linie über einem Inhalt mit kurzer hellblauer Markierung am Anfang – das wiederkehrende
 * Gestaltungsmerkmal der Website für gleichwertige Spalten (statt Kartenrahmen).
 */
export function markedRule(onBlue = false): string {
  return cn(
    "relative border-t before:absolute before:-top-px before:left-0 before:h-0.5 before:w-12 before:bg-primary",
    onBlue ? "border-line-strong" : "border-line",
  );
}

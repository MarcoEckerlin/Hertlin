import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Seitenbreite der Website mit einheitlichen Seitenabständen. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/** Kleine Überzeile über Überschriften. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm font-bold tracking-wider text-brand-700 uppercase", className)}>{children}</p>;
}

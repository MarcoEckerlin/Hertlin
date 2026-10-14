import type { ReactNode } from "react";

/** Beschriftete Angaben untereinander (Label links, Wert rechts bzw. darunter auf schmalen Bildschirmen). */
export function DetailList({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>;
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-medium break-words text-ink">{children}</dd>
    </div>
  );
}

/** Platzhalter für leere Angaben */
export function Missing({ children = "nicht hinterlegt" }: { children?: ReactNode }) {
  return <span className="font-normal text-ink-muted">{children}</span>;
}

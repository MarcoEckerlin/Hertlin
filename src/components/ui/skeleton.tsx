import { cn } from "@/lib/cn";

/** Platzhalter, solange eine Seite lädt (loading.tsx). Ohne Animation bei „weniger Bewegung“. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-line/70 motion-reduce:animate-none", className)} aria-hidden />;
}

/** Typische Seite in Verwaltung und Portal: Überschrift, Werkzeugzeile, Liste. */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Wird geladen …</span>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="mb-5 h-10 w-full max-w-md rounded-2xl" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

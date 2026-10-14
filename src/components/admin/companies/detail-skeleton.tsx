import { Skeleton } from "@/components/ui/skeleton";

/** Platzhalter für Detailseiten der Verwaltung (Kunde, Anfrage, Anruf, Teammitglied, Standort): Kopf, Karten in zwei Spalten. */
export function DetailSkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Wird geladen …</span>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>
      {tabs ? <Skeleton className="mb-6 h-11 w-full max-w-lg rounded-2xl" /> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
        </div>
        <div className="space-y-6">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={2} />
        </div>
      </div>
    </div>
  );
}

/** Platzhalter für Formularseiten (anlegen, bearbeiten, Website-Editor). */
export function FormSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Wird geladen …</span>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64 max-w-full" />
      </div>
      <div className="max-w-3xl space-y-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
    </div>
  );
}

function CardSkeleton({ lines }: { lines: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <Skeleton className="h-5 w-36" />
      </div>
      <div className="space-y-3 px-5 py-5 sm:px-6">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={i % 2 === 0 ? "h-4 w-3/4" : "h-4 w-1/2"} />
        ))}
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

/** Platzhalter in Form der Übersicht: Begrüßung, drei Kennzahlen, zuletzt aktualisierte Tickets. */
export default function PortalDashboardLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Wird geladen …</span>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-line bg-surface p-3 sm:p-5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-8 w-10" />
          </div>
        ))}
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface sm:mt-8 lg:mr-[21.5rem]">
        {[0, 1, 2, 3].map((i) => (
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

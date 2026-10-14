import { Skeleton } from "@/components/ui/skeleton";

/** Platzhalter für das Ticket: Kopf, Schnellleiste, Verlauf und Seitenleiste. */
export default function TicketLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Ticket wird geladen …</span>
      <div className="mb-6 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-3/4 max-w-xl" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <Skeleton className="mb-6 h-[4.25rem] w-full rounded-2xl" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-32 w-full rounded-2xl sm:w-11/12" />
          <Skeleton className="ml-auto h-28 w-full rounded-2xl sm:w-11/12" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

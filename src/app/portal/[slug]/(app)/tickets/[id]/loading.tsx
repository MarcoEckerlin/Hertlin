import { Skeleton } from "@/components/ui/skeleton";

/** Platzhalter in Form der Ticketansicht: Überschrift mit Status, Verlauf, Angaben rechts. */
export default function PortalTicketLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Ticket wird geladen …</span>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-full max-w-lg" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3">
          <Skeleton className="mb-4 h-6 w-24" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`max-w-2xl space-y-3 rounded-2xl border border-line bg-surface p-5 ${i % 2 === 1 ? "sm:mr-12" : "sm:ml-12"}`}
            >
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
        <div className="h-64 rounded-2xl border border-line bg-surface p-5">
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}

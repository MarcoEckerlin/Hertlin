import { PriorityBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

export type ResponseTime = { priority: string; label: string; time: string };

/** "Kritisch – der Betrieb steht" → "Der Betrieb steht" (Priorität steht schon im Badge). */
function describe(label: string): string {
  const parts = label.split(" – ");
  const rest = parts.length > 1 ? parts.slice(1).join(" – ") : label;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * Übersicht der Reaktionszeiten aus den Firmendaten.
 * Als Beschreibungsliste statt Tabelle, damit die Zeilen auf schmalen Bildschirmen sauber umbrechen.
 * Ohne Kasten, nur mit feinen Linien zwischen den Zeilen.
 */
export function ResponseTimesTable({
  items,
  onBlue = false,
  className,
}: {
  items: ResponseTime[];
  onBlue?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;
  const line = onBlue ? "border-line-strong divide-line-strong" : "border-line divide-line";
  return (
    <div className={className}>
      <div
        aria-hidden="true"
        className="hidden justify-between pb-3 text-xs font-semibold text-ink-muted sm:flex"
      >
        <span>Dringlichkeit</span>
        <span>Wir melden uns</span>
      </div>
      <dl className={cn("divide-y border-y", line)}>
        {items.map((r, i) => (
          <div
            key={`${r.priority}-${i}`}
            className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-5"
          >
            <dt className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <PriorityBadge priority={r.priority} />
              <span className="text-[0.9375rem] text-ink sm:text-base">{describe(r.label)}</span>
            </dt>
            <dd className="text-[0.9375rem] font-semibold text-ink sm:text-right sm:text-base">
              <span className="font-normal text-ink-soft sm:sr-only">Rückmeldung </span>
              {r.time}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

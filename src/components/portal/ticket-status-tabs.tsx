import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  STATUS_FILTERS,
  ticketListHref,
  type StatusFilterKey,
  type TicketListQuery,
} from "@/components/portal/ticket-filters";

/** Reiter Offen / Rückfrage an Sie / Erledigt / Alle mit Anzahl; übrige Filter bleiben erhalten. */
export function TicketStatusTabs({
  active,
  counts,
  query,
}: {
  active: StatusFilterKey;
  counts: Record<StatusFilterKey, number>;
  query: Omit<TicketListQuery, "status" | "seite">;
}) {
  return (
    // Umbrechen statt seitlich scrollen: Auf schmalen Bildschirmen stehen die Reiter in zwei Zeilen, keiner ist verdeckt
    <nav aria-label="Tickets nach Status">
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl bg-white p-1 ring-1 ring-line ring-inset">
        {STATUS_FILTERS.map((filter) => {
          const isActive = filter.key === active;
          const count = counts[filter.key];
          const highlight = filter.key === "wartet" && count > 0;
          return (
            <li key={filter.key}>
              <Link
                href={ticketListHref({ ...query, status: filter.key })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                  isActive ? "bg-brand-100 text-ink" : "text-ink-soft hover:bg-brand-50 hover:text-ink",
                )}
              >
                {filter.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.7rem] leading-none font-bold tabular-nums",
                    highlight ? "bg-orange-100 text-orange-800" : isActive ? "bg-white text-ink" : "bg-mist text-ink-muted",
                  )}
                >
                  {count}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

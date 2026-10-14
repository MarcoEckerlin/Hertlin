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
    <nav aria-label="Tickets nach Status" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-full bg-white p-1 ring-1 ring-line ring-inset sm:w-auto sm:max-w-max">
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

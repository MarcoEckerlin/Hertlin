import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { formatTicketNumber } from "@/lib/format";
import { counterpartNumber, formatCallTime, formatPhoneDisplay } from "@/lib/phone";
import { Card, CardHeader } from "@/components/ui/card";
import { CallDirection, CallStatusBadge } from "@/components/admin/calls/call-badges";

/** Felder, die die Karte „Letzte Anrufe“ braucht. */
export const recentCallSelect = {
  id: true,
  direction: true,
  status: true,
  fromNumber: true,
  toNumber: true,
  callerLabel: true,
  answeredBy: true,
  startedAt: true,
  answeredAt: true,
  handledAt: true,
  ticketId: true,
  user: { select: { name: true } },
  company: { select: { name: true, parentId: true } },
} satisfies Prisma.PhoneCallSelect;

export type RecentCall = Prisma.PhoneCallGetPayload<{ select: typeof recentCallSelect }>;

/**
 * Die letzten Anrufe eines Kunden (Firmenkunde inkl. Unterkunden) in der Seitenleiste der Kundenseite.
 * Ohne Anrufe wird nichts angezeigt.
 */
export function RecentCallsCard({
  calls,
  total,
  showCompany,
  searchHref,
}: {
  calls: RecentCall[];
  /** Anzahl aller Anrufe dieses Kunden */
  total: number;
  /** Unterkunde je Anruf nennen (auf der Seite eines Firmenkunden mit Unterkunden) */
  showCompany: boolean;
  /** Link zur Anrufliste, gefiltert auf diesen Kunden */
  searchHref: string;
}) {
  if (calls.length === 0) return null;
  const now = new Date();

  return (
    <Card>
      <CardHeader title="Letzte Anrufe" description={total > calls.length ? `${calls.length} von ${total}` : undefined} />
      <ul className="divide-y divide-line text-sm">
        {calls.map((call) => {
          const who = call.user?.name ?? call.callerLabel;
          const details = [
            who,
            showCompany && call.company?.parentId ? call.company.name : null,
            call.answeredBy && call.status !== "MISSED" ? `bei ${call.answeredBy}` : null,
          ].filter(Boolean);
          return (
            <li key={call.id}>
              <Link
                href={`/admin/anrufe/${call.id}`}
                className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-brand-50/60 sm:px-6"
              >
                <span className="mt-0.5">
                  <CallDirection direction={call.direction} status={call.status} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <span className="font-semibold whitespace-nowrap text-ink tabular-nums">
                      {formatPhoneDisplay(counterpartNumber(call))}
                    </span>
                    <CallStatusBadge call={call} now={now} />
                  </span>
                  {details.length > 0 ? (
                    <span className="mt-0.5 block break-words text-ink-soft">{details.join(" · ")}</span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {formatCallTime(call.startedAt, now)}
                    {call.ticketId ? ` · Ticket ${formatTicketNumber(call.ticketId)}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {total > calls.length ? (
        <div className="border-t border-line px-5 py-3 sm:px-6">
          <Link href={searchHref} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            In der Anrufliste suchen
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

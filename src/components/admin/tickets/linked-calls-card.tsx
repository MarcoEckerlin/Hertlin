import Link from "next/link";
import { counterpartNumber, formatCallTime, formatPhoneDisplay } from "@/lib/phone";
import { Card, CardHeader } from "@/components/ui/card";
import { CallDirection, CallStatusBadge } from "@/components/admin/calls/call-badges";
import type { StaffTicketDetail } from "@/components/admin/tickets/data";

/** Mit dem Ticket verknüpfte Anrufe (aus der Anrufliste). */
export function LinkedCallsCard({ calls }: { calls: StaffTicketDetail["phoneCalls"] }) {
  if (calls.length === 0) return null;
  const now = new Date();
  return (
    <Card>
      <CardHeader title="Anrufe zum Ticket" />
      <ul className="divide-y divide-line text-sm">
        {calls.map((call) => {
          const details = [
            call.callerLabel,
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
                  <span className="mt-0.5 block text-xs text-ink-muted">{formatCallTime(call.startedAt, now)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

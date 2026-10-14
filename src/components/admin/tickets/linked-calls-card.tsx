import Link from "next/link";
import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { CALL_STATUS_LABELS, counterpartNumber, formatCallTime, formatPhoneDisplay, type CallStatus } from "@/lib/phone";
import { labelOf } from "@/lib/constants";
import { Card, CardHeader } from "@/components/ui/card";
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
          const Icon = call.status === "MISSED" ? PhoneMissed : call.direction === "OUT" ? PhoneOutgoing : PhoneIncoming;
          return (
            <li key={call.id}>
              <Link href={`/admin/anrufe/${call.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-brand-50/60 sm:px-6">
                <Icon
                  className={call.status === "MISSED" ? "mt-0.5 size-4 shrink-0 text-red-600" : "mt-0.5 size-4 shrink-0 text-ink-muted"}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-ink tabular-nums">{formatPhoneDisplay(counterpartNumber(call))}</span>
                  <span className="block text-xs text-ink-muted">
                    {call.direction === "OUT" ? "Ausgehend" : "Eingehend"} ·{" "}
                    {labelOf(CALL_STATUS_LABELS as Record<CallStatus, string>, call.status)} · {formatCallTime(call.startedAt, now)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

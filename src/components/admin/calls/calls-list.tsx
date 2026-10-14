import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { aboveRowLinkClass, rowLinkClass } from "@/components/admin/companies/list-tools";
import { cn } from "@/lib/cn";
import { setCallHandledAction } from "@/lib/actions/admin-calls";
import { formatTicketNumber } from "@/lib/format";
import { formatCallDuration, formatCallTime, formatPhoneDisplay, phoneHref } from "@/lib/phone";
import { CallDirection, CallStatusBadge, TestCallBadge } from "./call-badges";

export type CallListItem = {
  id: string;
  provider: string;
  direction: string;
  status: string;
  /** Nummer der Gegenseite (normalisiert) */
  number: string | null;
  callerLabel: string | null;
  callerHref: string | null;
  callerHrefLabel: string | null;
  answeredBy: string | null;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  handledAt: Date | null;
  handledByName: string | null;
  note: string | null;
  ticket: { id: number; subject: string } | null;
};

function duration(call: CallListItem): string {
  const d = formatCallDuration(call.answeredAt, call.endedAt);
  if (d) return d;
  if (call.status === "ANSWERED") return "läuft";
  return "–";
}

function NumberLink({ number }: { number: string | null }) {
  const href = phoneHref(number);
  if (!href) return <span className="text-ink-muted">Rufnummer unterdrückt</span>;
  return (
    <a href={href} className={cn("font-medium whitespace-nowrap text-ink hover:underline", aboveRowLinkClass)} title="Anrufen">
      {formatPhoneDisplay(number)}
    </a>
  );
}

function Caller({ call }: { call: CallListItem }) {
  return (
    <span className="block min-w-0">
      {call.callerLabel ? (
        <span className="block font-semibold break-words text-ink">{call.callerLabel}</span>
      ) : (
        <span className="block text-ink-muted">Nicht erkannt</span>
      )}
      {call.callerHref ? (
        <Link href={call.callerHref} className={cn("text-xs font-semibold text-brand-700 hover:underline", aboveRowLinkClass)}>
          {call.callerHrefLabel}
        </Link>
      ) : null}
      {call.note ? <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">Notiz: {call.note}</span> : null}
    </span>
  );
}

function TicketOrActions({ call }: { call: CallListItem }) {
  if (call.ticket) {
    return (
      <Link href={`/admin/tickets/${call.ticket.id}`} className={cn("group block min-w-0", aboveRowLinkClass)}>
        <span className="font-semibold text-brand-700 group-hover:underline">{formatTicketNumber(call.ticket.id)}</span>
        <span className="block max-w-[14rem] truncate text-xs text-ink-muted">{call.ticket.subject}</span>
      </Link>
    );
  }
  const openMissed = call.status === "MISSED" && !call.handledAt;
  return (
    <span className={cn("flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:justify-start", aboveRowLinkClass)}>
      <ButtonLink href={`/admin/anrufe/${call.id}#ticket-anlegen`} variant="secondary" size="sm">
        Ticket anlegen
      </ButtonLink>
      {openMissed ? (
        <form action={setCallHandledAction.bind(null, call.id, true)}>
          <SubmitButton variant="ghost" size="sm" pendingText="…" title="Zurückgerufen oder anderweitig erledigt">
            Erledigt
          </SubmitButton>
        </form>
      ) : null}
    </span>
  );
}

/** Anrufliste; auf dem Handy wird jede Zeile zur Karte. Die ganze Zeile öffnet den Anruf. */
export function CallsList({ calls, now }: { calls: CallListItem[]; now: Date }) {
  return (
    <Table stack>
      <THead>
        <tr>
          <TH>Zeit</TH>
          <TH>Nummer</TH>
          <TH>Anrufer</TH>
          <TH>Status</TH>
          <TH>Gespräch</TH>
          <TH>Ticket</TH>
        </tr>
      </THead>
      <tbody>
        {calls.map((call) => {
          const length = duration(call);
          return (
            <TR key={call.id} className="relative">
              <TD className="whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <CallDirection direction={call.direction} status={call.status} />
                  <Link
                    href={`/admin/anrufe/${call.id}`}
                    className={cn("font-medium text-ink hover:underline", rowLinkClass)}
                  >
                    {formatCallTime(call.startedAt, now)}
                  </Link>
                  <TestCallBadge provider={call.provider} />
                </span>
              </TD>
              <TD label="Nummer">
                <NumberLink number={call.number} />
              </TD>
              <TD label="Anrufer" className="max-w-[18rem]">
                <Caller call={call} />
              </TD>
              <TD label="Status">
                <span>
                  <CallStatusBadge call={call} now={now} />
                  {call.handledAt && call.handledByName ? (
                    <span className="mt-1 block text-xs text-ink-muted">erledigt von {call.handledByName}</span>
                  ) : null}
                </span>
              </TD>
              <TD label="Gespräch" className="whitespace-nowrap">
                {call.answeredBy || length !== "–" ? (
                  <span>
                    {call.answeredBy ?? <span className="text-ink-muted">–</span>}
                    {length !== "–" ? <span className="block text-xs text-ink-muted">{length}</span> : null}
                  </span>
                ) : (
                  <span className="text-ink-muted">–</span>
                )}
              </TD>
              <TD label="Ticket">
                <TicketOrActions call={call} />
              </TD>
            </TR>
          );
        })}
      </tbody>
    </Table>
  );
}

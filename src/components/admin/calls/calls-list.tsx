import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
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
    <a href={href} className="font-medium whitespace-nowrap text-ink hover:underline" title="Anrufen">
      {formatPhoneDisplay(number)}
    </a>
  );
}

function Caller({ call }: { call: CallListItem }) {
  return (
    <div className="min-w-0">
      {call.callerLabel ? (
        <p className="font-semibold break-words text-ink">{call.callerLabel}</p>
      ) : (
        <p className="text-ink-muted">Nicht erkannt</p>
      )}
      {call.callerHref ? (
        <Link href={call.callerHref} className="text-xs font-semibold text-brand-700 hover:underline">
          {call.callerHrefLabel}
        </Link>
      ) : null}
      {call.note ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">Notiz: {call.note}</p> : null}
    </div>
  );
}

function TicketOrActions({ call }: { call: CallListItem }) {
  if (call.ticket) {
    return (
      <Link href={`/admin/tickets/${call.ticket.id}`} className="group block min-w-0">
        <span className="font-semibold text-brand-700 group-hover:underline">{formatTicketNumber(call.ticket.id)}</span>
        <span className="block max-w-[14rem] truncate text-xs text-ink-muted">{call.ticket.subject}</span>
      </Link>
    );
  }
  const openMissed = call.status === "MISSED" && !call.handledAt;
  return (
    <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}

/** Anrufliste: Tabelle ab mittlerer Breite, darunter Karten. */
export function CallsList({ calls, now }: { calls: CallListItem[]; now: Date }) {
  return (
    <>
      <ul className="space-y-3 md:hidden">
        {calls.map((call) => (
          <li key={call.id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5">
                  <CallDirection direction={call.direction} status={call.status} />
                </span>
                <div className="min-w-0">
                  <Link href={`/admin/anrufe/${call.id}`} className="font-semibold break-words text-ink hover:underline">
                    {call.callerLabel ?? formatPhoneDisplay(call.number)}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {formatCallTime(call.startedAt, now)}
                    {call.answeredBy ? ` · ${call.answeredBy}` : ""}
                    {formatCallDuration(call.answeredAt, call.endedAt) ? ` · ${formatCallDuration(call.answeredAt, call.endedAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <CallStatusBadge call={call} now={now} />
                <TestCallBadge provider={call.provider} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              <NumberLink number={call.number} />
              <TicketOrActions call={call} />
            </div>
            {call.callerHref ? (
              <Link href={call.callerHref} className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">
                {call.callerHrefLabel}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <Table>
          <THead>
            <tr>
              <TH>Zeit</TH>
              <TH>
                <span className="sr-only">Richtung</span>
              </TH>
              <TH>Nummer</TH>
              <TH>Anrufer</TH>
              <TH>Status</TH>
              <TH>Mitarbeiter</TH>
              <TH>Dauer</TH>
              <TH>Ticket</TH>
            </tr>
          </THead>
          <tbody>
            {calls.map((call) => (
              <TR key={call.id}>
                <TD className="whitespace-nowrap">
                  <Link href={`/admin/anrufe/${call.id}`} className="font-medium text-ink hover:underline">
                    {formatCallTime(call.startedAt, now)}
                  </Link>
                  <div className="mt-1">
                    <TestCallBadge provider={call.provider} />
                  </div>
                </TD>
                <TD>
                  <CallDirection direction={call.direction} status={call.status} />
                </TD>
                <TD>
                  <NumberLink number={call.number} />
                </TD>
                <TD className="max-w-[18rem]">
                  <Caller call={call} />
                </TD>
                <TD>
                  <CallStatusBadge call={call} now={now} />
                  {call.handledAt && call.handledByName ? (
                    <p className="mt-1 text-xs text-ink-muted">erledigt von {call.handledByName}</p>
                  ) : null}
                </TD>
                <TD className="whitespace-nowrap">{call.answeredBy ?? "–"}</TD>
                <TD className="whitespace-nowrap">{duration(call)}</TD>
                <TD>
                  <TicketOrActions call={call} />
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  );
}

import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, formatRelative, formatTicketNumber } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { customerLabel, type StaffTicketRow } from "@/components/admin/tickets/data";

export type CostSums = Map<number, { total: number; open: number }>;

function Updated({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)}>
      {formatRelative(date)}
    </time>
  );
}

function urgent(priority: string): boolean {
  return priority === "HIGH" || priority === "CRITICAL";
}

function AssigneeName({ ticket, currentUserId }: { ticket: StaffTicketRow; currentUserId: string }) {
  if (!ticket.assignee) return <span className="text-ink-muted">nicht zugewiesen</span>;
  return (
    <span className={cn("block max-w-[10rem] truncate", ticket.assignee.id === currentUserId && "font-semibold text-ink")}>
      {ticket.assignee.name}
      {ticket.assignee.id === currentUserId ? <span className="sr-only"> (Sie)</span> : null}
    </span>
  );
}

/** Standort unaufdringlich hinter dem Kunden */
function LocationTag({ ticket }: { ticket: StaffTicketRow }) {
  if (!ticket.location) return null;
  return (
    <span className="inline-flex max-w-[12rem] shrink-0 items-center gap-1" title={`Standort: ${ticket.location.name}`}>
      <MapPin className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">Standort: </span>
      <span className="truncate">{ticket.location.name}</span>
    </span>
  );
}

/** Kosten in einer Zeile: Betrag, dahinter ein Punkt, solange etwas nicht abgerechnet ist */
function CostCell({ sums }: { sums: { total: number; open: number } | undefined }) {
  if (!sums || sums.total === 0) return <span className="text-ink-muted">–</span>;
  const title =
    sums.open === 0 ? "abgerechnet" : sums.open === sums.total ? "nicht abgerechnet" : `offen ${formatMoney(sums.open)}`;
  return (
    <span className="inline-flex items-center justify-end gap-1.5" title={title}>
      <span className="font-semibold text-ink tabular-nums">{formatMoney(sums.total)}</span>
      {sums.open > 0 ? (
        <span className="size-2 shrink-0 rounded-full bg-warning-solid" aria-hidden />
      ) : (
        <span className="size-2 shrink-0" aria-hidden />
      )}
      <span className="sr-only">({title})</span>
    </span>
  );
}

/**
 * Ticketliste der Verwaltung: Tabelle ab md, darunter als Kartenliste.
 * Wenige, zusammengefasste Spalten, damit nichts abgeschnitten wird; die ganze Zeile führt zum Ticket.
 * costs: NUR für Administratoren übergeben – ohne diesen Wert gibt es keine Kostenspalte.
 * showLocation: Standort hinter dem Kunden zeigen (sinnvoll erst ab mehreren Standorten).
 */
export function StaffTicketTable({
  tickets,
  currentUserId,
  costs,
  showLocation = false,
}: {
  tickets: StaffTicketRow[];
  currentUserId: string;
  costs?: CostSums;
  showLocation?: boolean;
}) {
  const showCosts = costs !== undefined;
  return (
    <>
      <div className="hidden md:block">
        <Table className="min-w-0 table-fixed">
          <THead>
            <tr>
              <TH>Ticket</TH>
              <TH className="w-40">Status</TH>
              <TH className="w-40">Bearbeiter</TH>
              <TH className="w-32 max-lg:hidden">Aktualisiert</TH>
              {showCosts ? <TH className="w-32 text-right">Kosten</TH> : null}
              <TH className="w-10">
                <span className="sr-only">Öffnen</span>
              </TH>
            </tr>
          </THead>
          <tbody>
            {tickets.map((ticket) => (
              <TR
                key={ticket.id}
                className={cn(
                  "group relative cursor-pointer",
                  ticket.priority === "CRITICAL" && ticket.status !== "CLOSED" && "bg-danger-soft/50",
                )}
              >
                <TD>
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    title={ticket.subject}
                    className="block truncate font-semibold text-ink after:absolute after:inset-0 group-hover:text-brand-700 focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-600"
                  >
                    {ticket.subject}
                  </Link>
                  <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-ink-muted">
                    <span className="shrink-0 font-medium tabular-nums">{formatTicketNumber(ticket.id)}</span>
                    <span aria-hidden>·</span>
                    <span className="min-w-0 truncate" title={customerLabel(ticket)}>
                      {customerLabel(ticket)}
                    </span>
                    {showLocation ? <LocationTag ticket={ticket} /> : null}
                  </span>
                </TD>
                <TD>
                  <span className="flex flex-col items-start gap-1">
                    <StatusBadge status={ticket.status} audience="staff" />
                    {urgent(ticket.priority) ? <PriorityBadge priority={ticket.priority} /> : null}
                  </span>
                </TD>
                <TD>
                  <AssigneeName ticket={ticket} currentUserId={currentUserId} />
                </TD>
                <TD className="whitespace-nowrap max-lg:hidden">
                  <Updated date={ticket.updatedAt} />
                </TD>
                {showCosts ? (
                  <TD className="text-right whitespace-nowrap">
                    <CostCell sums={costs.get(ticket.id)} />
                  </TD>
                ) : null}
                <TD className="px-2">
                  <ChevronRight className="size-4 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {tickets.map((ticket) => {
          const sums = costs?.get(ticket.id);
          return (
            <li key={ticket.id}>
              <Link
                href={`/admin/tickets/${ticket.id}`}
                className={cn(
                  "block rounded-2xl border border-line p-4 shadow-card transition-colors hover:border-brand-300 active:bg-brand-50",
                  ticket.priority === "CRITICAL" && ticket.status !== "CLOSED" ? "bg-danger-soft/50" : "bg-surface",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-muted tabular-nums">{formatTicketNumber(ticket.id)}</span>
                  <StatusBadge status={ticket.status} audience="staff" />
                </div>
                <p className="mt-2 font-semibold break-words text-ink">{ticket.subject}</p>
                <p className="mt-1 text-sm break-words text-ink-muted">{customerLabel(ticket)}</p>
                {showLocation && ticket.location ? (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    <LocationTag ticket={ticket} />
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-ink-muted">
                  <span className="flex items-center gap-2">
                    {urgent(ticket.priority) ? <PriorityBadge priority={ticket.priority} /> : null}
                    {ticket.assignee ? ticket.assignee.name : "nicht zugewiesen"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Updated date={ticket.updatedAt} />
                    {showCosts && sums && sums.total > 0 ? (
                      <>
                        <span aria-hidden>·</span>
                        <CostCell sums={sums} />
                      </>
                    ) : null}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Kompakte Ticketliste für die Übersicht. Auf dem Handy steht der Status unter dem Titel, damit dieser Platz hat. */
export function StaffTicketList({ tickets, emptyText }: { tickets: StaffTicketRow[]; emptyText: string }) {
  if (tickets.length === 0) return <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/admin/tickets/${ticket.id}`}
            className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-brand-50/60 sm:px-6"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-semibold text-ink group-hover:text-brand-700 sm:truncate">{ticket.subject}</p>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                <span className="tabular-nums">{formatTicketNumber(ticket.id)}</span> · {customerLabel(ticket)} ·{" "}
                <Updated date={ticket.updatedAt} />
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                <StatusBadge status={ticket.status} audience="staff" />
                {urgent(ticket.priority) ? <PriorityBadge priority={ticket.priority} /> : null}
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              {urgent(ticket.priority) ? <PriorityBadge priority={ticket.priority} /> : null}
              <StatusBadge status={ticket.status} audience="staff" />
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

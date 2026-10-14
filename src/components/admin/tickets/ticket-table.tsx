import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

function AssigneeName({ ticket, currentUserId }: { ticket: StaffTicketRow; currentUserId: string }) {
  if (!ticket.assignee) return <span className="text-ink-muted">nicht zugewiesen</span>;
  return (
    <span className={cn("block max-w-[10rem] truncate", ticket.assignee.id === currentUserId && "font-semibold text-ink")}>
      {ticket.assignee.name}
      {ticket.assignee.id === currentUserId ? <span className="sr-only"> (Sie)</span> : null}
    </span>
  );
}

function CostCell({ sums }: { sums: { total: number; open: number } | undefined }) {
  if (!sums || sums.total === 0) return <span className="text-ink-muted">–</span>;
  return (
    <span className="block text-right">
      <span className="font-semibold text-ink tabular-nums">{formatMoney(sums.total)}</span>
      {sums.open > 0 ? (
        <span className="block text-xs text-amber-800 tabular-nums">
          {sums.open === sums.total ? "nicht abgerechnet" : `offen ${formatMoney(sums.open)}`}
        </span>
      ) : (
        <span className="block text-xs text-ink-muted">abgerechnet</span>
      )}
    </span>
  );
}

/**
 * Ticketliste der Verwaltung: Tabelle ab md, darunter als Kartenliste.
 * costs: NUR für Administratoren übergeben – ohne diesen Wert gibt es keine Kostenspalte.
 */
export function StaffTicketTable({
  tickets,
  currentUserId,
  costs,
}: {
  tickets: StaffTicketRow[];
  currentUserId: string;
  costs?: CostSums;
}) {
  const showCosts = costs !== undefined;
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead>
            <tr>
              <TH>Nr.</TH>
              <TH>Betreff und Kunde</TH>
              <TH>Status</TH>
              <TH>Priorität</TH>
              <TH>Bearbeiter</TH>
              <TH>Aktualisiert</TH>
              {showCosts ? <TH className="text-right">Kosten</TH> : null}
            </tr>
          </THead>
          <tbody>
            {tickets.map((ticket) => (
              <TR key={ticket.id} className={ticket.priority === "CRITICAL" && ticket.status !== "CLOSED" ? "bg-red-50/40" : undefined}>
                <TD className="font-medium whitespace-nowrap text-ink-muted tabular-nums">{formatTicketNumber(ticket.id)}</TD>
                <TD>
                  <Link
                    href={`/admin/tickets/${ticket.id}`}
                    title={ticket.subject}
                    className="block max-w-[24rem] truncate font-semibold text-ink hover:text-brand-700 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                  <span className="mt-0.5 block max-w-[24rem] truncate text-xs text-ink-muted" title={customerLabel(ticket)}>
                    {customerLabel(ticket)}
                  </span>
                </TD>
                <TD>
                  <StatusBadge status={ticket.status} audience="staff" />
                </TD>
                <TD>
                  <PriorityBadge priority={ticket.priority} />
                </TD>
                <TD>
                  <AssigneeName ticket={ticket} currentUserId={currentUserId} />
                </TD>
                <TD className="whitespace-nowrap">
                  <Updated date={ticket.updatedAt} />
                </TD>
                {showCosts ? (
                  <TD className="whitespace-nowrap">
                    <CostCell sums={costs.get(ticket.id)} />
                  </TD>
                ) : null}
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
                className="block rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:border-brand-300 active:bg-brand-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-muted tabular-nums">{formatTicketNumber(ticket.id)}</span>
                  <StatusBadge status={ticket.status} audience="staff" />
                </div>
                <p className="mt-2 font-semibold break-words text-ink">{ticket.subject}</p>
                <p className="mt-1 text-sm break-words text-ink-muted">{customerLabel(ticket)}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs text-ink-muted">
                  <span className="flex items-center gap-2">
                    <PriorityBadge priority={ticket.priority} />
                    {ticket.assignee ? ticket.assignee.name : "nicht zugewiesen"}
                  </span>
                  <span>
                    <Updated date={ticket.updatedAt} />
                    {showCosts && sums && sums.total > 0 ? ` · ${formatMoney(sums.total)}` : null}
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

/** Kompakte Ticketliste für die Übersicht. */
export function StaffTicketList({ tickets, emptyText }: { tickets: StaffTicketRow[]; emptyText: string }) {
  if (tickets.length === 0) return <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">{emptyText}</p>;
  return (
    <ul className="divide-y divide-line">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/admin/tickets/${ticket.id}`}
            className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-brand-50/60 sm:px-6"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink group-hover:text-brand-700">{ticket.subject}</p>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                <span className="tabular-nums">{formatTicketNumber(ticket.id)}</span> · {customerLabel(ticket)} ·{" "}
                <Updated date={ticket.updatedAt} />
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {ticket.priority === "HIGH" || ticket.priority === "CRITICAL" ? (
                <span className="hidden sm:block">
                  <PriorityBadge priority={ticket.priority} />
                </span>
              ) : null}
              <StatusBadge status={ticket.status} audience="staff" />
            </div>
            <ChevronRight className="size-4 shrink-0 text-ink-muted" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

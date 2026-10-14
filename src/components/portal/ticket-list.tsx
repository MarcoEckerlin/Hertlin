import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORY_LABELS, TYPE_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatRelative, formatTicketNumber } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import type { PortalTicketRow } from "@/components/portal/portal-data";

function creatorName(ticket: PortalTicketRow): string {
  return ticket.createdBy?.name ?? ticket.contactName ?? "–";
}

function Updated({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)}>
      {formatRelative(date)}
    </time>
  );
}

/**
 * Ticketliste: auf großen Bildschirmen als Tabelle, auf dem Handy als Kartenliste.
 * showCompany: Firma/Unterkunde anzeigen (nur sinnvoll bei mehreren Firmen im Sichtbereich)
 * showCreator: „Gemeldet von“ anzeigen (für Hauptansprechpartner)
 */
export function TicketTable({
  tickets,
  showCompany,
  showCreator,
}: {
  tickets: PortalTicketRow[];
  showCompany: boolean;
  showCreator: boolean;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <THead>
            <tr>
              <TH>Nr.</TH>
              <TH>Betreff</TH>
              {showCompany ? <TH>Firma</TH> : null}
              {showCreator ? <TH>Gemeldet von</TH> : null}
              <TH>Status</TH>
              <TH>Priorität</TH>
              <TH>Aktualisiert</TH>
            </tr>
          </THead>
          <tbody>
            {tickets.map((ticket) => (
              <TR key={ticket.id}>
                <TD className="font-medium whitespace-nowrap text-ink-muted tabular-nums">{formatTicketNumber(ticket.id)}</TD>
                <TD>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    title={ticket.subject}
                    className="block max-w-[22rem] truncate font-semibold text-ink hover:text-brand-700 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                  <span className="mt-0.5 block max-w-[22rem] truncate text-xs text-ink-muted">
                    {labelOf(TYPE_LABELS, ticket.type)} · {labelOf(CATEGORY_LABELS, ticket.category)}
                  </span>
                </TD>
                {showCompany ? (
                  <TD>
                    <span className="block max-w-[12rem] truncate" title={ticket.company?.name}>
                      {ticket.company?.name ?? "–"}
                    </span>
                  </TD>
                ) : null}
                {showCreator ? (
                  <TD>
                    <span className="block max-w-[10rem] truncate">{creatorName(ticket)}</span>
                  </TD>
                ) : null}
                <TD>
                  <StatusBadge status={ticket.status} />
                </TD>
                <TD>
                  <PriorityBadge priority={ticket.priority} />
                </TD>
                <TD className="whitespace-nowrap">
                  <Updated date={ticket.updatedAt} />
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {tickets.map((ticket) => {
          const meta = [
            showCompany ? ticket.company?.name : null,
            showCreator ? creatorName(ticket) : null,
            labelOf(TYPE_LABELS, ticket.type),
          ].filter(Boolean);
          return (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.id}`}
                className="block rounded-2xl border border-line bg-white p-4 shadow-card transition-colors hover:border-brand-300 active:bg-brand-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-muted tabular-nums">{formatTicketNumber(ticket.id)}</span>
                  <StatusBadge status={ticket.status} />
                </div>
                <p className="mt-2 font-semibold break-words text-ink">{ticket.subject}</p>
                <p className="mt-1 text-sm text-ink-muted">{meta.join(" · ")}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-muted">
                  <PriorityBadge priority={ticket.priority} />
                  <span>
                    Aktualisiert <Updated date={ticket.updatedAt} />
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

/** Kompakte Liste der zuletzt aktualisierten Tickets für die Übersicht. */
export function RecentTickets({ tickets, showCompany }: { tickets: PortalTicketRow[]; showCompany: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Link
            href={`/tickets/${ticket.id}`}
            className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-brand-50/60 sm:px-6"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink group-hover:text-brand-700">{ticket.subject}</p>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                <span className="tabular-nums">{formatTicketNumber(ticket.id)}</span>
                {showCompany && ticket.company ? ` · ${ticket.company.name}` : null}
                {" · "}
                <Updated date={ticket.updatedAt} />
              </p>
            </div>
            <StatusBadge status={ticket.status} />
            <ChevronRight className="hidden size-4 shrink-0 text-ink-muted sm:block" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

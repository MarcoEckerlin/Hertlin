import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORY_LABELS, TYPE_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatRelative, formatTicketNumber } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { PortalTicketRow } from "@/components/portal/portal-data";

/** Bei diesen Tickets wartet Hertlin auf eine Antwort des Kunden – in Listen hervorheben. */
function waitsForCustomer(ticket: PortalTicketRow): boolean {
  return ticket.status === "WAITING_CUSTOMER";
}

const WAITING_NOTE = "Wir warten auf Ihre Antwort";

/** Schmaler Balken am linken Rand – zusätzlicher Hinweis, nicht nur über die Farbe des Status. */
const WAITING_ACCENT =
  "relative before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-orange-400";

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
              <TR key={ticket.id} className={cn(waitsForCustomer(ticket) && "bg-orange-50/60 hover:bg-orange-50")}>
                <TD
                  className={cn(
                    "font-medium whitespace-nowrap text-ink-muted tabular-nums",
                    waitsForCustomer(ticket) && WAITING_ACCENT,
                  )}
                >
                  {formatTicketNumber(ticket.id)}
                </TD>
                <TD>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    title={ticket.subject}
                    className="block max-w-[22rem] truncate font-semibold text-ink hover:text-brand-700 hover:underline"
                  >
                    {ticket.subject}
                  </Link>
                  {waitsForCustomer(ticket) ? (
                    <span className="mt-0.5 block max-w-[22rem] truncate text-xs font-semibold text-orange-800">
                      {WAITING_NOTE}
                    </span>
                  ) : (
                    <span className="mt-0.5 block max-w-[22rem] truncate text-xs text-ink-muted">
                      {labelOf(TYPE_LABELS, ticket.type)} · {labelOf(CATEGORY_LABELS, ticket.category)}
                    </span>
                  )}
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
                className={cn(
                  "block rounded-2xl border bg-white p-4 shadow-card transition-colors active:bg-brand-50",
                  waitsForCustomer(ticket)
                    ? cn("border-orange-200 bg-orange-50/60 hover:border-orange-300", WAITING_ACCENT)
                    : "border-line hover:border-brand-300",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-ink-muted tabular-nums">{formatTicketNumber(ticket.id)}</span>
                  <StatusBadge status={ticket.status} />
                </div>
                <p className="mt-2 font-semibold break-words text-ink">{ticket.subject}</p>
                {waitsForCustomer(ticket) ? <p className="mt-1 text-sm font-semibold text-orange-800">{WAITING_NOTE}</p> : null}
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
            className={cn(
              "group flex items-center gap-4 px-5 py-3.5 transition-colors sm:px-6",
              waitsForCustomer(ticket)
                ? cn("bg-orange-50/60 hover:bg-orange-50", WAITING_ACCENT)
                : "hover:bg-brand-50/60",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-ink group-hover:text-brand-700">{ticket.subject}</p>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                <span className="tabular-nums">{formatTicketNumber(ticket.id)}</span>
                {showCompany && ticket.company ? ` · ${ticket.company.name}` : null}
                {" · "}
                {waitsForCustomer(ticket) ? (
                  <span className="font-semibold text-orange-800">{WAITING_NOTE}</span>
                ) : (
                  <Updated date={ticket.updatedAt} />
                )}
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

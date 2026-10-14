import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORY_LABELS, TYPE_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatRelative, formatTicketNumber } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Table, TD, TH, THead } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import type { PortalTicketRow } from "@/components/portal/portal-data";

/** Bei diesen Tickets wartet Hertlin auf eine Antwort des Kunden – in Listen hervorheben. */
function waitsForCustomer(ticket: PortalTicketRow): boolean {
  return ticket.status === "WAITING_CUSTOMER";
}

const WAITING_NOTE = "Wir warten auf Ihre Antwort";

/** Schmaler Balken am linken Rand – zusätzlicher Hinweis, nicht nur über die Farbe des Status. */
const WAITING_ACCENT =
  "before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-full before:bg-caution-solid";

/** Ganze Zeile bzw. Karte klickbar: Der Link spannt sich über sein nächstes positioniertes Elternelement. */
const STRETCHED_LINK =
  "outline-none after:absolute after:inset-0 focus-visible:after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-brand-600";

function creatorName(ticket: PortalTicketRow): string | null {
  return ticket.createdBy?.name ?? ticket.contactName ?? null;
}

function Updated({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)}>
      {formatRelative(date)}
    </time>
  );
}

/** Zweite Zeile unter dem Betreff: Nummer, Art/Bereich bzw. Rückfrage, Firma, wer gemeldet hat, wann zuletzt geändert. */
function Subline({
  ticket,
  showCreator,
  showCompany,
  wrap = false,
}: {
  ticket: PortalTicketRow;
  showCreator: boolean;
  showCompany: boolean;
  /** true: darf umbrechen (Karten auf dem Handy), sonst eine Zeile mit Auslassungspunkten */
  wrap?: boolean;
}) {
  const creator = showCreator ? creatorName(ticket) : null;
  const parts = [
    showCompany && ticket.company ? ticket.company.name : null,
    creator,
  ].filter(Boolean);
  return (
    <span className={cn("mt-0.5 block text-xs text-ink-muted", wrap ? "break-words" : "truncate")}>
      <span className="font-medium tabular-nums">{formatTicketNumber(ticket.id)}</span>
      {" · "}
      {waitsForCustomer(ticket) ? (
        <span className="font-semibold text-caution-ink">{WAITING_NOTE}</span>
      ) : (
        <>
          {labelOf(TYPE_LABELS, ticket.type)} · {labelOf(CATEGORY_LABELS, ticket.category)}
        </>
      )}
      {parts.length > 0 ? ` · ${parts.join(" · ")}` : null}
      {" · "}
      <Updated date={ticket.updatedAt} />
    </span>
  );
}

/**
 * Ticketliste: ab Tablet als Tabelle (ganze Zeile klickbar, keine abgeschnittenen Spalten), auf dem Handy als Karten.
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
        <Table className="table-fixed">
          <caption className="sr-only">Tickets</caption>
          <THead>
            <tr>
              <TH>Betreff</TH>
              {showCompany ? <TH className="w-48">Firma</TH> : null}
              <TH className="w-44">Status</TH>
              <TH className="w-32">Dringlichkeit</TH>
            </tr>
          </THead>
          <tbody>
            {tickets.map((ticket) => {
              const waiting = waitsForCustomer(ticket);
              return (
                <tr
                  key={ticket.id}
                  className={cn(
                    "relative border-b border-line transition-colors last:border-0",
                    waiting ? "bg-caution-soft/60 hover:bg-caution-soft" : "hover:bg-brand-50/60",
                  )}
                >
                  {/* Balken am linken Rand als Schatten der ersten Zelle (ein ::before an der Zeile würde zur Tabellenzelle) */}
                  <TD className={waiting ? "shadow-[inset_3px_0_0_var(--color-caution-solid)]" : undefined}>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      title={ticket.subject}
                      className={cn("block truncate font-semibold text-ink hover:text-brand-700", STRETCHED_LINK)}
                    >
                      {ticket.subject}
                    </Link>
                    <Subline ticket={ticket} showCreator={showCreator} showCompany={false} />
                  </TD>
                  {showCompany ? (
                    <TD>
                      <span className="block truncate" title={ticket.company?.name}>
                        {ticket.company?.name ?? "–"}
                      </span>
                      {ticket.company?.parentId ? <span className="block text-xs text-ink-muted">Unterkunde</span> : null}
                    </TD>
                  ) : null}
                  <TD>
                    <StatusBadge status={ticket.status} />
                  </TD>
                  <TD>
                    <PriorityBadge priority={ticket.priority} />
                  </TD>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>

      <ul className="space-y-2.5 md:hidden">
        {tickets.map((ticket) => {
          const waiting = waitsForCustomer(ticket);
          return (
            <li key={ticket.id}>
              <Link
                href={`/tickets/${ticket.id}`}
                className={cn(
                  "relative block rounded-2xl border p-4 shadow-card transition-colors active:bg-brand-50",
                  waiting
                    ? cn("border-caution-line bg-caution-soft/60 hover:border-caution-solid", WAITING_ACCENT)
                    : "border-line bg-surface hover:border-brand-300",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 font-semibold break-words text-ink">{ticket.subject}</span>
                  <StatusBadge status={ticket.status} />
                </span>
                <Subline ticket={ticket} showCreator={showCreator} showCompany={showCompany} wrap />
                {ticket.priority === "HIGH" || ticket.priority === "CRITICAL" ? (
                  <span className="mt-2 block">
                    <PriorityBadge priority={ticket.priority} />
                  </span>
                ) : null}
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
      {tickets.map((ticket) => {
        const waiting = waitsForCustomer(ticket);
        return (
          <li key={ticket.id}>
            <Link
              href={`/tickets/${ticket.id}`}
              className={cn(
                "group relative flex items-center gap-4 px-5 py-3.5 transition-colors sm:px-6",
                waiting ? cn("bg-caution-soft/60 hover:bg-caution-soft", WAITING_ACCENT) : "hover:bg-brand-50/60",
              )}
            >
              <div className="min-w-0 flex-1">
                {/* Auf dem Handy darf der Betreff zwei Zeilen haben; der Status steht dann darunter */}
                <p className="line-clamp-2 font-semibold text-ink group-hover:text-brand-700 sm:line-clamp-1">{ticket.subject}</p>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  <span className="tabular-nums">{formatTicketNumber(ticket.id)}</span>
                  {showCompany && ticket.company ? ` · ${ticket.company.name}` : null}
                  {" · "}
                  {waiting ? (
                    <span className="font-semibold text-caution-ink">{WAITING_NOTE}</span>
                  ) : (
                    <Updated date={ticket.updatedAt} />
                  )}
                </p>
                <div className="mt-1.5 sm:hidden">
                  <StatusBadge status={ticket.status} />
                </div>
              </div>
              <div className="hidden shrink-0 sm:block">
                <StatusBadge status={ticket.status} />
              </div>
              <ChevronRight className="hidden size-4 shrink-0 text-ink-muted sm:block" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

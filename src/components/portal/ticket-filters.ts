import { OPEN_STATUSES, type TicketStatus, type TicketType } from "@/lib/constants";

/**
 * Filter der Ticketliste im Kundenportal (Query-Parameter auf deutsch, damit die Adresse lesbar bleibt):
 * /tickets?status=wartet&art=stoerung&suche=drucker&firma=<id>&seite=2
 * Ohne server-only, weil auch das Filterformular im Browser die Adressen baut.
 */

export const STATUS_FILTERS = [
  { key: "offen", label: "Offen", statuses: OPEN_STATUSES },
  { key: "wartet", label: "Rückfrage an Sie", statuses: ["WAITING_CUSTOMER"] },
  { key: "erledigt", label: "Erledigt", statuses: ["RESOLVED", "CLOSED"] },
  { key: "alle", label: "Alle", statuses: null },
] as const satisfies readonly { key: string; label: string; statuses: readonly TicketStatus[] | null }[];

export type StatusFilterKey = (typeof STATUS_FILTERS)[number]["key"];
export const DEFAULT_STATUS_FILTER: StatusFilterKey = "offen";

export const TYPE_FILTERS = {
  stoerung: { type: "STOERUNG", label: "Störungen" },
  anfrage: { type: "ANFRAGE", label: "Anfragen" },
} as const satisfies Record<string, { type: TicketType; label: string }>;

export type TypeFilterKey = keyof typeof TYPE_FILTERS;

export function parseStatusFilter(value: string | undefined): StatusFilterKey {
  return STATUS_FILTERS.find((f) => f.key === value)?.key ?? DEFAULT_STATUS_FILTER;
}

export function parseTypeFilter(value: string | undefined): TypeFilterKey | undefined {
  return value === "stoerung" || value === "anfrage" ? value : undefined;
}

export type TicketListQuery = {
  status?: StatusFilterKey;
  art?: TypeFilterKey;
  suche?: string;
  firma?: string;
  seite?: number;
};

/** Adresse der Ticketliste mit den gesetzten Filtern; Standardwerte bleiben weg. */
export function ticketListHref(query: TicketListQuery): string {
  const params = new URLSearchParams();
  if (query.status && query.status !== DEFAULT_STATUS_FILTER) params.set("status", query.status);
  if (query.art) params.set("art", query.art);
  if (query.suche?.trim()) params.set("suche", query.suche.trim());
  if (query.firma) params.set("firma", query.firma);
  if (query.seite && query.seite > 1) params.set("seite", String(query.seite));
  const search = params.toString();
  return search ? `/tickets?${search}` : "/tickets";
}

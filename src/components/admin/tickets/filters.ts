import {
  OPEN_STATUSES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
} from "@/lib/constants";

/**
 * Filter der Ticketliste in der Verwaltung (/admin/tickets).
 * Reine Funktionen ohne Serverabhängigkeiten – werden auch im Filterformular (Browser) genutzt.
 */

/** Auswahlwert „Privatkunde“ in Kundenauswahl und Filter */
export const PRIVATE_CUSTOMER = "privat";

/** Einrückung für Unterkunden in Auswahllisten (geschützte Leerzeichen) */
export const OPTION_INDENT = "\u00A0\u00A0\u00A0\u00A0";

export const TICKET_VIEWS = ["offen", "erledigt", "alle"] as const;
export type TicketView = (typeof TICKET_VIEWS)[number];

export const VIEW_LABELS: Record<TicketView, string> = {
  offen: "Offen",
  erledigt: "Erledigt",
  alle: "Alle",
};

export const VIEW_STATUSES: Record<TicketView, readonly TicketStatus[]> = {
  offen: OPEN_STATUSES,
  erledigt: ["RESOLVED", "CLOSED"],
  alle: TICKET_STATUSES,
};

export const TICKET_SORTS = ["dringlichkeit", "aktualisiert", "neu"] as const;
export type TicketSort = (typeof TICKET_SORTS)[number];

export const SORT_LABELS: Record<TicketSort, string> = {
  dringlichkeit: "Dringende zuerst",
  aktualisiert: "Zuletzt aktualisiert",
  neu: "Neueste zuerst",
};

export type TicketListFilters = {
  ansicht: TicketView;
  status?: TicketStatus;
  prioritaet?: TicketPriority;
  /** "mir", "keiner" oder die ID eines Mitarbeiters */
  bearbeiter?: string;
  /** "privat" oder die ID eines Firmenkunden bzw. einer Unterkunde */
  kunde?: string;
  art?: TicketType;
  suche: string;
  sortierung: TicketSort;
  seite: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function first(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.trim() : undefined;
}

function oneOf<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** Erledigte Tickets nach Priorität zu sortieren ergibt wenig Sinn – dort zählt, was zuletzt passiert ist. */
export function defaultSort(view: TicketView): TicketSort {
  return view === "erledigt" ? "aktualisiert" : "dringlichkeit";
}

export function parseTicketListFilters(params: RawParams): TicketListFilters {
  const status = oneOf(TICKET_STATUSES, first(params.status));
  let ansicht = oneOf(TICKET_VIEWS, first(params.ansicht)) ?? "offen";
  // Ein einzelner Status bestimmt die Ansicht (z. B. Link „Wartet auf Kunde“ aus der Übersicht)
  if (status && ansicht !== "alle") ansicht = OPEN_STATUSES.includes(status) ? "offen" : "erledigt";

  const bearbeiterRaw = first(params.bearbeiter);
  const bearbeiter =
    bearbeiterRaw === "mir" || bearbeiterRaw === "keiner" || (bearbeiterRaw && ID_PATTERN.test(bearbeiterRaw))
      ? bearbeiterRaw
      : undefined;

  const kundeRaw = first(params.kunde);
  const kunde = kundeRaw === PRIVATE_CUSTOMER || (kundeRaw && ID_PATTERN.test(kundeRaw)) ? kundeRaw : undefined;

  const seiteRaw = Number(first(params.seite));

  return {
    ansicht,
    status,
    prioritaet: oneOf(TICKET_PRIORITIES, first(params.prioritaet)),
    bearbeiter,
    kunde,
    art: oneOf(TICKET_TYPES, first(params.art)),
    suche: (first(params.suche) ?? "").slice(0, 100),
    sortierung: oneOf(TICKET_SORTS, first(params.sortierung)) ?? defaultSort(ansicht),
    seite: Number.isInteger(seiteRaw) && seiteRaw > 0 ? seiteRaw : 1,
  };
}

/** Query-Parameter ohne Standardwerte (für Links und die Seitennavigation). */
export function ticketListQuery(filters: Partial<TicketListFilters>): Record<string, string | undefined> {
  const ansicht = filters.ansicht ?? "offen";
  return {
    ansicht: ansicht !== "offen" ? ansicht : undefined,
    status: filters.status,
    prioritaet: filters.prioritaet,
    bearbeiter: filters.bearbeiter,
    kunde: filters.kunde,
    art: filters.art,
    suche: filters.suche ? filters.suche : undefined,
    sortierung: filters.sortierung && filters.sortierung !== defaultSort(ansicht) ? filters.sortierung : undefined,
  };
}

export function ticketListHref(filters: Partial<TicketListFilters>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(ticketListQuery(filters))) if (value) query.set(key, value);
  if (filters.seite && filters.seite > 1) query.set("seite", String(filters.seite));
  const s = query.toString();
  return s ? `/admin/tickets?${s}` : "/admin/tickets";
}

/** Sind außer der Ansicht weitere Filter aktiv? */
export function hasActiveFilters(filters: TicketListFilters): boolean {
  return Boolean(filters.status || filters.prioritaet || filters.bearbeiter || filters.kunde || filters.art || filters.suche);
}

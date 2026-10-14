"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import {
  PRIORITY_LABELS,
  STATUS_LABELS_STAFF,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  type TicketType,
} from "@/lib/constants";
import {
  NO_LOCATION,
  OPTION_INDENT,
  PRIVATE_CUSTOMER,
  SORT_LABELS,
  TICKET_SORTS,
  VIEW_STATUSES,
  hasActiveFilters,
  parseTicketListFilters,
  ticketListHref,
  type TicketListFilters,
} from "@/components/admin/tickets/filters";
import { useFilterNavigation } from "@/components/admin/tickets/filter-transition";

export type FilterStaffOption = { id: string; name: string; active: boolean };
export type FilterCustomerOption = {
  id: string;
  name: string;
  active: boolean;
  children: { id: string; name: string; active: boolean }[];
};
export type FilterLocationOption = { id: string; name: string; active: boolean };

const TYPE_FILTER_LABELS: Record<TicketType, string> = { STOERUNG: "Nur Störungen", ANFRAGE: "Nur Anfragen" };

/** Wartezeit nach dem letzten Tastendruck, bevor die Suche lädt */
const SEARCH_DELAY_MS = 300;

type Chip = { key: keyof TicketListFilters; label: string; secondary: boolean };

/**
 * Suche und Filter der Ticketliste. Funktioniert ohne JavaScript als GET-Formular;
 * mit JavaScript wirken Auswahllisten sofort und die Suche nach einer kurzen Tipp-Pause.
 * Am Desktop stehen Status, Bearbeiter, Kunde, Standort (ab zwei Standorten) und Sortierung immer da,
 * Priorität und Art unter „Weitere Filter“. Auf dem Handy klappt „Filter“ alles auf; aktive Filter stehen als Chips darunter.
 */
export function TicketFilterForm({
  filters,
  staff,
  customers,
  locations = [],
}: {
  filters: TicketListFilters;
  staff: FilterStaffOption[];
  customers: FilterCustomerOption[];
  /** Alle Standorte (auch deaktivierte, für ältere Tickets). Leer = kein Standortfilter. */
  locations?: FilterLocationOption[];
}) {
  const { navigate } = useFilterNavigation();
  const formRef = useRef<HTMLFormElement>(null);
  const searchTimer = useRef<number | undefined>(undefined);
  const showLocations = locations.length > 0;
  const secondaryActive = [filters.prioritaet, filters.art].filter(Boolean).length;
  const selectActive = secondaryActive + [filters.status, filters.bearbeiter, filters.kunde, filters.standort].filter(Boolean).length;
  const [open, setOpen] = useState(secondaryActive > 0);

  // Suchfeld: eigener Zustand, damit Tippen während des Ladens nicht verloren geht.
  // Kommt die Suche von außen (z. B. „Filter zurücksetzen“), übernimmt das Feld den neuen Wert.
  const [query, setQuery] = useState(filters.suche);
  const [sent, setSent] = useState(filters.suche);
  const [seen, setSeen] = useState(filters.suche);
  if (filters.suche !== seen) {
    setSeen(filters.suche);
    if (filters.suche !== sent) {
      setQuery(filters.suche);
      setSent(filters.suche);
    }
  }

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    window.clearTimeout(searchTimer.current);
    const data = new FormData(form);
    const raw: Record<string, string> = {};
    for (const [key, value] of data.entries()) if (typeof value === "string") raw[key] = value;
    const next = parseTicketListFilters(raw);
    setSent(next.suche);
    navigate(ticketListHref({ ...next, seite: 1 }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply();
  }

  function onSearch(event: ChangeEvent<HTMLInputElement>) {
    setQuery(event.target.value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(apply, SEARCH_DELAY_MS);
  }

  const selectClass = "h-10 text-sm";
  // Auswahllisten neu aufbauen, wenn sich die Filter ändern (z. B. über die Reiter oben)
  const selectsKey = JSON.stringify({ ...filters, suche: undefined, seite: undefined });

  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "Bearbeiter";
  const customerName = (id: string) => {
    for (const c of customers) {
      if (c.id === id) return c.name;
      const child = c.children.find((x) => x.id === id);
      if (child) return `${c.name} › ${child.name}`;
    }
    return "Kunde";
  };
  const chips: Chip[] = [
    filters.status ? { key: "status", label: STATUS_LABELS_STAFF[filters.status], secondary: false } : null,
    filters.bearbeiter
      ? {
          key: "bearbeiter",
          label:
            filters.bearbeiter === "mir"
              ? "Mir zugewiesen"
              : filters.bearbeiter === "keiner"
                ? "Nicht zugewiesen"
                : staffName(filters.bearbeiter),
          secondary: false,
        }
      : null,
    filters.kunde
      ? { key: "kunde", label: filters.kunde === PRIVATE_CUSTOMER ? "Privatkunden" : customerName(filters.kunde), secondary: false }
      : null,
    filters.prioritaet ? { key: "prioritaet", label: `Priorität ${PRIORITY_LABELS[filters.prioritaet]}`, secondary: true } : null,
    filters.art ? { key: "art", label: TYPE_FILTER_LABELS[filters.art], secondary: true } : null,
    filters.standort
      ? {
          key: "standort",
          label: filters.standort === NO_LOCATION ? "Ohne Standort" : (locations.find((l) => l.id === filters.standort)?.name ?? "Standort"),
          secondary: false,
        }
      : null,
  ].filter((c): c is Chip => c !== null);

  return (
    <form
      ref={formRef}
      action="/admin/tickets"
      method="get"
      role="search"
      aria-label="Tickets filtern"
      onSubmit={onSubmit}
      className="space-y-2.5 rounded-2xl border border-line bg-surface p-2.5 shadow-card"
    >
      {filters.ansicht !== "offen" ? <input type="hidden" name="ansicht" value={filters.ansicht} /> : null}

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Label htmlFor="filter-suche" className="sr-only">
            Suche
          </Label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input
            id="filter-suche"
            name="suche"
            type="search"
            value={query}
            onChange={onSearch}
            maxLength={100}
            placeholder="Nummer, Betreff, Kontakt oder Firma"
            className="h-10 pl-10 text-sm"
            enterKeyHint="search"
          />
        </div>
        {/* Ohne JavaScript: Absenden mit Enter oder diesem Knopf */}
        <button type="submit" className="sr-only">
          Suchen
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="ticket-filter-felder"
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold ring-1 ring-inset transition-colors lg:hidden",
            open || selectActive > 0 ? "bg-brand-50 text-ink ring-brand-300" : "text-ink-soft ring-line-strong hover:bg-brand-50",
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filter
          {selectActive > 0 ? <span className="tabular-nums">({selectActive})</span> : null}
        </button>
      </div>

      <div id="ticket-filter-felder" key={selectsKey} className={cn("space-y-2", !open && "max-lg:hidden")}>
        <div
          className={cn(
            "grid grid-cols-1 gap-2 transition-opacity duration-200 starting:opacity-0 min-[26rem]:grid-cols-2",
            showLocations ? "lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]" : "lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]",
            !open && "max-lg:hidden",
          )}
        >
          <div>
            <Label htmlFor="filter-status" className="sr-only">
              Status
            </Label>
            <Select id="filter-status" name="status" defaultValue={filters.status ?? ""} onChange={apply} className={selectClass}>
              <option value="">
                {filters.ansicht === "offen" ? "Alle offenen" : filters.ansicht === "erledigt" ? "Alle erledigten" : "Jeder Status"}
              </option>
              {VIEW_STATUSES[filters.ansicht].map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS_STAFF[s]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-bearbeiter" className="sr-only">
              Bearbeiter
            </Label>
            <Select
              id="filter-bearbeiter"
              name="bearbeiter"
              defaultValue={filters.bearbeiter ?? ""}
              onChange={apply}
              className={selectClass}
            >
              <option value="">Alle Bearbeiter</option>
              <option value="mir">Mir zugewiesen</option>
              <option value="keiner">Nicht zugewiesen</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.active ? s.name : `${s.name} (deaktiviert)`}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-kunde" className="sr-only">
              Kunde
            </Label>
            <Select id="filter-kunde" name="kunde" defaultValue={filters.kunde ?? ""} onChange={apply} className={selectClass}>
              <option value="">Alle Kunden</option>
              <option value={PRIVATE_CUSTOMER}>Privatkunden</option>
              {customers.length > 0 ? (
                <optgroup label="Firmenkunden">
                  {customers.flatMap((c) => [
                    <option key={c.id} value={c.id}>
                      {c.active ? c.name : `${c.name} (inaktiv)`}
                    </option>,
                    ...c.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {`${OPTION_INDENT}${child.name}${child.active ? "" : " (inaktiv)"}`}
                      </option>
                    )),
                  ])}
                </optgroup>
              ) : null}
            </Select>
          </div>

          {showLocations ? (
            <div>
              <Label htmlFor="filter-standort" className="sr-only">
                Standort
              </Label>
              <Select
                id="filter-standort"
                name="standort"
                defaultValue={filters.standort ?? ""}
                onChange={apply}
                className={selectClass}
              >
                <option value="">Alle Standorte</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.active ? l.name : `${l.name} (deaktiviert)`}
                  </option>
                ))}
                <option value={NO_LOCATION}>Ohne Standort</option>
              </Select>
            </div>
          ) : null}

          <div>
            <Label htmlFor="filter-sortierung" className="sr-only">
              Sortierung
            </Label>
            <Select
              id="filter-sortierung"
              name="sortierung"
              defaultValue={filters.sortierung}
              onChange={apply}
              className={selectClass}
            >
              {TICKET_SORTS.map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="ticket-filter-weitere"
            className={cn(
              "hidden h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition-colors lg:inline-flex",
              open || secondaryActive > 0 ? "bg-brand-50 text-ink ring-brand-300" : "text-ink-soft ring-line-strong hover:bg-brand-50 hover:text-ink",
            )}
          >
            Weitere Filter{secondaryActive > 0 ? ` (${secondaryActive})` : ""}
            <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden />
          </button>
        </div>

        <div
          id="ticket-filter-weitere"
          className={cn(
            "grid grid-cols-1 gap-2 transition-opacity duration-200 starting:opacity-0 min-[26rem]:grid-cols-2 lg:grid-cols-4",
            !open && "hidden",
          )}
        >
          <div>
            <Label htmlFor="filter-prioritaet" className="sr-only">
              Priorität
            </Label>
            <Select
              id="filter-prioritaet"
              name="prioritaet"
              defaultValue={filters.prioritaet ?? ""}
              onChange={apply}
              className={selectClass}
            >
              <option value="">Jede Priorität</option>
              {[...TICKET_PRIORITIES].reverse().map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-art" className="sr-only">
              Art
            </Label>
            <Select id="filter-art" name="art" defaultValue={filters.art ?? ""} onChange={apply} className={selectClass}>
              <option value="">Alle Arten</option>
              {TICKET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_FILTER_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

        </div>
      </div>

      {hasActiveFilters(filters) ? (
        <div className="flex flex-wrap items-center gap-1.5 px-0.5 text-sm">
          {!open
            ? chips.map((chip) => (
                <Link
                  key={chip.key}
                  href={ticketListHref({ ...filters, [chip.key]: undefined, seite: 1 })}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 pr-2 pl-3 text-xs font-semibold text-ink ring-1 ring-brand-200 ring-inset hover:bg-brand-100",
                    !chip.secondary && "lg:hidden",
                  )}
                  aria-label={`Filter entfernen: ${chip.label}`}
                >
                  {chip.label}
                  <X className="size-3.5 text-ink-muted" aria-hidden />
                </Link>
              ))
            : null}
          <Link href={ticketListHref({ ansicht: filters.ansicht })} className="ml-1 font-semibold text-brand-700 hover:underline">
            Filter zurücksetzen
          </Link>
        </div>
      ) : null}
    </form>
  );
}

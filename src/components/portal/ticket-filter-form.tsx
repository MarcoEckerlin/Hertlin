"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { Input, Label, Select } from "@/components/ui/field";
import { useListNavigation } from "@/components/portal/list-navigation";
import {
  TYPE_FILTERS,
  parseTypeFilter,
  ticketListHref,
  type StatusFilterKey,
  type TypeFilterKey,
} from "@/components/portal/ticket-filters";

export type FilterCompanyOption = { id: string; name: string; isRoot: boolean; active: boolean };

/** So lange nach dem letzten Tastendruck warten, bevor die Suche startet */
const SEARCH_DELAY_MS = 350;

/**
 * Suche und Filter der Ticketliste. Funktioniert auch ohne JavaScript (GET-Formular).
 * Mit JavaScript: Die Suche startet kurz nach dem Tippen (oder sofort mit Enter), Auswahllisten filtern sofort.
 * Die Liste bleibt dabei stehen und wird ausgegraut, bis die neuen Ergebnisse da sind (ListNavigation).
 */
export function TicketFilterForm({
  status,
  art,
  suche,
  firma,
  companies,
}: {
  status: StatusFilterKey;
  art?: TypeFilterKey;
  suche: string;
  firma?: string;
  companies: FilterCompanyOption[] | null;
}) {
  const { navigate, pending } = useListNavigation();
  const [query, setQuery] = useState(suche);
  const [type, setType] = useState<string>(art ?? "");
  const [company, setCompany] = useState<string>(firma ?? "");
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ändert sich die Adresse von außen (Reiter, „Zurücksetzen“, Zurück-Knopf), die Felder nachziehen.
  // Das Suchfeld nur, solange niemand darin tippt – sonst würde ein älteres Ergebnis den neuen Text überschreiben.
  const [synced, setSynced] = useState({ suche, art, firma });
  if (synced.suche !== suche || synced.art !== art || synced.firma !== firma) {
    setSynced({ suche, art, firma });
    if (!focused) setQuery(suche);
    setType(art ?? "");
    setCompany(firma ?? "");
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const hasFilters = Boolean(art || suche || firma);
  const currentHref = ticketListHref({ status, art, suche, firma });

  function apply(next: { suche?: string; art?: string; firma?: string } = {}) {
    if (timer.current) clearTimeout(timer.current);
    const href = ticketListHref({
      status,
      art: parseTypeFilter(next.art ?? type),
      suche: (next.suche ?? query).trim().slice(0, 100),
      firma: (next.firma ?? company) || undefined,
    });
    if (href !== currentHref) navigate(href);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply();
  }

  return (
    <form
      action="/tickets"
      method="get"
      role="search"
      aria-label="Tickets durchsuchen"
      onSubmit={onSubmit}
      className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3"
    >
      {status !== "offen" ? <input type="hidden" name="status" value={status} /> : null}

      <div className="relative col-span-2 min-w-0 sm:min-w-[16rem] sm:flex-1">
        <Label htmlFor="ticket-suche" className="sr-only">
          Betreff oder Ticketnummer
        </Label>
        {pending ? (
          <LoaderCircle
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-brand-700 motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        )}
        <Input
          id="ticket-suche"
          name="suche"
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setQuery(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => apply({ suche: value }), SEARCH_DELAY_MS);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={100}
          placeholder="Betreff oder Nummer (z. B. T-00042)"
          className="pl-10"
          enterKeyHint="search"
        />
      </div>

      <div className={companies && companies.length > 1 ? "sm:w-44" : "col-span-2 sm:w-44"}>
        <Label htmlFor="ticket-art" className="sr-only">
          Art
        </Label>
        <Select
          id="ticket-art"
          name="art"
          value={type}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setType(value);
            apply({ art: value });
          }}
        >
          <option value="">Alle Arten</option>
          {(Object.keys(TYPE_FILTERS) as TypeFilterKey[]).map((key) => (
            <option key={key} value={key}>
              {TYPE_FILTERS[key].label}
            </option>
          ))}
        </Select>
      </div>

      {companies && companies.length > 1 ? (
        <div className="min-w-0 sm:w-56">
          <Label htmlFor="ticket-firma" className="sr-only">
            Firma
          </Label>
          <Select
            id="ticket-firma"
            name="firma"
            value={company}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCompany(value);
              apply({ firma: value });
            }}
          >
            <option value="">Alle Firmen</option>
            {companies.map((option) => (
              <option key={option.id} value={option.id}>
                {`${option.isRoot ? option.name : `${option.name} (Unterkunde)`}${option.active ? "" : " – deaktiviert"}`}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {/* Ohne JavaScript (und für Tastatur-Nutzer mit Enter) gibt es weiterhin einen Absende-Knopf */}
      <button type="submit" className="sr-only">
        Suchen
      </button>

      {hasFilters ? (
        <div data-list-nav className="col-span-2 sm:col-span-1">
          <Link
            href={ticketListHref({ status })}
            className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Filter zurücksetzen
          </Link>
        </div>
      ) : null}
    </form>
  );
}

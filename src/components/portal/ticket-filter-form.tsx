"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import {
  TYPE_FILTERS,
  parseTypeFilter,
  ticketListHref,
  type StatusFilterKey,
  type TypeFilterKey,
} from "@/components/portal/ticket-filters";

export type FilterCompanyOption = { id: string; name: string; isRoot: boolean; active: boolean };

/**
 * Suche und Filter der Ticketliste. Funktioniert auch ohne JavaScript (GET-Formular),
 * mit JavaScript ohne Neuladen; Auswahllisten filtern sofort.
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
  const router = useRouter();
  const hasFilters = Boolean(art || suche || firma);

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const value = (key: string) => {
      const v = data.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    router.push(
      ticketListHref({
        status,
        art: parseTypeFilter(value("art")),
        suche: value("suche").slice(0, 100),
        firma: value("firma") || undefined,
      }),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(event.currentTarget);
  }

  return (
    <form
      // Neu aufbauen, wenn sich die Adresse ändert (z. B. „Zurücksetzen“), damit die Felder passen
      key={`${status}|${art ?? ""}|${suche}|${firma ?? ""}`}
      action="/tickets"
      method="get"
      role="search"
      aria-label="Tickets durchsuchen"
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center"
    >
      {status !== "offen" ? <input type="hidden" name="status" value={status} /> : null}

      <div className="relative min-w-0 sm:min-w-[14rem] sm:flex-1">
        <Label htmlFor="ticket-suche" className="sr-only">
          Betreff oder Ticketnummer
        </Label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <Input
          id="ticket-suche"
          name="suche"
          type="search"
          defaultValue={suche}
          maxLength={100}
          placeholder="Betreff oder Ticketnummer, z. B. T-00042"
          className="pl-10"
          enterKeyHint="search"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center">
        <div className="sm:w-44">
          <Label htmlFor="ticket-art" className="sr-only">
            Art
          </Label>
          <Select
            id="ticket-art"
            name="art"
            defaultValue={art ?? ""}
            onChange={(event) => event.currentTarget.form && apply(event.currentTarget.form)}
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
          <div className="sm:w-56">
            <Label htmlFor="ticket-firma" className="sr-only">
              Firma
            </Label>
            <Select
              id="ticket-firma"
              name="firma"
              defaultValue={firma ?? ""}
              onChange={(event) => event.currentTarget.form && apply(event.currentTarget.form)}
            >
              <option value="">Alle Firmen</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {`${company.isRoot ? company.name : `${company.name} (Unterkunde)`}${company.active ? "" : " – deaktiviert"}`}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" className="flex-1 sm:flex-none">
          Suchen
        </Button>
        {hasFilters ? (
          <Link
            href={ticketListHref({ status })}
            className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-brand-50 hover:text-ink"
          >
            Zurücksetzen
          </Link>
        ) : null}
      </div>
    </form>
  );
}

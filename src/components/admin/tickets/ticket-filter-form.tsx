"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import {
  PRIORITY_LABELS,
  STATUS_LABELS_STAFF,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  type TicketType,
} from "@/lib/constants";
import {
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

export type FilterStaffOption = { id: string; name: string; active: boolean };
export type FilterCustomerOption = {
  id: string;
  name: string;
  active: boolean;
  children: { id: string; name: string; active: boolean }[];
};

const TYPE_FILTER_LABELS: Record<TicketType, string> = { STOERUNG: "Nur Störungen", ANFRAGE: "Nur Anfragen" };

/**
 * Suche und Filter der Ticketliste. Funktioniert ohne JavaScript als GET-Formular;
 * mit JavaScript wirken Auswahllisten sofort.
 */
export function TicketFilterForm({
  filters,
  staff,
  customers,
}: {
  filters: TicketListFilters;
  staff: FilterStaffOption[];
  customers: FilterCustomerOption[];
}) {
  const router = useRouter();

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const raw: Record<string, string> = {};
    for (const [key, value] of data.entries()) if (typeof value === "string") raw[key] = value;
    const next = parseTicketListFilters(raw);
    router.push(ticketListHref({ ...next, seite: 1 }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(event.currentTarget);
  }

  function onSelect(event: ChangeEvent<HTMLSelectElement>) {
    if (event.currentTarget.form) apply(event.currentTarget.form);
  }

  const selectClass = "h-10 text-sm";

  return (
    <form
      key={JSON.stringify(filters)}
      action="/admin/tickets"
      method="get"
      role="search"
      aria-label="Tickets filtern"
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-line bg-white p-3 shadow-card"
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
            defaultValue={filters.suche}
            maxLength={100}
            placeholder="Nummer, Betreff, Kontakt oder Firma"
            className="h-10 pl-10 text-sm"
            enterKeyHint="search"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-10">
          Suchen
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 min-[26rem]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <div>
          <Label htmlFor="filter-status" className="sr-only">
            Status
          </Label>
          <Select id="filter-status" name="status" defaultValue={filters.status ?? ""} onChange={onSelect} className={selectClass}>
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
          <Label htmlFor="filter-prioritaet" className="sr-only">
            Priorität
          </Label>
          <Select
            id="filter-prioritaet"
            name="prioritaet"
            defaultValue={filters.prioritaet ?? ""}
            onChange={onSelect}
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
          <Select id="filter-art" name="art" defaultValue={filters.art ?? ""} onChange={onSelect} className={selectClass}>
            <option value="">Alle Arten</option>
            {TICKET_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_FILTER_LABELS[t]}
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
            onChange={onSelect}
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
          <Select id="filter-kunde" name="kunde" defaultValue={filters.kunde ?? ""} onChange={onSelect} className={selectClass}>
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

        <div>
          <Label htmlFor="filter-sortierung" className="sr-only">
            Sortierung
          </Label>
          <Select
            id="filter-sortierung"
            name="sortierung"
            defaultValue={filters.sortierung}
            onChange={onSelect}
            className={selectClass}
          >
            {TICKET_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {hasActiveFilters(filters) ? (
        <p className="px-1 text-sm">
          <Link href={ticketListHref({ ansicht: filters.ansicht })} className="font-semibold text-brand-700 hover:underline">
            Filter zurücksetzen
          </Link>
        </p>
      ) : null}
    </form>
  );
}

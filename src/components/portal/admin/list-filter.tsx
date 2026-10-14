"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Search } from "lucide-react";
import { Input, Select } from "@/components/ui/field";
import { useListNavigation } from "@/components/portal/list-navigation";

export type FilterSelect = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

/** So lange nach dem letzten Tastendruck warten, bevor die Suche startet */
const SEARCH_DELAY_MS = 350;

/**
 * Such- und Filterleiste für Listen (GET-Formular, Werte stehen in der Adresse; funktioniert auch ohne JavaScript).
 * Mit JavaScript sucht sie kurz nach dem Tippen, Auswahllisten filtern sofort. Neue Filter beginnen auf Seite 1.
 */
export function ListFilter({
  action,
  query,
  searchLabel,
  placeholder,
  selects = [],
  active,
}: {
  action: string;
  query: string;
  searchLabel: string;
  placeholder: string;
  selects?: FilterSelect[];
  /** Ist irgendein Filter gesetzt? Dann gibt es „Filter zurücksetzen“. */
  active: boolean;
}) {
  const idPrefix = `filter-${action.replace(/[^a-z0-9]+/gi, "") || "liste"}`;
  const { navigate, pending } = useListNavigation();
  const current = Object.fromEntries(selects.map((s) => [s.name, s.value]));
  const currentKey = selects.map((s) => `${s.name}=${s.value}`).join("&");

  const [text, setText] = useState(query);
  const [values, setValues] = useState<Record<string, string>>(current);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ändert sich die Adresse von außen („Zurücksetzen“, Zurück-Knopf), die Felder nachziehen –
  // das Suchfeld nur, solange niemand darin tippt.
  const [synced, setSynced] = useState({ query, currentKey });
  if (synced.query !== query || synced.currentKey !== currentKey) {
    setSynced({ query, currentKey });
    if (!focused) setText(query);
    setValues(current);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function hrefFor(q: string, vals: Record<string, string>): string {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim().slice(0, 100));
    for (const s of selects) if (vals[s.name]) params.set(s.name, vals[s.name]);
    const search = params.toString();
    return search ? `${action}?${search}` : action;
  }

  function apply(nextText: string, nextValues: Record<string, string>) {
    if (timer.current) clearTimeout(timer.current);
    const href = hrefFor(nextText, nextValues);
    if (href !== hrefFor(query, current)) navigate(href);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(text, values);
  }

  return (
    <form
      action={action}
      method="get"
      role="search"
      aria-label={searchLabel}
      onSubmit={onSubmit}
      className="mb-5 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3"
    >
      <div className="relative min-w-0 sm:min-w-[16rem] sm:flex-1">
        <label htmlFor={`${idPrefix}-q`} className="sr-only">
          {searchLabel}
        </label>
        {pending ? (
          <LoaderCircle
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-brand-700 motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        )}
        <Input
          id={`${idPrefix}-q`}
          name="q"
          type="search"
          value={text}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setText(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => apply(value, values), SEARCH_DELAY_MS);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          maxLength={100}
          enterKeyHint="search"
          className="pl-10"
        />
      </div>
      {selects.map((s) => (
        <div key={s.name} className="sm:w-52">
          <label htmlFor={`${idPrefix}-${s.name}`} className="sr-only">
            {s.label}
          </label>
          <Select
            id={`${idPrefix}-${s.name}`}
            name={s.name}
            value={values[s.name] ?? ""}
            onChange={(event) => {
              const next = { ...values, [s.name]: event.currentTarget.value };
              setValues(next);
              apply(text, next);
            }}
          >
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      {/* Ohne JavaScript (und für Enter) gibt es weiterhin einen Absende-Knopf */}
      <button type="submit" className="sr-only">
        Anzeigen
      </button>
      {active ? (
        <div data-list-nav>
          <Link
            href={action}
            className="inline-flex h-10 items-center rounded-full px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Filter zurücksetzen
          </Link>
        </div>
      ) : null}
    </form>
  );
}

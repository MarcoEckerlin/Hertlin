import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

export type FilterSelect = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

/**
 * Such- und Filterleiste für Listen (GET-Formular, Werte stehen in der Adresse).
 * Ändert sich die Suche, beginnt die Liste wieder auf Seite 1.
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
  /** Ist irgendein Filter gesetzt? Dann gibt es „Zurücksetzen“. */
  active: boolean;
}) {
  const idPrefix = `filter-${action.replace(/[^a-z0-9]+/gi, "") || "liste"}`;
  return (
    <Form
      // Neu aufbauen, wenn sich die Filter in der Adresse ändern (z. B. nach „Zurücksetzen“)
      key={[query, ...selects.map((s) => s.value)].join("|")}
      action={action}
      className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      role="search"
    >
      <div className="min-w-0 flex-1 sm:min-w-[16rem]">
        <label htmlFor={`${idPrefix}-q`} className="sr-only">
          {searchLabel}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input
            id={`${idPrefix}-q`}
            name="q"
            type="search"
            defaultValue={query}
            placeholder={placeholder}
            maxLength={100}
            className="pl-10"
          />
        </div>
      </div>
      {selects.map((s) => (
        <div key={s.name} className="sm:w-52">
          <label htmlFor={`${idPrefix}-${s.name}`} className="sr-only">
            {s.label}
          </label>
          <Select id={`${idPrefix}-${s.name}`} name={s.name} defaultValue={s.value}>
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Button type="submit" variant="secondary" className="h-11">
          Anzeigen
        </Button>
        {active ? (
          <Link href={action} className="px-2 text-sm font-semibold text-brand-700 hover:underline">
            Zurücksetzen
          </Link>
        ) : null}
      </div>
    </Form>
  );
}

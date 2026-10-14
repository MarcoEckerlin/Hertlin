import Link from "next/link";
import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** Filter als Link-Pille (aktiv dunkel hinterlegt). */
export function FilterPill({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap ring-1 ring-inset",
        active ? "bg-ink text-white ring-ink" : "bg-white text-ink-soft ring-line-strong hover:bg-brand-50 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Suchfeld als GET-Formular; übrige Filter bleiben als versteckte Felder erhalten.
 * extra: weitere Felder im selben Formular (z. B. Auswahl des Standorts), stehen vor dem Suchfeld.
 */
export function SearchForm({
  action,
  id,
  value,
  label,
  placeholder,
  keep = {},
  extra,
}: {
  action: string;
  id: string;
  value: string;
  label: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
  extra?: ReactNode;
}) {
  return (
    <form action={action} method="get" role="search" className="flex w-full flex-wrap gap-2 sm:flex-nowrap lg:w-auto">
      {Object.entries(keep).map(([name, v]) => (v ? <input key={name} type="hidden" name={name} value={v} /> : null))}
      {extra}
      <div className="flex min-w-0 flex-1 gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Input id={id} name="q" type="search" defaultValue={value} placeholder={placeholder} className="h-9 lg:w-72" />
        <Button type="submit" variant="secondary" size="sm" className="h-9">
          <Search className="size-4" aria-hidden />
          Suchen
        </Button>
      </div>
    </form>
  );
}

export function firstParam(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

/** Plausible ID aus URL oder Query (cuid). Alles andere gilt als nicht vorhanden. */
export function cleanId(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : null;
}

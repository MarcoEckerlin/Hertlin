"use client";

import { createContext, use, useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search } from "lucide-react";
import { cn } from "@/lib/cn";

type ListContextValue = { pending: boolean; navigate: (href: string, replace: boolean) => void };

const ListContext = createContext<ListContextValue | null>(null);

/**
 * Klammer um Filter und Ergebnisliste einer Listenseite (Kunden, Anfragen, Anrufe).
 * Suche und Auswahlfelder laden die Seite ohne Neuladen; solange das dauert, wird die alte Liste blass.
 */
export function ListFilters({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = (href: string, replace: boolean) =>
    startTransition(() => {
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  return <ListContext value={{ pending, navigate }}>{children}</ListContext>;
}

/** Ergebnisbereich: blass und aria-busy, solange neue Ergebnisse laden (erst nach kurzer Verzögerung, damit nichts flackert). */
export function ListResults({ children }: { children: ReactNode }) {
  const pending = use(ListContext)?.pending ?? false;
  return (
    <div
      aria-busy={pending || undefined}
      className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-55 delay-150")}
    >
      {children}
    </div>
  );
}

/**
 * Suchfeld als GET-Formular. Mit JavaScript sucht es beim Tippen (nach einer kurzen Pause) und Auswahlfelder
 * im Formular (children, z. B. Standort) wirken sofort; ohne JavaScript schickt Enter bzw. die Lupe das Formular ab.
 * keep: übrige Filter, die als versteckte Felder erhalten bleiben. Leere Werte landen nicht in der Adresse.
 */
export function ListSearchForm({
  action,
  id,
  value,
  label,
  placeholder,
  keep = {},
  children,
  className,
}: {
  action: string;
  id: string;
  value: string;
  label: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
  children?: ReactNode;
  className?: string;
}) {
  const ctx = use(ListContext);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = ctx?.pending ?? false;

  // Zurück-Knopf o. Ä.: Suchfeld an die Adresse angleichen – aber nicht, während jemand tippt
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input && input.value !== value) input.value = value;
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const hrefOf = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    for (const [key, raw] of new FormData(form)) {
      const v = typeof raw === "string" ? raw.trim() : "";
      if (v) params.set(key, v);
    }
    const query = params.toString();
    return query ? `${action}?${query}` : action;
  };

  const apply = (replace: boolean) => {
    clearTimeout(timer.current);
    const form = formRef.current;
    if (!form || !ctx) return;
    const href = hrefOf(form);
    if (href === `${window.location.pathname}${window.location.search}`) return;
    ctx.navigate(href, replace);
  };

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      role="search"
      className={cn("flex w-full flex-wrap gap-2 sm:flex-nowrap lg:w-auto", className)}
      onSubmit={(event) => {
        if (!ctx) return;
        event.preventDefault();
        apply(false);
      }}
      onChange={(event) => {
        if (!ctx) return;
        const target = event.target as HTMLElement;
        if (target instanceof HTMLInputElement && target.type === "search") {
          // Beim Tippen erst nach einer kurzen Pause suchen; die Adresse wird ersetzt, nicht gestapelt
          clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(true), 350);
        } else {
          apply(false);
        }
      }}
    >
      {Object.entries(keep).map(([name, v]) => (v ? <input key={name} type="hidden" name={name} value={v} /> : null))}
      {children}
      <div className="relative min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          ref={inputRef}
          id={id}
          name="q"
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          maxLength={80}
          enterKeyHint="search"
          className="block h-9 w-full min-w-0 rounded-xl border border-line-strong bg-surface pr-9 pl-3.5 text-sm text-ink placeholder:text-ink-muted/80 transition-colors hover:border-brand-300 focus:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 lg:w-72"
        />
        {/* Lupe zum Absenden (ohne JavaScript und für Touch); während des Ladens ein Kreisel */}
        <button
          type="submit"
          className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-muted hover:bg-brand-50 hover:text-ink"
          aria-label="Suchen"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </form>
  );
}

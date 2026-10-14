import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Einfache Seitennavigation über den Query-Parameter "seite".
 * baseQuery: übrige Filter, die erhalten bleiben sollen.
 */
export function Pagination({
  page,
  pageCount,
  basePath,
  baseQuery = {},
}: {
  page: number;
  pageCount: number;
  basePath: string;
  baseQuery?: Record<string, string | undefined>;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(baseQuery)) if (v) q.set(k, v);
    if (p > 1) q.set("seite", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const link = "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset ring-line-strong";
  return (
    <nav aria-label="Seiten" className="mt-4 flex items-center justify-between gap-3 text-sm text-ink-muted">
      <span>
        Seite {page} von {pageCount}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={cn(link, "bg-surface text-ink hover:bg-brand-50")} href={href(page - 1)}>
            Zurück
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link className={cn(link, "bg-surface text-ink hover:bg-brand-50")} href={href(page + 1)}>
            Weiter
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

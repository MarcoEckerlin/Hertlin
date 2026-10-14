import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  meta?: ReactNode;
}) {
  // Auf Seiten der ersten Ebene („Übersicht › Tickets“) bringt der Pfad nichts und lässt die Überschrift springen
  const topLevel = breadcrumbs?.length === 2 && (breadcrumbs[0].href === "/admin" || breadcrumbs[0].href === "/");
  return (
    <div className="mb-6 sm:mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && !topLevel ? (
        <nav aria-label="Brotkrumen" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            {breadcrumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-ink-soft">{description}</p> : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActivePath, type SiteNavLink } from "@/components/site/nav-types";

/**
 * Kleiner Punkt unter dem angeklickten Menüeintrag, solange die neue Seite lädt –
 * sofortige Rückmeldung auch bei langsamer Verbindung.
 */
export function NavPendingDot({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute size-1.5 rounded-full bg-primary transition-opacity duration-150",
        pending ? "animate-pulse opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}

/** Hauptnavigation ab lg-Breite (darunter das Menü zum Aufklappen), markiert die aktuelle Seite. */
export function DesktopNav({ items }: { items: SiteNavLink[] }) {
  const pathname = usePathname();
  if (items.length === 0) return null;
  return (
    <nav aria-label="Hauptnavigation" className="hidden min-w-0 lg:block">
      <ul className="flex items-center gap-0.5 xl:gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative block rounded-full px-2.5 py-2 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors xl:px-3.5",
                  active ? "bg-brand-100 text-ink" : "text-ink-soft hover:bg-brand-50 hover:text-ink",
                )}
              >
                {item.label}
                <NavPendingDot className="bottom-0.5 left-1/2 -translate-x-1/2" />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

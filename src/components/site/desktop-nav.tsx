"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isActivePath, type SiteNavLink } from "@/components/site/nav-types";

/** Hauptnavigation ab xl-Breite (darunter reicht der Platz nicht), markiert die aktuelle Seite. */
export function DesktopNav({ items }: { items: SiteNavLink[] }) {
  const pathname = usePathname();
  if (items.length === 0) return null;
  return (
    <nav aria-label="Hauptnavigation" className="hidden xl:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors",
                  active ? "bg-brand-100 text-ink" : "text-ink-soft hover:bg-brand-50 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

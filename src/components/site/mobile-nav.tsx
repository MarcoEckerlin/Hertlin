"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { mainNav } from "@/components/site/nav";
import { buttonClasses } from "@/components/ui/button";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

const extraLinks = [{ href: "/support", label: "Support für Bestandskunden" }] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Menü schließen, sobald sich die Seite ändert
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full text-ink hover:bg-brand-50"
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open ? (
        <div
          id="mobile-nav"
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-b border-line bg-white px-4 pt-2 pb-6 shadow-lift sm:px-6"
        >
          <nav aria-label="Hauptnavigation mobil">
            <ul className="divide-y divide-line">
              {[...mainNav, ...extraLinks].map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn("block py-3.5 text-base font-semibold", active ? "text-brand-700" : "text-ink")}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href="/login" onClick={() => setOpen(false)} className={buttonClasses("secondary", "lg")}>
              Zum Kundenportal
            </Link>
            <Link href="/kontakt" onClick={() => setOpen(false)} className={buttonClasses("primary", "lg")}>
              Anfrage stellen
            </Link>
          </div>
          <a
            href={`tel:${site.phoneHref}`}
            className="mt-5 flex items-center justify-center gap-2 text-[0.9375rem] font-semibold text-ink"
          >
            <Phone className="size-4 text-brand-700" aria-hidden />
            {site.phone}
          </a>
        </div>
      ) : null}
    </div>
  );
}

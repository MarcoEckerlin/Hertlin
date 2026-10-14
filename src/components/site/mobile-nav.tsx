"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { mainNav } from "@/components/site/nav";
import { buttonClasses } from "@/components/ui/button";

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
    <div className="lg:hidden">
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
        <div id="mobile-nav" className="absolute inset-x-0 top-full border-b border-line bg-white px-4 pt-2 pb-6 shadow-lift">
          <nav aria-label="Hauptnavigation mobil">
            <ul className="divide-y divide-line">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block py-3.5 text-base font-semibold text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/support" className="block py-3.5 text-base font-semibold text-ink">
                  Support für Bestandskunden
                </Link>
              </li>
            </ul>
          </nav>
          <div className="mt-4 grid gap-2">
            <Link href="/login" className={buttonClasses("secondary", "lg")}>
              Zum Kundenportal
            </Link>
            <Link href="/kontakt" className={buttonClasses("primary", "lg")}>
              Anfrage stellen
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

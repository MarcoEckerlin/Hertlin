"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Phone, X } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/cn";
import { NavPendingDot } from "@/components/site/desktop-nav";
import { isActivePath, telHref, type SiteNavLink } from "@/components/site/nav-types";

const SUPPORT_LINK: SiteNavLink = { href: "/support", label: "Support für Bestandskunden" };

/**
 * Menü zum Aufklappen unterhalb der lg-Breite.
 * Blendet sich kurz ein, dunkelt die Seite dahinter ab und sperrt solange das Scrollen der Seite.
 * Escape, ein Klick auf die Abdunklung oder ein Seitenwechsel schließen es.
 */
export function MobileNav({ items, phone, phoneHref }: { items: SiteNavLink[]; phone: string; phoneHref: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Menü schließen, sobald sich die Seite ändert
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Escape und Klick neben das Menü schließen es; die Seite dahinter scrollt nicht mit
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }
    // Ab lg-Breite gibt es das Menü nicht – wird das Fenster breiter, schließen
    const wide = window.matchMedia("(min-width: 64rem)");
    function onWide() {
      if (wide.matches) setOpen(false);
    }
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    wide.addEventListener("change", onWide);
    return () => {
      html.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const links = items.some((i) => i.href === SUPPORT_LINK.href) ? items : [...items, SUPPORT_LINK];
  const tel = telHref(phoneHref);

  return (
    <div ref={wrapperRef} className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full text-ink transition-colors hover:bg-brand-50"
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open ? (
        <>
          {/* Abdunklung unter dem Menü – ein Klick darauf schließt es */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="absolute inset-x-0 top-full h-dvh bg-scrim transition-opacity duration-200 ease-out starting:opacity-0"
          />
          <div
            id="mobile-nav"
            className="absolute inset-x-0 top-full max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-b border-line bg-surface-raised px-4 pt-2 pb-6 shadow-lift transition-[opacity,translate] duration-200 ease-out starting:-translate-y-2 starting:opacity-0 sm:px-6"
          >
            <nav aria-label="Hauptnavigation mobil">
              <ul className="divide-y divide-line">
                {links.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "relative flex items-center py-3.5 text-base font-semibold",
                          active ? "text-brand-700" : "text-ink",
                        )}
                      >
                        {item.label}
                        <NavPendingDot className="top-1/2 right-1 -translate-y-1/2" />
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
              <Link href="/kontakt#anfrage" onClick={() => setOpen(false)} className={buttonClasses("primary", "lg")}>
                Anfrage stellen
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line pt-4">
              {phone.trim() ? (
                tel ? (
                  <a href={tel} className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
                    <Phone className="size-4 text-brand-700" aria-hidden />
                    {phone}
                  </a>
                ) : (
                  <p className="inline-flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
                    <Phone className="size-4 text-brand-700" aria-hidden />
                    {phone}
                  </p>
                )
              ) : (
                <span />
              )}
              <ThemeToggle />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

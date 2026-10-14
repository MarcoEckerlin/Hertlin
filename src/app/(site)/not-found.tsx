import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/site/sections/layout";

const QUICK_LINKS = [
  { href: "/leistungen", label: "Leistungen" },
  { href: "/privatkunden#hilfe-anfordern", label: "Hilfe für Privatkunden" },
  { href: "/support", label: "Support für Bestandskunden" },
  { href: "/login", label: "Kundenportal" },
];

/**
 * 404 innerhalb der Website (z. B. unbekannte Seite aus dem Website-Editor).
 * Kopf- und Fußzeile kommen aus dem Layout, das auch das <main> liefert.
 */
export default function SiteNotFound() {
  return (
    <section className="bg-brand-50 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-lg text-center">
        <Eyebrow className="justify-center">Fehler 404</Eyebrow>
        <h1 className="mt-4 text-3xl font-bold text-ink">Diese Seite gibt es nicht</h1>
        <p className="mt-3 text-ink-soft">
          Vielleicht hat sich ein Tippfehler in die Adresse geschlichen, oder die Seite wurde verschoben.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Zur Startseite</ButtonLink>
          <ButtonLink href="/kontakt" variant="secondary">
            Kontakt
          </ButtonLink>
        </div>
        <nav aria-label="Häufig gesucht" className="mt-10 border-t border-line-strong pt-6">
          <ul className="grid gap-x-6 gap-y-2 text-left sm:grid-cols-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-brand-700 hover:text-brand-800 hover:underline hover:underline-offset-4"
                >
                  <ArrowRight
                    className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden
                  />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}

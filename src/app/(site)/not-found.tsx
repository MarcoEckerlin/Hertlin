import { ButtonLink } from "@/components/ui/button";

/**
 * 404 innerhalb der Website (z. B. unbekannte Seite aus dem Website-Editor).
 * Kopf- und Fußzeile kommen aus dem Layout, das auch das <main> liefert.
 */
export default function SiteNotFound() {
  return (
    <section className="bg-brand-50 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-md text-center">
        <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Fehler 404</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Diese Seite gibt es nicht</h1>
        <p className="mt-3 text-ink-soft">
          Vielleicht hat sich ein Tippfehler in die Adresse geschlichen, oder die Seite wurde verschoben. Über das Menü oben finden
          Sie alle Bereiche der Website.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Zur Startseite</ButtonLink>
          <ButtonLink href="/kontakt" variant="secondary">
            Kontakt
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

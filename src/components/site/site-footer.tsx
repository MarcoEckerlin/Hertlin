import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { site } from "@/config/site";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-brand-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="space-y-4">
          <Logo subtitle="IT-Service" />
          <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
            IT-Betreuung für kleine und mittlere Unternehmen. Und Hilfe für zu Hause, wenn der Rechner nicht will.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Kontakt</h2>
          <address className="mt-3 space-y-1 text-sm text-ink-soft not-italic">
            <p>{site.legalName}</p>
            <p>{site.street}</p>
            <p>
              {site.zip} {site.city}
            </p>
            <p className="pt-2">
              <a href={`tel:${site.phoneHref}`} className="hover:text-ink">
                {site.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${site.email}`} className="hover:text-ink">
                {site.email}
              </a>
            </p>
          </address>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Erreichbarkeit</h2>
          <ul className="mt-3 space-y-1 text-sm text-ink-soft">
            {site.openingHours.map((o) => (
              <li key={o.days}>
                <span className="text-ink">{o.days}</span>
                <br />
                {o.hours}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Für Kunden</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            <li>
              <Link href="/login" className="hover:text-ink">
                Kundenportal
              </Link>
            </li>
            <li>
              <Link href="/support" className="hover:text-ink">
                Support und Fernwartung
              </Link>
            </li>
            <li>
              <Link href="/privatkunden#hilfe-anfordern" className="hover:text-ink">
                Hilfe für Privatkunden
              </Link>
            </li>
            <li>
              <Link href="/status" className="hover:text-ink">
                Status einer Anfrage
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-ink-muted sm:px-6 lg:px-8">
          <p>
            © {year} {site.legalName}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li>
              <Link href="/impressum" className="hover:text-ink">
                Impressum
              </Link>
            </li>
            <li>
              <Link href="/datenschutz" className="hover:text-ink">
                Datenschutz
              </Link>
            </li>
            <li>
              <Link href="/admin/login" className="hover:text-ink">
                Mitarbeiter-Login
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

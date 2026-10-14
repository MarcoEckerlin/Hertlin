import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { mainNav } from "@/components/site/nav";
import { site } from "@/config/site";

const customerLinks = [
  { href: "/login", label: "Kundenportal" },
  { href: "/support", label: "Support und Fernwartung" },
  { href: "/privatkunden#hilfe-anfordern", label: "Hilfe für Privatkunden" },
  { href: "/status", label: "Status-Link anfordern" },
] as const;

const linkClass = "hover:text-ink hover:underline hover:underline-offset-4";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-brand-50">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr] lg:px-8">
        <div className="space-y-4 sm:col-span-2 lg:col-span-1">
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
              <a href={`tel:${site.phoneHref}`} className={linkClass}>
                {site.phone}
              </a>
            </p>
            <p>
              <a href={`mailto:${site.email}`} className={`${linkClass} break-words`}>
                {site.email}
              </a>
            </p>
          </address>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Servicezeiten</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
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
            {customerLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Website</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {mainNav.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
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
              <Link href="/impressum" className={linkClass}>
                Impressum
              </Link>
            </li>
            <li>
              <Link href="/datenschutz" className={linkClass}>
                Datenschutz
              </Link>
            </li>
            <li>
              <Link href="/admin/login" className={linkClass}>
                Anmeldung Hertlin-Team
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

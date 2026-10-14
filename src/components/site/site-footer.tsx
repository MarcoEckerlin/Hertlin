import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { LocationPhone, type SiteLocation } from "@/components/site/locations";
import { telHref, type SiteContact, type SiteNavLink } from "@/components/site/nav-types";

const customerLinks: SiteNavLink[] = [
  { href: "/login", label: "Kundenportal" },
  { href: "/privatkunden#hilfe-anfordern", label: "Hilfe für Privatkunden" },
  { href: "/status", label: "Status-Link anfordern" },
  { href: "/support#fernwartung", label: "Fernwartung" },
];

const linkClass = "hover:text-ink hover:underline hover:underline-offset-4";

/**
 * Fußzeile: Kontakt aus den Firmendaten, Seitenlinks aus der Navigation (Hauptmenü und Footer).
 * Bei mehreren Standorten für die Website stehen deren Anschriften kompakt in einer eigenen Zeile;
 * Telefon und E-Mail aus den Firmendaten bleiben als zentrale Kontaktwege stehen.
 */
export function SiteFooter({
  main,
  footer,
  contact,
  locations = [],
}: {
  main: SiteNavLink[];
  footer: SiteNavLink[];
  contact: SiteContact;
  /** Aktive Standorte mit „Auf der Website zeigen“ (Hauptsitz zuerst) */
  locations?: SiteLocation[];
}) {
  const year = new Date().getFullYear();
  const tel = telHref(contact.phoneHref);
  const place = [contact.zip, contact.city].filter((v) => v.trim()).join(" ");
  const company = contact.legalName.trim() || contact.name;
  const multiple = locations.length > 1;

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
            <p>{company}</p>
            {!multiple && contact.street.trim() ? <p>{contact.street}</p> : null}
            {!multiple && place ? <p>{place}</p> : null}
            {contact.phone.trim() ? (
              <p className={multiple ? undefined : "pt-2"}>
                {tel ? (
                  <a href={tel} className={linkClass}>
                    {contact.phone}
                  </a>
                ) : (
                  contact.phone
                )}
              </p>
            ) : null}
            {contact.email.trim() ? (
              <p>
                <a href={`mailto:${contact.email.trim()}`} className={`${linkClass} break-words`}>
                  {contact.email}
                </a>
              </p>
            ) : null}
          </address>
        </div>
        <div>
          <h2 className="text-sm font-bold text-ink">Servicezeiten</h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-soft">
            {contact.openingHours.map((o, i) => (
              <li key={`${o.days}-${i}`}>
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
        {main.length > 0 ? (
          <div>
            <h2 className="text-sm font-bold text-ink">Website</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {main.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {multiple ? <FooterLocations locations={locations} /> : null}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-ink-muted sm:px-6 lg:px-8">
          <p>
            © {year} {company}
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {footer.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/admin/login" className={linkClass}>
                Anmeldung {contact.name}-Team
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/** Standorte kompakt: Name, Anschrift und Telefon. */
function FooterLocations({ locations }: { locations: SiteLocation[] }) {
  return (
    <section aria-labelledby="footer-standorte" className="border-t border-line">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 id="footer-standorte" className="text-sm font-bold text-ink">
          Standorte
        </h2>
        <ul className="mt-3 grid gap-x-8 gap-y-5 text-sm text-ink-soft sm:grid-cols-2 lg:grid-cols-4">
          {locations.map((l) => (
            <li key={l.id} className="min-w-0">
              <address className="space-y-0.5 not-italic">
                <p className="font-semibold break-words text-ink">
                  {l.name}
                  {l.isMain ? <span className="font-normal text-ink-muted"> · Hauptsitz</span> : null}
                </p>
                <p>{l.street}</p>
                <p>{[l.zip, l.city].filter((v) => v.trim()).join(" ")}</p>
                {l.phone?.trim() ? (
                  <p>
                    <LocationPhone phone={l.phone} className={linkClass} />
                  </p>
                ) : null}
              </address>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

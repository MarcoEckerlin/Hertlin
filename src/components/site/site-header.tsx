import Link from "next/link";
import { Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { PageTranslator } from "@/components/translate/page-translator";
import { DesktopNav } from "@/components/site/desktop-nav";
import { MobileNav } from "@/components/site/mobile-nav";
import { telHref, type SiteContact, type SiteNavLink } from "@/components/site/nav-types";

/**
 * Kopfzeile der Website. Menüeinträge kommen aus den veröffentlichten Seiten, Kontaktdaten aus den Firmendaten.
 *
 * Der Website-Übersetzer steht genau einmal im Kopf (Desktop rechts neben „Kundenportal“, mobil neben dem
 * Menü-Knopf): Er merkt sich die gewählte Sprache und beobachtet die Seite – zwei Instanzen würden sich
 * gegenseitig überschreiben. Der Kopf hat bewusst keinen backdrop-filter, sonst würde der fest positionierte
 * Hinweis „Maschinell übersetzt“ am Kopf statt am Fenster ausgerichtet.
 */
export function SiteHeader({
  nav,
  contact,
  translationEnabled,
}: {
  nav: SiteNavLink[];
  contact: SiteContact;
  translationEnabled: boolean;
}) {
  const tel = telHref(contact.phoneHref);
  const hours = contact.openingHours.map((o) => `${o.days} ${o.hours}`).join(" · ");

  return (
    <>
      {/* Servicezeile – nur Desktop, scrollt mit weg */}
      <div className="hidden border-b border-line bg-brand-50 lg:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-6 px-8 text-sm">
          {hours ? (
            <p className="hidden truncate text-ink-soft xl:block">
              <span className="font-semibold text-ink">Servicezeiten:</span> {hours}
            </p>
          ) : null}
          <ul className="ml-auto flex shrink-0 items-center gap-6">
            <li>
              <Link href="/support" className="font-semibold text-ink-soft hover:text-ink">
                Support für Bestandskunden
              </Link>
            </li>
            <li>
              <Link href="/support#fernwartung" className="font-semibold text-ink-soft hover:text-ink">
                Fernwartung
              </Link>
            </li>
            {contact.phone.trim() ? (
              <li>
                {tel ? (
                  <a href={tel} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
                    <Phone className="size-3.5 text-brand-700" aria-hidden />
                    {contact.phone}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                    <Phone className="size-3.5 text-brand-700" aria-hidden />
                    {contact.phone}
                  </span>
                )}
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line/80 bg-white">
        <div className="relative mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Kein aria-label: Der zugängliche Name soll den sichtbaren Logo-Text enthalten (Sprachsteuerung) */}
          <Link href="/" className="shrink-0">
            <Logo subtitle="IT-Service" />
            <span className="sr-only"> – zur Startseite</span>
          </Link>
          <DesktopNav items={nav} />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="hidden xl:block">
              <ButtonLink href="/login" variant="ghost">
                Kundenportal
              </ButtonLink>
            </div>
            <PageTranslator enabled={translationEnabled} compact />
            <div className="hidden md:block">
              <ButtonLink href="/kontakt">Anfrage stellen</ButtonLink>
            </div>
            <MobileNav items={nav} phone={contact.phone} phoneHref={contact.phoneHref} />
          </div>
        </div>
      </header>
    </>
  );
}

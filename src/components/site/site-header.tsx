import Link from "next/link";
import { Phone } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ButtonLink } from "@/components/ui/button";
import { DesktopNav } from "@/components/site/desktop-nav";
import { MobileNav } from "@/components/site/mobile-nav";
import { site } from "@/config/site";

export function SiteHeader() {
  return (
    <>
      {/* Servicezeile – nur Desktop, scrollt mit weg */}
      <div className="hidden border-b border-line bg-brand-50 lg:block">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-6 px-8 text-sm">
          <p className="hidden text-ink-soft xl:block">
            <span className="font-semibold text-ink">Servicezeiten:</span>{" "}
            {site.openingHours.map((o) => `${o.days} ${o.hours}`).join(" · ")}
          </p>
          <ul className="ml-auto flex items-center gap-6">
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
            <li>
              <a href={`tel:${site.phoneHref}`} className="inline-flex items-center gap-1.5 font-semibold text-ink hover:underline">
                <Phone className="size-3.5 text-brand-700" aria-hidden />
                {site.phone}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-line/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="relative mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label={`${site.name} – zur Startseite`} className="shrink-0">
            <Logo subtitle="IT-Service" />
          </Link>
          <DesktopNav />
          <div className="hidden items-center gap-2 xl:flex">
            <ButtonLink href="/login" variant="ghost">
              Kundenportal
            </ButtonLink>
            <ButtonLink href="/kontakt">Anfrage stellen</ButtonLink>
          </div>
          <div className="flex items-center gap-2 xl:hidden">
            <div className="hidden md:block">
              <ButtonLink href="/kontakt">Anfrage stellen</ButtonLink>
            </div>
            <MobileNav />
          </div>
        </div>
      </header>
    </>
  );
}

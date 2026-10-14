import type { ReactNode } from "react";
import type { Navigation } from "@/cms/store";
import { getSiteSettings, type SiteSettings } from "@/lib/settings";
import { translationEnabled } from "@/lib/translate";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import type { SiteContact } from "@/components/site/nav-types";

export function siteContact(s: SiteSettings): SiteContact {
  return {
    name: s.name,
    legalName: s.legalName,
    phone: s.phone,
    phoneHref: s.phoneHref,
    email: s.email,
    street: s.street,
    zip: s.zip,
    city: s.city,
    openingHours: s.openingHours,
  };
}

/** Rahmen der Website: Sprunglink, Kopfzeile, Inhalt und Fußzeile. Auch für die Vorschau in der Verwaltung. */
export async function SiteShell({ nav, children, banner }: { nav: Navigation; children: ReactNode; banner?: ReactNode }) {
  const settings = await getSiteSettings();
  const contact = siteContact(settings);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Zum Inhalt springen
      </a>
      {banner}
      <SiteHeader nav={nav.main} contact={contact} translationEnabled={translationEnabled()} />
      <main id="inhalt" className="flex-1">
        {children}
      </main>
      <SiteFooter main={nav.main} footer={nav.footer} contact={contact} />
    </div>
  );
}

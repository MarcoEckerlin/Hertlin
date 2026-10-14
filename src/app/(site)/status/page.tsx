import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings } from "@/lib/settings";
import { StatusLinkForm } from "@/components/forms/status-link-form";

export const metadata: Metadata = {
  title: "Status-Link erneut anfordern",
  description: "Link zu Ihrem Ticket verloren? Wir schicken ihn noch einmal an die E-Mail-Adresse aus Ihrem Formular.",
  robots: { index: false, follow: true },
};

export default async function StatusLinkPage() {
  const site = await getSiteSettings();
  return (
    <section className="bg-brand-50">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_26rem] lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Status-Link</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">Link zu Ihrem Ticket verloren?</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Nach dem Absenden des Formulars für Privatkunden haben wir Ihnen eine E-Mail mit Ihrem persönlichen Status-Link
            geschickt. Ist die E-Mail nicht mehr auffindbar, senden wir den Link gern noch einmal – an die Adresse, die Sie im
            Formular angegeben haben.
          </p>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">
            Die Ticketnummer nicht zur Hand? Rufen Sie uns an unter{" "}
            <a href={`tel:${site.phoneHref}`} className="font-semibold whitespace-nowrap text-brand-700 hover:underline">
              {site.phone}
            </a>
            , dann suchen wir Ihr Ticket heraus.
          </p>

          <div className="mt-8 rounded-2xl border border-line bg-white p-5 text-[0.9375rem] text-ink-soft">
            <p className="font-semibold text-ink">Sie sind Firmenkunde?</p>
            <p className="mt-1">
              Ihre Tickets sehen Sie im{" "}
              <Link href="/login" className="font-semibold text-brand-700 hover:underline">
                Kundenportal Ihrer Firma
              </Link>
              . Einen Status-Link brauchen Sie dort nicht.
            </p>
          </div>
        </div>

        <div className="self-start rounded-3xl border border-line bg-white p-7 shadow-lift sm:p-9">
          <h2 className="text-xl font-bold text-ink">Link erneut zusenden</h2>
          <p className="mt-1.5 text-sm text-ink-soft">Beide Angaben müssen zu Ihrem Ticket passen.</p>
          <div className="mt-6">
            <StatusLinkForm />
          </div>
        </div>
      </div>
    </section>
  );
}

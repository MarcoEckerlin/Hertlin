import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PortalFinderForm } from "@/components/auth/portal-finder-form";
import { rootDomain } from "@/lib/hosts";

export const metadata: Metadata = {
  title: "Kundenportal",
  description: "Anmeldung zum Hertlin-Kundenportal für Firmenkunden.",
};

export default async function PortalFinderPage() {
  await connection();
  return (
    <section className="bg-brand-50">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_26rem] lg:px-8 lg:py-24">
        <div className="max-w-xl">
          <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Kundenportal</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">Jede Firma hat ihre eigene Adresse.</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Firmenkunden erreichen ihr Portal unter einer eigenen Subdomain, zum Beispiel{" "}
            <span className="font-semibold text-ink">ihrefirma.{rootDomain()}</span>. Geben Sie rechts Ihr Kürzel ein, wir
            bringen Sie zur richtigen Anmeldeseite. Am besten setzen Sie sich danach ein Lesezeichen.
          </p>
          <div className="mt-8 rounded-2xl border border-line bg-white p-5 text-[0.9375rem] text-ink-soft">
            <p className="font-semibold text-ink">Sie sind Privatkunde?</p>
            <p className="mt-1">
              Für Privatkunden gibt es kein Portal-Konto. Schildern Sie Ihr Anliegen einfach über das{" "}
              <Link href="/privatkunden#hilfe-anfordern" className="font-semibold text-brand-700 hover:underline">
                Formular für Privatkunden
              </Link>
              . Den Stand sehen Sie danach über Ihren persönlichen Link aus der Bestätigungs-E-Mail.
            </p>
          </div>
        </div>
        <div className="rounded-3xl border border-line bg-white p-7 shadow-lift sm:p-9">
          <h2 className="text-xl font-bold text-ink">Zum Portal Ihrer Firma</h2>
          <p className="mt-1.5 text-sm text-ink-soft">Das Kürzel steht in Ihrer Zugangs-E-Mail.</p>
          <div className="mt-6">
            <PortalFinderForm rootDomain={rootDomain()} />
          </div>
        </div>
      </div>
    </section>
  );
}

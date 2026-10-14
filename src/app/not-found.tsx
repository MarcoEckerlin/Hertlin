import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { LogoMark } from "@/components/ui/logo";
import { buttonClasses } from "@/components/ui/button";
import { PhoneLink } from "@/components/site/sections/contact";
import { getPortalCompany } from "@/lib/auth";
import { db } from "@/lib/db";
import { mainUrl, parseHost } from "@/lib/hosts";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Seite nicht gefunden" };

/**
 * 404 für Adressen ohne passende Route (Website, Kundenportal, unbekannte Subdomain).
 * Fehlende Seiten innerhalb der Website zeigt src/app/(site)/not-found.tsx mit Kopf- und Fußzeile.
 */
export default async function NotFound() {
  const host = parseHost((await headers()).get("host"));
  // Im Portal einer bestehenden Firma führt der Knopf zurück ins Portal, sonst zur Website
  const portal = host.kind === "portal" ? await getPortalCompany(host.slug) : null;
  // Firmenkunde gibt es, er ist aber deaktiviert: nicht auf einen Tippfehler schieben, sondern sagen, was los ist
  const suspended =
    host.kind === "portal" && !portal
      ? (await db.company.count({ where: { slug: host.slug, parentId: null, active: false } })) > 0
      : false;

  if (suspended) {
    const site = await getSiteSettings();
    return (
      <main className="grid min-h-dvh place-items-center bg-brand-50 px-6">
        <div className="max-w-md text-center">
          <LogoMark className="mx-auto size-12" />
          <p className="mt-6 text-sm font-bold tracking-wider text-brand-700 uppercase">Kundenportal</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Dieser Zugang ist gesperrt</h1>
          <p className="mt-3 text-ink-soft">
            Das Kundenportal unter dieser Adresse ist derzeit nicht freigeschaltet. Wenn Sie Fragen dazu haben oder Hilfe
            brauchen, rufen Sie uns bitte an:{" "}
            <PhoneLink phone={site.phone} phoneHref={site.phoneHref} className="font-semibold whitespace-nowrap text-brand-700" />.
          </p>
          <Link href={mainUrl("/")} className={buttonClasses("primary", "md", "mt-8")}>
            Zur Startseite
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-50 px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-12" />
        <p className="mt-6 text-sm font-bold tracking-wider text-brand-700 uppercase">Fehler 404</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Diese Seite gibt es nicht</h1>
        {portal ? (
          <p className="mt-3 text-ink-soft">
            Vielleicht hat sich ein Tippfehler in die Adresse geschlichen, oder die Seite wurde verschoben. Ihre Tickets finden Sie
            in der Übersicht des Kundenportals.
          </p>
        ) : (
          <p className="mt-3 text-ink-soft">
            Vielleicht hat sich ein Tippfehler in die Adresse geschlichen, oder die Seite wurde verschoben. Bei einer
            Portal-Adresse prüfen Sie bitte das Kürzel vor dem Punkt.
          </p>
        )}
        <Link href={portal ? "/" : mainUrl("/")} className={buttonClasses("primary", "md", "mt-8")}>
          {portal ? "Zum Kundenportal" : "Zur Startseite"}
        </Link>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PlaceholderNotice } from "@/components/site/sections/legal";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Impressum",
  description: `Anbieterkennzeichnung von ${site.legalName} nach § 5 DDG.`,
};

export default function ImpressumPage() {
  return (
    <LegalPage
      eyebrow="Rechtliches"
      title="Impressum"
      notice={
        <PlaceholderNotice
          values={[site.legalName, site.owner, site.street, site.zip, site.city, site.phone, site.email, site.vatId, site.register]}
        />
      }
    >
      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        {site.legalName}
        <br />
        {site.street}
        <br />
        {site.zip} {site.city}
      </p>
      <p>Vertretungsberechtigt: {site.owner}</p>

      <h2>Kontakt</h2>
      <p>
        Telefon: <a href={`tel:${site.phoneHref}`}>{site.phone}</a>
        <br />
        E-Mail: <a href={`mailto:${site.email}`}>{site.email}</a>
      </p>

      {site.register ? (
        <>
          <h2>Registereintrag</h2>
          <p>{site.register}</p>
        </>
      ) : null}

      {site.vatId ? (
        <>
          <h2>Umsatzsteuer-Identifikationsnummer</h2>
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {site.vatId}</p>
        </>
      ) : null}

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        {site.owner}
        <br />
        {site.street}
        <br />
        {site.zip} {site.city}
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
        teilzunehmen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unsere Website enthält Links zu Websites anderer Anbieter, zum Beispiel zur Download-Seite des
        Fernwartungsprogramms. Für deren Inhalte sind ausschließlich die jeweiligen Anbieter verantwortlich. Zum Zeitpunkt
        der Verlinkung haben wir keine Rechtsverstöße erkannt. Werden uns solche bekannt, entfernen wir den Link umgehend.
      </p>

      <h2>Datenschutz</h2>
      <p>
        Wie wir mit personenbezogenen Daten umgehen, erklären wir in unserer{" "}
        <Link href="/datenschutz">Datenschutzerklärung</Link>.
      </p>
    </LegalPage>
  );
}

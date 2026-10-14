import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Building2, House, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Section, SectionHeading } from "@/components/site/sections/layout";
import { CheckList } from "@/components/site/sections/check-list";
import { CtaBand, OpeningHours } from "@/components/site/sections/contact";
import { PortalMockup } from "@/components/site/sections/portal-mockup";
import { PortalStructure } from "@/components/site/sections/portal-structure";
import { ResponseTimesNote, ResponseTimesTable } from "@/components/site/sections/response-times";
import { Steps } from "@/components/site/sections/steps";
import { services } from "@/components/site/services";
import { site } from "@/config/site";
import { portalHost } from "@/lib/hosts";

export const metadata: Metadata = {
  title: { absolute: `${site.name} – ${site.tagline}` },
  description:
    "Hertlin betreut die IT kleiner und mittlerer Unternehmen und hilft Privatkunden bei Problemen mit PC, WLAN und Drucker. Störungen melden Firmenkunden im eigenen Kundenportal.",
};

const portalFeatures = [
  {
    title: "Eine eigene Adresse für Ihre Firma",
    text: "Ihr Kundenportal erreichen Sie unter einer eigenen Subdomain. Dort melden sich nur Ihre Leute an, andere Kunden sehen davon nichts.",
  },
  {
    title: "Unterkunden – so viele Sie brauchen",
    text: "Filialen, Standorte, Abteilungen oder die Homeoffice-Gruppe legen Sie als Unterkunden an. Eine Obergrenze gibt es nicht.",
  },
  {
    title: "Jeder Mitarbeiter mit eigenem Zugang",
    text: "Kein gemeinsames Passwort für alle. Mitarbeiter sehen ihre eigenen Tickets, der Hauptansprechpartner sieht alle.",
  },
  {
    title: "Alles zu einem Problem an einem Ort",
    text: "Beschreibung, Screenshots, Rückfragen und Antworten stehen im Ticket. Niemand muss mehr alte E-Mails durchsuchen.",
  },
];

export default async function HomePage() {
  await connection();
  const exampleHost = portalHost("ihrefirma");

  return (
    <>
      {/* Einstieg */}
      <section className="bg-white px-2 pt-2 sm:px-4 sm:pt-4">
        <div className="mx-auto max-w-[90rem] overflow-hidden rounded-3xl bg-brand-100">
          <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-bold tracking-wider text-brand-800 uppercase">Für Firmen und Privatkunden</p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-ink hyphens-auto sm:text-5xl sm:hyphens-manual lg:text-[3.5rem] lg:leading-[1.08]">
                IT-Service, bei dem Sie wissen, woran Sie sind.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-ink-soft sm:text-xl sm:leading-relaxed">
                Wir betreuen die IT kleiner und mittlerer Unternehmen – vom Arbeitsplatz über das Netzwerk bis zu Microsoft 365.
                Privatkunden helfen wir, wenn zu Hause der Laptop, das WLAN oder der Drucker nicht mitspielt.
              </p>
              <p className="mt-4 text-lg leading-relaxed text-ink-soft">
                Jede Störung bekommt ein Ticket. Darin sehen Sie, wer sich darum kümmert und was gemacht wurde.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/kontakt" size="lg">
                  Anfrage stellen
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg">
                  Zum Kundenportal
                </ButtonLink>
              </div>
              <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.9375rem] text-ink-soft">
                <Phone className="size-4 text-brand-700" aria-hidden />
                <span>Bestandskunde mit Störung?</span>
                <a href={`tel:${site.phoneHref}`} className="font-semibold text-ink hover:underline hover:underline-offset-4">
                  {site.phone}
                </a>
              </p>
            </div>
            <PortalMockup host={exampleHost} className="lg:mb-6" />
          </Container>
        </div>
      </section>

      {/* Zwei Wege */}
      <Section labelledBy="wege-titel">
        <SectionHeading id="wege-titel" eyebrow="Für wen wir arbeiten" title="Zwei Arten von Kunden, zwei passende Wege.">
          <p>
            Firmen brauchen jemanden, der ihre IT kennt und dauerhaft im Blick behält. Privatleute brauchen meistens schnelle
            Hilfe bei einem konkreten Problem. Beides machen wir – aber nicht auf dieselbe Art.
          </p>
        </SectionHeading>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <article className="flex flex-col rounded-3xl bg-brand-50 p-7 sm:p-10">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-card">
              <Building2 className="size-6" aria-hidden />
            </span>
            <h3 className="mt-6 text-2xl font-bold tracking-tight text-ink">Für Unternehmen</h3>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
              Für Büros, Praxen, Kanzleien und Handwerksbetriebe ohne eigene IT-Abteilung – oder mit einer, die Verstärkung
              braucht.
            </p>
            <CheckList
              className="mt-6"
              items={[
                "Feste Ansprechpartner, die Ihre Umgebung kennen",
                <>
                  Kundenportal unter eigener Adresse, z. B. <span className="font-semibold text-ink">{exampleHost}</span>
                </>,
                "Verbindliche Reaktionszeiten mit Betreuungsvertrag",
                "Eine Dokumentation Ihrer IT, die Ihnen gehört",
              ]}
            />
            <div className="mt-auto pt-8">
              <ButtonLink href="/unternehmen" variant="dark">
                Mehr für Unternehmen
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          </article>

          <article className="flex flex-col rounded-3xl bg-brand-50 p-7 sm:p-10">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-card">
              <House className="size-6" aria-hidden />
            </span>
            <h3 className="mt-6 text-2xl font-bold tracking-tight text-ink">Für Privatkunden</h3>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
              Wenn zu Hause etwas nicht funktioniert und im Bekanntenkreis niemand weiterweiß – oder Sie nicht schon wieder
              fragen möchten.
            </p>
            <CheckList
              className="mt-6"
              items={[
                "Neuen PC oder Laptop einrichten, Daten vom alten Gerät übernehmen",
                "WLAN, Drucker und E-Mail-Programm wieder zum Laufen bringen",
                "Hilfe per Fernwartung oder als Termin bei Ihnen zu Hause",
                "Kein Konto nötig: Den Stand sehen Sie über einen persönlichen Link",
              ]}
            />
            <div className="mt-auto pt-8">
              <ButtonLink href="/privatkunden" variant="dark">
                Mehr für Privatkunden
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          </article>
        </div>
      </Section>

      {/* Leistungen */}
      <Section tone="brand" labelledBy="leistungen-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="leistungen-titel" eyebrow="Leistungen" title="Was wir übernehmen">
              <p>
                Von der Einrichtung eines einzelnen Notebooks bis zur Betreuung mehrerer Standorte. Liegt etwas außerhalb
                dessen, was wir gut können, sagen wir Ihnen das offen.
              </p>
            </SectionHeading>
            <ButtonLink href="/leistungen" variant="secondary" className="mt-8">
              Alle Leistungen im Detail
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>

          <ul className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line shadow-card sm:grid-cols-2">
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.id} className="bg-white p-6 sm:p-7">
                  <Icon className="size-6 text-brand-700" aria-hidden />
                  <h3 className="mt-4 text-lg font-bold text-ink">
                    <Link href={`/leistungen#${s.id}`} className="hover:underline hover:underline-offset-4">
                      {s.title}
                    </Link>
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{s.short}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* Ablauf einer Störung */}
      <Section labelledBy="ablauf-titel">
        <SectionHeading id="ablauf-titel" eyebrow="Ablauf" title="So läuft eine Störungsmeldung ab">
          <p>
            Ob der Drucker streikt oder der Server nicht mehr erreichbar ist: Der Ablauf ist immer derselbe. So weiß jeder, was
            als Nächstes passiert.
          </p>
        </SectionHeading>
        <Steps
          className="mt-12"
          tone="brand"
          steps={[
            {
              title: "Sie melden die Störung",
              text: "Im Kundenportal mit kurzer Beschreibung und gern einem Foto der Fehlermeldung. Oder Sie rufen an, dann legen wir das Ticket für Sie an.",
            },
            {
              title: "Wir melden uns",
              text: "Innerhalb der vereinbarten Reaktionszeit ruft ein Techniker zurück oder schreibt ins Ticket – oft mit ein, zwei Rückfragen.",
            },
            {
              title: "Fernwartung oder Termin vor Ort",
              text: "Vieles lässt sich per Fernwartung beheben, während Sie zusehen. Muss ein Gerät getauscht oder ein Kabel geprüft werden, kommen wir vorbei.",
            },
            {
              title: "Abschluss im Ticket",
              text: "Im Ticket steht, was die Ursache war und was wir geändert haben. Auch Monate später lässt sich das noch nachlesen.",
            },
          ]}
        />
      </Section>

      {/* Kundenportal */}
      <Section tone="brand" labelledBy="portal-titel">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading id="portal-titel" eyebrow="Kundenportal" title={"Ein Portal für Ihre Firma\u00a0– mit allen Standorten"}>
              <p>
                Firmenkunden bekommen ein eigenes Kundenportal. Darin melden Ihre Mitarbeiter Störungen, stellen Anfragen und
                sehen, wie weit wir sind.
              </p>
            </SectionHeading>
            <dl className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {portalFeatures.map((f) => (
                <div key={f.title}>
                  <dt className="font-bold text-ink">{f.title}</dt>
                  <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{f.text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/unternehmen#kundenportal" variant="secondary">
                Mehr zum Kundenportal
              </ButtonLink>
              <ButtonLink href="/login" variant="ghost">
                Zur Anmeldung
                <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
            </div>
          </div>
          <PortalStructure host={exampleHost} />
        </div>
      </Section>

      {/* Reaktionszeiten */}
      <Section labelledBy="reaktionszeiten-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <SectionHeading id="reaktionszeiten-titel" eyebrow="Reaktionszeiten" title="Wie schnell wir uns melden">
              <p>Je dringender das Problem, desto schneller sind wir dran. Die Dringlichkeit legen Sie beim Melden fest.</p>
            </SectionHeading>
            <ResponseTimesNote className="mt-6 max-w-xl" />
            <div className="mt-8 max-w-sm rounded-2xl bg-brand-50 p-5">
              <p className="text-sm font-semibold text-ink">Servicezeiten</p>
              <OpeningHours className="mt-2" />
            </div>
          </div>
          <ResponseTimesTable className="lg:self-start" />
        </div>
      </Section>

      <CtaBand tone="brand" />
    </>
  );
}

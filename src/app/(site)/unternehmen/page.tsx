import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ButtonLink } from "@/components/ui/button";
import { PageHero, Section, SectionHeading } from "@/components/site/sections/layout";
import { CheckList } from "@/components/site/sections/check-list";
import { CtaBand, OpeningHours } from "@/components/site/sections/contact";
import { Faq, type FaqItem } from "@/components/site/sections/faq";
import { PortalStructure } from "@/components/site/sections/portal-structure";
import { ResponseTimesNote, ResponseTimesTable } from "@/components/site/sections/response-times";
import { Steps } from "@/components/site/sections/steps";
import { site } from "@/config/site";
import { portalHost } from "@/lib/hosts";

export const metadata: Metadata = {
  title: "IT-Betreuung für Unternehmen",
  description:
    "Laufende IT-Betreuung für kleine und mittlere Unternehmen: feste Ansprechpartner, Kundenportal mit eigener Subdomain, Unterkunden für Filialen und Standorte, verbindliche Reaktionszeiten.",
};

const careItems = [
  {
    title: "Überwachung",
    text: "Wir behalten Datensicherung, Virenschutz und Speicherplatz im Blick und reagieren, wenn etwas nicht stimmt – oft, bevor Sie es bemerken.",
  },
  {
    title: "Updates",
    text: "Updates für Windows, Server und Programme spielen wir geplant ein. Muss neu gestartet werden, dann außerhalb Ihrer Kernarbeitszeit.",
  },
  {
    title: "Kommen und Gehen",
    text: "Neue Mitarbeiter bekommen pünktlich ihren Arbeitsplatz und ihre Zugänge. Wer das Unternehmen verlässt, wird am letzten Tag überall gesperrt.",
  },
  {
    title: "Ein Ansprechpartner für alles",
    text: "Wir sprechen für Sie mit dem Internetanbieter, dem Kopierer-Service oder dem Hersteller Ihrer Branchensoftware.",
  },
  {
    title: "Vorausplanen",
    text: "Garantien, Lizenzen und das Alter Ihrer Geräte haben wir im Blick und sagen rechtzeitig, was bald ersetzt werden sollte.",
  },
  {
    title: "Dokumentation",
    text: "Geräte, Netzwerk, Zugänge und Sicherungen sind dokumentiert. Die Dokumentation gehört Ihnen.",
  },
];

const roles = [
  {
    title: "Hauptansprechpartner der Firma",
    text: "Meist die Geschäftsführung oder Büroleitung.",
    can: [
      "Sieht alle Tickets der Firma und aller Unterkunden",
      "Lädt Mitarbeiter ein und sperrt Zugänge",
      "Legt Unterkunden an, z. B. eine neue Filiale",
    ],
  },
  {
    title: "Hauptansprechpartner einer Unterkunde",
    text: "Zum Beispiel die Leitung einer Filiale. Sieht nur den eigenen Standort.",
    can: [
      "Sieht alle Tickets dieser Unterkunde",
      "Lädt Mitarbeiter des Standorts ein und sperrt Zugänge",
      "Meldet Störungen und stellt Anfragen für den Standort",
    ],
  },
  {
    title: "Mitarbeiter",
    text: "Alle, die Probleme melden sollen.",
    can: [
      "Meldet Störungen und stellt Anfragen",
      "Sieht nur die eigenen Tickets",
      "Bekommt Antworten per E-Mail und im Portal",
    ],
  },
];

export default async function UnternehmenPage() {
  await connection();
  const exampleHost = portalHost("ihrefirma");
  const critical = site.responseTimes.find((r) => r.priority === "CRITICAL");

  const faq: FaqItem[] = [
    {
      question: "Was passiert, wenn unser bisheriger Dienstleister nicht mehr verfügbar ist?",
      answer: (
        <>
          <p>
            Dann starten wir mit einer Bestandsaufnahme und klären zuerst, ob alle wichtigen Zugänge vorhanden sind: Router und
            Firewall, Server, Microsoft 365, Domain und Datensicherung. Fehlt etwas, stellen wir den Zugriff gemeinsam mit den
            Herstellern und Anbietern wieder her.
          </p>
          <p>Ist gerade etwas ausgefallen, kümmern wir uns zuerst darum und machen die Bestandsaufnahme danach.</p>
        </>
      ),
    },
    {
      question: "Können Filialen getrennt Tickets stellen?",
      answer: (
        <p>
          Ja. Jede Filiale wird als Unterkunde angelegt und bekommt eigene Benutzer. Die Tickets sind dann der Filiale
          zugeordnet. Der Hauptansprechpartner der Firma sieht trotzdem alle. Soll eine Filialleitung nur die Tickets ihres
          Standorts sehen, wird sie Hauptansprechpartnerin dieser Unterkunde.
        </p>
      ),
    },
    {
      question: "Wer sieht unsere Tickets?",
      answer: (
        <p>
          Mitarbeiter sehen ihre eigenen Tickets, Hauptansprechpartner alle Tickets ihrer Firma bzw. ihrer Unterkunde. Bei
          Hertlin sehen unsere Techniker Ihre Tickets, denn sie bearbeiten sie. Andere Kunden haben keinen Zugriff: Jedes Kundenportal ist von den
          anderen getrennt, die Anmeldung funktioniert nur unter Ihrer eigenen Adresse.
        </p>
      ),
    },
    {
      question: "Brauchen wir einen Betreuungsvertrag?",
      answer: (
        <p>
          Nicht zwingend. Sie können uns auch nur bei Bedarf beauftragen und nach Aufwand bezahlen. Die{" "}
          <a href="#reaktionszeiten">Reaktionszeiten</a> gelten allerdings nur mit Vertrag. Ohne Vertrag bearbeiten wir Ihre
          Meldung so schnell, wie es die übrigen Termine zulassen.
        </p>
      ),
    },
    {
      question: "Wie rechnen Sie ab?",
      answer: (
        <p>
          Arbeitszeit nach Aufwand im 15-Minuten-Takt, Anfahrt pauschal, Material nach Absprache. Was ein Betreuungsvertrag
          umfasst, steht im Angebot. Mehr dazu unter{" "}
          <Link href="/leistungen#abrechnung">Wie wir abrechnen</Link>.
        </p>
      ),
    },
    {
      question: "Können wir neue Mitarbeiter selbst ins Portal einladen?",
      answer: (
        <p>
          Ja. Hauptansprechpartner laden neue Benutzer im Portal per E-Mail ein und sperren Zugänge von Mitarbeitern, die das
          Unternehmen verlassen. Das Benutzerkonto in Microsoft 365 oder auf dem Server richten wir für Sie ein – am
          einfachsten über ein Ticket vom Typ „Anfrage“.
        </p>
      ),
    },
    {
      question: "Was passiert, wenn wir die Zusammenarbeit beenden?",
      answer: (
        <p>
          Sie bekommen die Dokumentation Ihrer IT und alle Zugangsdaten. Wenn Sie zu einem anderen Dienstleister wechseln,
          übergeben wir geordnet und beantworten dessen Fragen.
        </p>
      ),
    },
  ];

  return (
    <>
      <PageHero
        eyebrow="Für Unternehmen"
        title="IT-Betreuung für Firmen ohne eigene IT-Abteilung"
        actions={
          <>
            <ButtonLink href="/kontakt" size="lg">
              Erstgespräch anfragen
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Zum Kundenportal
            </ButtonLink>
          </>
        }
        aside={
          <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
            <p className="text-sm font-bold text-ink">Kurz zusammengefasst</p>
            <CheckList
              className="mt-4"
              items={[
                "Feste Ansprechpartner, die Ihre Umgebung kennen",
                <>
                  Eigenes Kundenportal, z. B. <span className="font-semibold text-ink">{exampleHost}</span>
                </>,
                "Unterkunden für Filialen, Standorte und Homeoffice",
                critical
                  ? `Wenn der Betrieb steht: Rückmeldung ${critical.time} (mit Betreuungsvertrag)`
                  : "Verbindliche Reaktionszeiten mit Betreuungsvertrag",
                "Dokumentation, die Ihnen gehört",
              ]}
            />
          </div>
        }
      >
        <p>
          Ob fünf Arbeitsplätze oder fünfzig, ein Standort oder mehrere: Wir kümmern uns laufend um Ihre IT, kennen Ihre
          Umgebung und sind erreichbar, wenn etwas nicht funktioniert.
        </p>
      </PageHero>

      <Section labelledBy="betreuung-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <SectionHeading id="betreuung-titel" eyebrow="Laufende Betreuung" title="Was Betreuung bei uns bedeutet">
            <p>
              Betreuung heißt nicht nur, dass wir kommen, wenn etwas kaputt ist. Ein großer Teil der Arbeit passiert vorher,
              damit es gar nicht erst so weit kommt.
            </p>
          </SectionHeading>
          <ul className="grid gap-4 sm:grid-cols-2">
            {careItems.map((item) => (
              <li key={item.title} className="rounded-2xl bg-brand-50 p-5 sm:p-6">
                <h3 className="font-bold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">{item.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section id="kundenportal" tone="brand" labelledBy="portal-titel">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading id="portal-titel" eyebrow="Kundenportal" title="Ihr eigenes Portal unter eigener Adresse">
              <p>
                Jeder Firmenkunde bekommt ein Kundenportal mit eigener Subdomain, zum Beispiel{" "}
                <span className="font-semibold text-ink">{exampleHost}</span>. Dort melden Ihre Mitarbeiter Störungen,
                stellen Anfragen, laden Screenshots hoch und lesen unsere Antworten.
              </p>
              <p>
                Für Filialen, Standorte, Abteilungen oder eine Homeoffice-Gruppe legen Sie Unterkunden an – so viele, wie Sie
                brauchen. Jede Unterkunde hat eigene Benutzer und eigene Tickets, gemeldet wird über dieselbe Adresse.
              </p>
            </SectionHeading>
          </div>
          <PortalStructure host={exampleHost} />
        </div>

        <div className="mt-16">
          <h3 className="text-2xl font-bold tracking-tight text-ink">Wer im Portal was sieht</h3>
          <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
            Jeder bekommt einen eigenen Zugang. Was jemand sehen und tun darf, hängt von seiner Rolle ab.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {roles.map((r) => (
              <div key={r.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
                <h4 className="text-lg font-bold text-ink">{r.title}</h4>
                <p className="mt-1 text-sm text-ink-muted">{r.text}</p>
                <CheckList className="mt-5" items={r.can} />
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section labelledBy="zusammenarbeit-titel">
        <SectionHeading id="zusammenarbeit-titel" eyebrow="Zusammenarbeit" title="Wie wir anfangen">
          <p>
            Bevor wir Verantwortung für Ihre IT übernehmen, müssen wir sie kennen. Deshalb beginnt jede Zusammenarbeit mit
            denselben vier Schritten.
          </p>
        </SectionHeading>
        <Steps
          className="mt-12"
          tone="brand"
          steps={[
            {
              title: "Kennenlernen",
              text: "Sie erzählen uns, wie Ihre Firma arbeitet und wo es hakt. Wir fragen nach Arbeitsplätzen, Standorten, Programmen und bisheriger Betreuung.",
            },
            {
              title: "Bestandsaufnahme vor Ort",
              text: "Wir sehen uns Server, Netzwerk, Arbeitsplätze, Datensicherung und Zugänge an. Was dringend ist, sagen wir Ihnen sofort – nicht erst im Bericht.",
            },
            {
              title: "Dokumentation und Angebot",
              text: "Sie bekommen eine Dokumentation Ihrer IT und ein Angebot für die Betreuung mit Reaktionszeiten. Die Dokumentation gehört Ihnen, egal wie Sie sich entscheiden.",
            },
            {
              title: "Laufende Betreuung",
              text: "Wir richten Ihr Kundenportal ein, laden Ihre Mitarbeiter ein und übernehmen Überwachung, Updates und Störungen.",
            },
          ]}
        />
      </Section>

      <Section id="reaktionszeiten" tone="brand" labelledBy="reaktionszeiten-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <SectionHeading id="reaktionszeiten-titel" eyebrow="Reaktionszeiten" title="Verbindlich, je nach Dringlichkeit">
              <p>Beim Melden wählen Sie, wie dringend es ist. Danach richtet sich, wie schnell wir uns melden.</p>
            </SectionHeading>
            <ResponseTimesNote className="mt-6 max-w-xl" />
            <div className="mt-8 max-w-sm rounded-2xl bg-white p-5 shadow-card">
              <p className="text-sm font-semibold text-ink">Servicezeiten</p>
              <OpeningHours className="mt-2" />
            </div>
          </div>
          <ResponseTimesTable className="lg:self-start" />
        </div>
      </Section>

      <Section labelledBy="faq-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <SectionHeading id="faq-titel" eyebrow="Häufige Fragen" title="Was Firmen uns oft fragen">
            <p>
              Ihre Frage ist nicht dabei? Rufen Sie an unter{" "}
              <a href={`tel:${site.phoneHref}`} className="font-semibold text-ink hover:underline hover:underline-offset-4">
                {site.phone}
              </a>{" "}
              oder schreiben Sie uns über das <Link href="/kontakt" className="font-semibold text-brand-700 hover:underline">Kontaktformular</Link>.
            </p>
          </SectionHeading>
          <Faq items={faq} className="[&_a]:font-semibold [&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2" />
        </div>
      </Section>

      <CtaBand
        tone="brand"
        title="Erzählen Sie uns von Ihrer Firma."
        text="Schreiben Sie uns kurz, wie viele Arbeitsplätze Sie haben und was Sie gerade beschäftigt. Wir melden uns und vereinbaren ein erstes Gespräch – am Telefon oder bei Ihnen vor Ort."
      />
    </>
  );
}

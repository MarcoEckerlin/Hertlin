import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageHero, Section, SectionHeading } from "@/components/site/sections/layout";
import { ContactBox } from "@/components/site/sections/contact";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Über uns",
  description:
    "Wer Hertlin ist und wie wir arbeiten: verständliche Erklärungen, saubere Dokumentation, feste Ansprechpartner und ehrliche Empfehlungen.",
};

const principles = [
  {
    title: "Wir erklären, was wir tun.",
    text: [
      "Sie müssen kein Technikexperte werden. Aber Sie sollen verstehen, warum ein Gerät ersetzt werden muss oder was eine Änderung bringt, bevor wir loslegen.",
      "Im Ticket steht hinterher in normalen Worten, was die Ursache war und was wir geändert haben.",
    ],
  },
  {
    title: "Wir dokumentieren Ihre IT so, dass auch ein anderer Dienstleister damit arbeiten könnte.",
    text: [
      "Geräteliste, Netzwerkplan, Zugänge und Sicherungskonzept liegen geordnet vor und gehören Ihnen.",
      "Das macht Sie unabhängig von uns. Wir finden: Kunden sollen bleiben, weil sie zufrieden sind, nicht weil nur wir wissen, wie alles zusammenhängt.",
    ],
  },
  {
    title: "Sie haben feste Ansprechpartner.",
    text: [
      "Jeder Firmenkunde hat bei uns feste Techniker, die seine Umgebung und seine Mitarbeiter kennen. Sie müssen nicht bei jedem Anruf neu erklären, wie Ihr Netzwerk aufgebaut ist oder welches Programm in der Buchhaltung läuft.",
    ],
  },
  {
    title: "Wir sagen auch, wenn sich etwas nicht lohnt.",
    text: [
      "Manchmal ist ein neues Gerät günstiger als die Reparatur. Manchmal ist es umgekehrt, und das fünf Jahre alte Notebook läuft mit einer neuen SSD noch ein paar Jahre gut.",
      "Wir empfehlen, was für Sie sinnvoll ist – auch wenn es der kleinere Auftrag ist.",
    ],
  },
];

export default function UeberUnsPage() {
  return (
    <>
      <PageHero
        eyebrow="Über uns"
        title="IT für Leute, die eigentlich etwas anderes zu tun haben"
        actions={
          <>
            <ButtonLink href="/kontakt" size="lg">
              Anfrage stellen
            </ButtonLink>
            <ButtonLink href="/leistungen" variant="secondary" size="lg">
              Unsere Leistungen
            </ButtonLink>
          </>
        }
      >
        <p>
          {site.name} ist ein IT-Dienstleister für kleine und mittlere Unternehmen und für Privatkunden. Wir arbeiten für
          Firmen ohne eigene IT-Abteilung – etwa Büros, Praxen, Kanzleien und Handwerksbetriebe – und für Menschen, die zu
          Hause einfach wollen, dass der Computer funktioniert.
        </p>
      </PageHero>

      <Section labelledBy="arbeitsweise-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading id="arbeitsweise-titel" eyebrow="Arbeitsweise" title="Wie wir arbeiten">
              <p>
                Gute IT-Betreuung fällt vor allem dann auf, wenn sie fehlt. Diese vier Grundsätze bestimmen, wie wir mit Ihrer
                IT und mit Ihnen umgehen.
              </p>
            </SectionHeading>
          </div>
          <ol className="space-y-5">
            {principles.map((p, i) => (
              <li key={p.title} className="rounded-3xl bg-brand-50 p-6 sm:p-8">
                <p aria-hidden="true" className="text-sm font-bold text-brand-700">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">{p.title}</h3>
                <div className="mt-3 max-w-prose space-y-3 text-[0.9375rem] leading-relaxed text-ink-soft sm:text-base">
                  {p.text.map((t) => (
                    <p key={t}>{t}</p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section tone="brand" labelledBy="region-titel">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div>
            <SectionHeading id="region-titel" eyebrow="Einsatzgebiet" title="Wo wir unterwegs sind">
              <p>
                Für Termine vor Ort fahren wir zu Firmen und Privatkunden in unserer Region. Fernwartung funktioniert dagegen
                unabhängig vom Ort – vorausgesetzt, das Gerät hat eine Internetverbindung.
              </p>
            </SectionHeading>
            <div className="mt-8 flex items-start gap-4 rounded-2xl bg-white p-5 shadow-card sm:p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <MapPin className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm text-ink-muted">Unser Einsatzgebiet</p>
                <p className="mt-0.5 text-lg font-bold text-ink">{site.region}</p>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
                  Sie sind unsicher, ob Ihr Ort dazugehört? Fragen Sie kurz nach, bevor Sie eine Anfrage schreiben.
                </p>
              </div>
            </div>
          </div>
          <ContactBox />
        </div>
      </Section>
    </>
  );
}

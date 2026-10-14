import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHero, Section, SectionHeading } from "@/components/site/sections/layout";
import { CheckList } from "@/components/site/sections/check-list";
import { CtaBand } from "@/components/site/sections/contact";
import { services } from "@/components/site/services";

export const metadata: Metadata = {
  title: "Leistungen",
  description:
    "Arbeitsplätze, Netzwerk und WLAN, Microsoft 365, Server und Datensicherung, IT-Sicherheit und Telefonie: was Hertlin für Firmen und Privatkunden übernimmt und wie abgerechnet wird.",
};

const billing = [
  {
    title: "Arbeitszeit",
    text: "Nach tatsächlichem Aufwand, abgerechnet im 15-Minuten-Takt. Eine kurze Fernwartung kostet also nicht gleich eine volle Stunde.",
  },
  {
    title: "Anfahrt",
    text: "Für Termine vor Ort berechnen wir eine Anfahrtspauschale. Die Höhe nennen wir Ihnen vorher.",
  },
  {
    title: "Material und Hardware",
    text: "Nach Absprache. Bei größeren Anschaffungen bekommen Sie vorher ein Angebot und entscheiden selbst.",
  },
  {
    title: "Betreuungsvertrag",
    text: "Firmenkunden können einen Vertrag mit festen Reaktionszeiten abschließen. Was er umfasst, steht schwarz auf weiß im Angebot.",
  },
];

export default function LeistungenPage() {
  return (
    <>
      <PageHero
        eyebrow="Leistungen"
        title="Was wir für Sie übernehmen"
        actions={
          <>
            <ButtonLink href="/kontakt" size="lg">
              Anfrage stellen
            </ButtonLink>
            <ButtonLink href="#abrechnung" variant="secondary" size="lg">
              Wie wir abrechnen
            </ButtonLink>
          </>
        }
        aside={
          <nav aria-label="Leistungsbereiche" className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7">
            <p className="text-sm font-bold text-ink">Auf dieser Seite</p>
            <ul className="mt-3 divide-y divide-line">
              {services.map((s) => {
                const Icon = s.icon;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex items-center gap-3 py-2.5 text-[0.9375rem] font-semibold text-ink-soft hover:text-ink"
                    >
                      <Icon className="size-4 shrink-0 text-brand-700" aria-hidden />
                      {s.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        }
      >
        <p>
          Wir kümmern uns um alles, was in einem Büro oder zu Hause mit Computern, Netzwerk und Telefon zu tun hat. Manche
          Kunden rufen uns nur, wenn etwas kaputt ist. Andere geben uns die komplette Betreuung ihrer IT.
        </p>
        <p>Hier steht, was wir in den einzelnen Bereichen konkret tun.</p>
      </PageHero>

      <Section labelledBy="bereiche-titel">
        <h2 id="bereiche-titel" className="sr-only">
          Leistungsbereiche
        </h2>
        <div className="divide-y divide-line">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <article
                key={s.id}
                id={s.id}
                aria-labelledby={`${s.id}-titel`}
                className="grid scroll-mt-24 gap-6 py-12 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16"
              >
                <div>
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <h3 id={`${s.id}-titel`} className="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    {s.title}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {s.audience.map((a) => (
                      <Badge key={a} tone="blue">
                        Für {a}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="max-w-2xl">
                  <div className="space-y-4 text-[1.0625rem] leading-relaxed text-ink-soft">
                    {s.text.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                  </div>
                  <div className="mt-6 rounded-2xl bg-brand-50 p-5 sm:p-6">
                    <h4 className="text-sm font-bold text-ink">Typische Aufgaben</h4>
                    <CheckList className="mt-3" items={s.tasks} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section id="abrechnung" tone="brand" labelledBy="abrechnung-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <SectionHeading id="abrechnung-titel" eyebrow="Kosten" title="Wie wir abrechnen">
            <p>
              Sie sollen vorher wissen, worauf Sie sich einlassen. Deshalb rechnen wir nachvollziehbar ab und sprechen größere
              Arbeiten vorher mit Ihnen ab.
            </p>
            <p>
              Auf der Rechnung steht, wann wir was gemacht haben – mit Verweis auf das passende Ticket. Unsere aktuellen Preise
              nennen wir Ihnen gern am Telefon oder im Angebot.
            </p>
          </SectionHeading>
          <dl className="grid gap-4 sm:grid-cols-2">
            {billing.map((b) => (
              <div key={b.title} className="rounded-2xl border border-line bg-white p-6 shadow-card">
                <dt className="text-lg font-bold text-ink">{b.title}</dt>
                <dd className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{b.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <CtaBand
        title="Nicht sicher, ob wir das machen?"
        text="Fragen Sie einfach. Beschreiben Sie kurz, worum es geht, und wir sagen Ihnen ehrlich, ob wir helfen können und was ungefähr auf Sie zukommt."
      />
    </>
  );
}

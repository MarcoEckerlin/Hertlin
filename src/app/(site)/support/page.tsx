import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Building2, ExternalLink, House, Mail, Phone, TriangleAlert } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { PageHero, Section, SectionHeading } from "@/components/site/sections/layout";
import { OpeningHours, PhoneLink } from "@/components/site/sections/contact";
import { Steps } from "@/components/site/sections/steps";
import { site } from "@/config/site";
import { portalHost } from "@/lib/hosts";

export const metadata: Metadata = {
  title: "Support für Bestandskunden",
  description:
    "Störung melden, Status einer Anfrage abrufen, Fernwartung starten: der schnellste Weg zu Hertlin für Firmen- und Privatkunden.",
};

export default async function SupportPage() {
  await connection();
  const exampleHost = portalHost("ihrefirma");

  return (
    <>
      <PageHero eyebrow="Support" title="Hilfe für Bestandskunden">
        <p>
          Hier finden Sie den schnellsten Weg zu uns – je nachdem, ob Sie als Firma unser Kundenportal nutzen oder als
          Privatkunde eine Anfrage gestellt haben.
        </p>
        <p>
          Noch kein Kunde? Dann schreiben Sie uns über das{" "}
          <Link href="/kontakt" className="font-semibold text-brand-700 hover:underline">
            Kontaktformular
          </Link>
          .
        </p>
      </PageHero>

      <Section labelledBy="wege-titel">
        <h2 id="wege-titel" className="sr-only">
          Wege zum Support
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <article aria-labelledby="firmen-titel" className="flex flex-col rounded-3xl bg-brand-50 p-7 sm:p-10">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-card">
              <Building2 className="size-6" aria-hidden />
            </span>
            <h3 id="firmen-titel" className="mt-6 text-2xl font-bold tracking-tight text-ink">
              Firmenkunden
            </h3>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
              Melden Sie Störungen und Anfragen im Kundenportal Ihrer Firma. Dort sehen Sie auch, wie weit wir mit Ihren
              Tickets sind, und können Screenshots oder Dokumente anhängen.
            </p>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
              Ihre Portal-Adresse steht in Ihrer Einladungs-E-Mail, zum Beispiel{" "}
              <span className="font-semibold text-ink">{exampleHost}</span>. Kennen Sie nur das Kürzel Ihrer Firma, hilft
              Ihnen die Anmeldeseite weiter.
            </p>
            <div className="mt-auto flex flex-wrap gap-3 pt-8">
              <ButtonLink href="/login">Zum Kundenportal</ButtonLink>
            </div>
          </article>

          <article aria-labelledby="privat-titel" className="flex flex-col rounded-3xl bg-brand-50 p-7 sm:p-10">
            <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-card">
              <House className="size-6" aria-hidden />
            </span>
            <h3 id="privat-titel" className="mt-6 text-2xl font-bold tracking-tight text-ink">
              Privatkunden
            </h3>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
              Neues Problem? Schildern Sie es im Formular für Privatkunden, ein Konto brauchen Sie dafür nicht.
            </p>
            <p className="mt-3 max-w-prose text-[0.9375rem] leading-relaxed text-ink-soft">
              Sie haben schon eine Anfrage gestellt? Den Stand sehen Sie über den persönlichen Link aus unserer
              Bestätigungs-E-Mail. Wenn Sie die E-Mail nicht mehr finden, schicken wir Ihnen den Link erneut zu.
            </p>
            <div className="mt-auto flex flex-wrap gap-3 pt-8">
              <ButtonLink href="/privatkunden#hilfe-anfordern">Problem schildern</ButtonLink>
              <ButtonLink href="/status" variant="secondary">
                Status-Link anfordern
              </ButtonLink>
            </div>
          </article>
        </div>
      </Section>

      <Section id="fernwartung" tone="brand" labelledBy="fernwartung-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <SectionHeading id="fernwartung-titel" eyebrow="Fernwartung" title="So funktioniert die Fernwartung">
              <p>
                Bei einer Fernwartung sehen wir Ihren Bildschirm und können Maus und Tastatur bedienen. So lassen sich viele
                Probleme lösen, ohne dass jemand vorbeikommen muss.
              </p>
            </SectionHeading>
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:p-6">
              <p className="flex items-center gap-2 font-bold">
                <TriangleAlert className="size-5 shrink-0" aria-hidden />
                Nur nach Absprache am Telefon
              </p>
              <p className="mt-2 text-[0.9375rem] leading-relaxed">
                Starten Sie eine Fernwartung nur, wenn Sie gerade mit uns telefonieren oder einen Termin vereinbart haben. Wir
                fordern Sie nie unangekündigt dazu auf. Ruft jemand unaufgefordert an, gibt sich als Hertlin, Microsoft oder Ihre Bank aus und
                will auf Ihren Rechner: auflegen und uns Bescheid geben.
              </p>
            </div>
          </div>
          <div>
            <Steps
              columns={2}
              steps={[
                {
                  title: "Anrufen",
                  text: "Rufen Sie uns an, oder wir rufen Sie zum vereinbarten Termin an.",
                },
                {
                  title: "Programm starten",
                  text: "Laden Sie über den Button unten das Fernwartungsprogramm herunter und öffnen Sie es. Installieren müssen Sie in der Regel nichts.",
                },
                {
                  title: "ID durchgeben",
                  text: "Das Programm zeigt eine ID und ein Kennwort. Lesen Sie uns beides am Telefon vor.",
                },
                {
                  title: "Zusehen",
                  text: "Sie sehen alles, was wir tun, und können die Verbindung jederzeit beenden. Schließen Sie danach das Programm – ohne es kommen wir nicht auf Ihren Rechner.",
                },
              ]}
            />
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a
                href={site.remoteSupportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("primary", "lg")}
              >
                Fernwartung herunterladen
                <ExternalLink className="size-4" aria-hidden />
                <span className="sr-only">(öffnet in neuem Fenster)</span>
              </a>
            </div>
          </div>
        </div>
      </Section>

      <Section labelledBy="erreichbarkeit-titel">
        <SectionHeading id="erreichbarkeit-titel" eyebrow="Erreichbarkeit" title="Telefon und Servicezeiten" />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl bg-brand-400 p-7">
            <Phone className="size-6 text-ink" aria-hidden />
            <h3 className="mt-4 text-lg font-bold text-ink">Wenn nichts mehr geht</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink">
              Steht der Betrieb still, rufen Sie bitte an, statt nur ein Ticket zu schreiben.
            </p>
            <PhoneLink className="mt-5 block text-2xl font-bold tracking-tight text-ink" />
          </div>
          <div className="rounded-3xl bg-brand-50 p-7">
            <h3 className="text-lg font-bold text-ink">Servicezeiten</h3>
            <OpeningHours className="mt-4" />
            <p className="mt-5 text-sm leading-relaxed text-ink-soft">
              Tickets und Formulare können Sie jederzeit abschicken. Was außerhalb der Servicezeiten eingeht, bearbeiten wir
              ab Beginn der nächsten.
            </p>
          </div>
          <div className="rounded-3xl bg-brand-50 p-7">
            <Mail className="size-6 text-brand-700" aria-hidden />
            <h3 className="mt-4 text-lg font-bold text-ink">E-Mail</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
              Für alles, was nicht eilt. Störungen melden Firmenkunden bitte im Kundenportal, Privatkunden über das Formular.
            </p>
            <a
              href={`mailto:${site.supportEmail}`}
              className="mt-5 block font-semibold break-words text-ink hover:underline hover:underline-offset-4"
            >
              {site.supportEmail}
            </a>
          </div>
        </div>
        <p className="mt-8 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
          Wie schnell wir uns bei Firmenkunden mit Betreuungsvertrag melden, steht in der Übersicht der{" "}
          <Link href="/unternehmen#reaktionszeiten" className="font-semibold text-brand-700 hover:underline">
            Reaktionszeiten
          </Link>
          .
        </p>
      </Section>
    </>
  );
}

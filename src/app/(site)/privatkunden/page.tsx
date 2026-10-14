import type { Metadata } from "next";
import Link from "next/link";
import { FolderInput, Laptop, MailWarning, Printer, ScreenShare, Wifi } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PrivateSupportForm } from "@/components/forms/private-support-form";
import { PageHero, Section, SectionHeading } from "@/components/site/sections/layout";
import { CheckList } from "@/components/site/sections/check-list";
import { OpeningHours } from "@/components/site/sections/contact";
import { Steps } from "@/components/site/sections/steps";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Computerhilfe für Privatkunden",
  description:
    "Hilfe zu Hause bei PC, Laptop, WLAN, Drucker und verdächtigen E-Mails – per Fernwartung oder vor Ort. Problem im Formular schildern, ohne Konto, mit persönlichem Status-Link.",
};

const help = [
  {
    icon: Laptop,
    title: "PC oder Laptop einrichten",
    text: "Windows einrichten, Updates einspielen, unnötige vorinstallierte Programme entfernen und die Programme installieren, die Sie wirklich brauchen.",
  },
  {
    icon: FolderInput,
    title: "Daten übertragen",
    text: "Fotos, Dokumente, E-Mails und Lesezeichen vom alten auf das neue Gerät. Danach prüfen wir mit Ihnen zusammen, ob alles da ist.",
  },
  {
    icon: Wifi,
    title: "WLAN und Internet",
    text: "Kein Empfang im Arbeitszimmer, Router nach dem Anbieterwechsel neu einrichten, Repeater oder Mesh-System aufstellen.",
  },
  {
    icon: Printer,
    title: "Drucker und Scanner",
    text: "Drucker ins WLAN bringen, Scannen auf den PC einrichten, Fehlermeldungen und Treiberprobleme beheben.",
  },
  {
    icon: MailWarning,
    title: "Viren und verdächtige E-Mails",
    text: "Wir schauen uns an, ob eine Nachricht echt ist, prüfen Ihr Gerät und helfen nach einem Betrugsversuch, Passwörter zu ändern und Konten zu sichern.",
  },
  {
    icon: ScreenShare,
    title: "Fernhilfe",
    text: "Vieles klären wir per Fernwartung, ohne dass jemand vorbeikommen muss. Sie sehen auf Ihrem Bildschirm, was wir tun.",
  },
];

export default function PrivatkundenPage() {
  return (
    <>
      <PageHero
        eyebrow="Für Privatkunden"
        title="Hilfe bei Computerproblemen zu Hause"
        actions={
          <>
            <ButtonLink href="#hilfe-anfordern" size="lg">
              Problem schildern
            </ButtonLink>
            <a
              href={`tel:${site.phoneHref}`}
              className="inline-flex h-12 items-center rounded-full px-2 text-base font-semibold text-ink hover:underline hover:underline-offset-4"
            >
              Lieber anrufen: {site.phone}
            </a>
          </>
        }
        aside={
          <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
            <p className="text-sm font-bold text-ink">Gut zu wissen</p>
            <CheckList
              className="mt-4"
              items={[
                "Sie brauchen kein Kundenkonto und kein Passwort.",
                "Den Stand Ihrer Anfrage sehen Sie über einen persönlichen Link, den wir Ihnen per E-Mail schicken.",
                "Abgerechnet wird nach Aufwand im 15-Minuten-Takt. Vor-Ort-Termine kosten zusätzlich eine Anfahrtspauschale.",
              ]}
            />
          </div>
        }
      >
        <p>
          Der neue Laptop soll eingerichtet werden, der Drucker druckt nicht mehr oder eine E-Mail kommt Ihnen merkwürdig vor?
          Schildern Sie uns das Problem im Formular. Wir melden uns, helfen per Fernwartung oder kommen zu Ihnen.
        </p>
      </PageHero>

      <Section labelledBy="hilfe-titel">
        <SectionHeading id="hilfe-titel" eyebrow="Wobei wir helfen" title="Typische Probleme, die wir lösen">
          <p>
            Die Liste ist nicht vollständig. Wenn Ihr Problem nicht dabei ist, beschreiben Sie es trotzdem – wir sagen Ihnen
            ehrlich, ob wir helfen können.
          </p>
        </SectionHeading>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {help.map((h) => {
            const Icon = h.icon;
            return (
              <li key={h.title} className="rounded-2xl bg-brand-50 p-6">
                <Icon className="size-6 text-brand-700" aria-hidden />
                <h3 className="mt-4 text-lg font-bold text-ink">{h.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{h.text}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section tone="brand" labelledBy="ablauf-titel">
        <SectionHeading id="ablauf-titel" eyebrow="Ablauf" title="So läuft es ab">
          <p>Sie brauchen weder ein Konto noch eine App. Nach drei Schritten ist Ihr Problem in Arbeit.</p>
        </SectionHeading>
        <Steps
          className="mt-12"
          columns={3}
          steps={[
            {
              title: "Formular ausfüllen",
              text: "Beschreiben Sie, was nicht funktioniert und seit wann. Ein Foto der Fehlermeldung hilft uns sehr. Danach bekommen Sie eine E-Mail mit Ihrem persönlichen Status-Link.",
            },
            {
              title: "Wir melden uns",
              text: "In der Regel innerhalb eines Werktags, telefonisch oder per Nachricht. Oft haben wir zuerst ein, zwei Fragen, um das Problem einzugrenzen.",
            },
            {
              title: "Fernhilfe oder Termin",
              text: "Lässt sich das Problem aus der Ferne lösen, verbinden wir uns nach Absprache mit Ihrem Gerät. Sonst vereinbaren wir einen Termin bei Ihnen zu Hause.",
            },
          ]}
        />
        <div className="mt-10 max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-card">
          <h3 className="font-bold text-ink">Was der Status-Link kann</h3>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
            Über den Link aus unserer E-Mail sehen Sie jederzeit, wie weit wir sind, lesen unsere Antworten und können selbst
            antworten. Geben Sie den Link bitte nicht weiter – wer ihn kennt, kann Ihre Anfrage lesen.
          </p>
        </div>
      </Section>

      <Section id="hilfe-anfordern" labelledBy="formular-titel">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
          <div>
            <SectionHeading id="formular-titel" eyebrow="Hilfe anfordern" title="Problem schildern">
              <p>
                Beschreiben Sie in Ruhe, was los ist. Je genauer die Beschreibung, desto schneller können wir helfen.
              </p>
            </SectionHeading>
            <div className="mt-8 rounded-2xl bg-brand-50 p-5 sm:p-6">
              <h3 className="text-sm font-bold text-ink">Das hilft uns weiter</h3>
              <CheckList
                className="mt-3"
                items={[
                  "Um welches Gerät geht es (z. B. Laptop, Drucker), und welches Modell?",
                  "Der genaue Wortlaut der Fehlermeldung – oder ein Foto davon",
                  "Seit wann tritt das Problem auf, und was hat sich davor geändert?",
                  "Was Sie selbst schon ausprobiert haben",
                ]}
              />
            </div>
            <div className="mt-6 space-y-4 text-[0.9375rem] leading-relaxed text-ink-soft">
              <p>
                <span className="font-semibold text-ink">Dringend?</span> Rufen Sie uns während der Servicezeiten an:{" "}
                <a href={`tel:${site.phoneHref}`} className="font-semibold text-ink hover:underline hover:underline-offset-4">
                  {site.phone}
                </a>
              </p>
              <OpeningHours className="max-w-xs" />
              <p>
                <span className="font-semibold text-ink">Link verloren?</span> Unter{" "}
                <Link href="/status" className="font-semibold text-brand-700 hover:underline">
                  Status-Link anfordern
                </Link>{" "}
                schicken wir ihn erneut an Ihre E-Mail-Adresse.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-white p-5 shadow-lift sm:p-8">
            <PrivateSupportForm />
          </div>
        </div>
      </Section>
    </>
  );
}

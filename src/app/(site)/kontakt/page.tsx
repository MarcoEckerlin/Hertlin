import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { site } from "@/config/site";
import type { CustomerType } from "@/lib/constants";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { isInquiryTopic } from "@/components/forms/form-options";
import { Container, PageHero } from "@/components/site/sections/layout";
import { OpeningHours } from "@/components/site/sections/contact";

export const metadata: Metadata = {
  title: "Kontakt und Anfrage",
  description:
    "Schreiben Sie uns, was ansteht – IT-Betreuung für Ihre Firma oder Hilfe für zu Hause. Wir melden uns innerhalb eines Werktags.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** ?typ=privat | ?typ=unternehmen (auch „firma“) */
function customerTypeFromQuery(value: string | undefined): CustomerType | undefined {
  const v = value?.trim().toLowerCase();
  if (v === "privat") return "PRIVATE";
  if (v === "unternehmen" || v === "firma") return "BUSINESS";
  return undefined;
}

export default async function ContactPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const thema = first(query.thema)?.trim().toUpperCase();
  const defaultTopic = isInquiryTopic(thema) ? thema : undefined;
  // „Hilfe für zu Hause“ gibt es nur für Privatpersonen – dann den Kundentyp gleich passend setzen.
  const defaultType =
    customerTypeFromQuery(first(query.typ)) ?? (defaultTopic === "PRIVAT_HILFE" ? "PRIVATE" : undefined);

  return (
    <>
      <PageHero
        eyebrow="Kontakt"
        title="Schreiben Sie uns, was ansteht."
        aside={
          <div className="space-y-4">
            <ExistingCustomerHint title="Schon Firmenkunde bei uns?" href="/login" linkLabel="Zum Kundenportal">
              Störungen und Aufträge melden Sie am schnellsten im Kundenportal Ihrer Firma. Dort sehen Sie auch den Stand
              aller Tickets.
            </ExistingCustomerHint>
            <ExistingCustomerHint
              title="Privat und es klemmt gerade?"
              href="/privatkunden#hilfe-anfordern"
              linkLabel="Zum Hilfe-Formular"
            >
              Wenn PC, Drucker oder WLAN streiken, nutzen Sie bitte das Hilfe-Formular für Privatkunden. Sie bekommen sofort
              eine Ticketnummer und einen Link, über den Sie den Stand sehen.
            </ExistingCustomerHint>
          </div>
        }
      >
        <p>
          Ob Sie für Ihre Firma jemanden suchen, der sich dauerhaft um die IT kümmert, oder zu Hause ein neues Notebook
          eingerichtet haben möchten: Schildern Sie kurz Ihr Anliegen.
        </p>
        <p>
          Wir melden uns innerhalb eines Werktags – bei Firmen meist mit einem Terminvorschlag für ein erstes Kennenlernen.
        </p>
      </PageHero>

      <section aria-labelledby="anfrage" className="bg-white">
        <Container className="grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16 lg:py-20">
          <div className="min-w-0">
            <h2 id="anfrage" className="scroll-mt-28 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Ihre Anfrage
            </h2>
            <p className="mt-2 text-[0.9375rem] text-ink-soft">
              Felder ohne den Zusatz „optional“ brauchen wir, um Ihnen antworten zu können.
            </p>
            <div className="mt-8 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-8">
              <InquiryForm defaultType={defaultType} defaultTopic={defaultTopic} />
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start" aria-label="Ablauf und Kontakt">
            <div className="rounded-2xl bg-brand-50 p-6">
              <h2 className="text-base font-bold text-ink">So geht es weiter</h2>
              <ol className="mt-4 space-y-4 text-[0.9375rem] leading-relaxed text-ink-soft">
                <Step n={1}>Sie bekommen direkt eine Bestätigung per E-Mail mit Ihrer Anfragenummer.</Step>
                <Step n={2}>Innerhalb eines Werktags melden wir uns – so, wie Sie es im Formular wählen.</Step>
                <Step n={3}>
                  Firmen bekommen meist einen Terminvorschlag für ein erstes Gespräch. Bei Privatkunden klären wir, ob wir
                  per Fernwartung helfen können oder vorbeikommen.
                </Step>
              </ol>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
              <h2 className="text-base font-bold text-ink">Lieber direkt?</h2>
              <ul className="mt-4 space-y-3 text-[0.9375rem]">
                <li>
                  <a
                    href={`tel:${site.phoneHref}`}
                    className="inline-flex items-center gap-2.5 font-semibold text-ink hover:text-brand-700"
                  >
                    <Phone className="size-4 shrink-0 text-brand-700" aria-hidden />
                    {site.phone}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${site.email}`}
                    className="inline-flex items-center gap-2.5 font-semibold break-all text-ink hover:text-brand-700"
                  >
                    <Mail className="size-4 shrink-0 text-brand-700" aria-hidden />
                    {site.email}
                  </a>
                </li>
              </ul>

              <h3 className="mt-6 text-sm font-bold text-ink">Servicezeiten</h3>
              <OpeningHours className="mt-2" />

              <h3 className="mt-6 text-sm font-bold text-ink">Anschrift</h3>
              <address className="mt-2 text-sm leading-relaxed text-ink-soft not-italic">
                {site.legalName}
                <br />
                {site.street}
                <br />
                {site.zip} {site.city}
              </address>
            </div>

            <p className="px-1 text-sm leading-relaxed text-ink-muted">
              Link zu Ihrer Privatkunden-Anfrage verloren?{" "}
              <Link href="/status" className="font-semibold text-brand-700 hover:underline">
                Status-Link erneut anfordern
              </Link>
            </p>
          </aside>
        </Container>
      </section>
    </>
  );
}

function ExistingCustomerHint({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink-soft">{children}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-brand-700 hover:underline"
      >
        {linkLabel}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand-700 ring-1 ring-brand-200"
        aria-hidden
      >
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

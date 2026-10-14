import { Mail, MapPin, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { Container } from "@/components/site/sections/layout";

/** Servicezeiten aus der Firmenkonfiguration. */
export function OpeningHours({ className }: { className?: string }) {
  return (
    <dl className={cn("space-y-1.5 text-[0.9375rem]", className)}>
      {site.openingHours.map((o) => (
        <div key={o.days} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4">
          <dt className="text-ink-soft">{o.days}</dt>
          <dd className="text-right font-semibold whitespace-nowrap text-ink">{o.hours}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Telefonnummer als anrufbarer Link. */
export function PhoneLink({ className }: { className?: string }) {
  return (
    <a href={`tel:${site.phoneHref}`} className={cn("hover:underline hover:underline-offset-4", className)}>
      {site.phone}
    </a>
  );
}

/** Kontaktkarte mit Anschrift, Telefon, E-Mail und Servicezeiten. */
export function ContactBox({ title = "So erreichen Sie uns", className }: { title?: string; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8", className)}>
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <ul className="mt-5 space-y-4 text-[0.9375rem] text-ink-soft">
        <li className="flex gap-3">
          <Phone className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
          <span>
            <span className="block text-sm text-ink-muted">Telefon</span>
            <PhoneLink className="font-semibold text-ink" />
          </span>
        </li>
        <li className="flex gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm text-ink-muted">E-Mail</span>
            <a href={`mailto:${site.email}`} className="font-semibold break-words text-ink hover:underline hover:underline-offset-4">
              {site.email}
            </a>
          </span>
        </li>
        <li className="flex gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
          <address className="not-italic">
            <span className="block text-sm text-ink-muted">Anschrift</span>
            <span className="block text-ink">{site.legalName}</span>
            <span className="block">{site.street}</span>
            <span className="block">
              {site.zip} {site.city}
            </span>
          </address>
        </li>
      </ul>
      <div className="mt-6 border-t border-line pt-5">
        <p className="text-sm font-semibold text-ink">Servicezeiten</p>
        <OpeningHours className="mt-2" />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/kontakt">Anfrage stellen</ButtonLink>
        <ButtonLink href="/support" variant="secondary">
          Support für Bestandskunden
        </ButtonLink>
      </div>
    </div>
  );
}

/**
 * Abschluss einer Seite: hellblaue Fläche mit Telefonnummer, Servicezeiten und den beiden Hauptwegen.
 * tone bestimmt den Hintergrund rund um die Fläche (an den vorherigen Abschnitt anpassen).
 */
export function CtaBand({
  title = "Erzählen Sie uns, worum es geht.",
  text = "Ob eine Firma mit zwanzig Arbeitsplätzen einen neuen IT-Dienstleister sucht oder zu Hause der Drucker streikt: Schreiben Sie uns kurz, was los ist, oder rufen Sie während der Servicezeiten an. Sie sprechen dann direkt mit jemandem, der sich auskennt.",
  tone = "white",
}: {
  title?: string;
  text?: string;
  tone?: "white" | "brand";
}) {
  return (
    <section aria-labelledby="cta-titel" className={cn("py-16 lg:py-24", tone === "brand" ? "bg-brand-50" : "bg-white")}>
      <Container>
        <div className="grid gap-10 rounded-3xl bg-brand-400 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center lg:gap-14 lg:px-14">
          <div className="max-w-2xl">
            <h2 id="cta-titel" className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink">{text}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/kontakt" variant="dark" size="lg">
                Anfrage stellen
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">
                Zum Kundenportal
              </ButtonLink>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-6 sm:p-7">
            <p className="text-sm font-semibold text-ink-muted">Telefon</p>
            <PhoneLink className="mt-1 block text-2xl font-bold tracking-tight text-ink" />
            <p className="mt-6 text-sm font-semibold text-ink-muted">Servicezeiten</p>
            <OpeningHours className="mt-2" />
          </div>
        </div>
      </Container>
    </section>
  );
}

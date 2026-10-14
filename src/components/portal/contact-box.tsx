import { MonitorSmartphone, Phone } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/** Telefon für Dringendes, Servicezeiten, Reaktionszeiten und Fernwartung. */
export function ContactBox({ site, showResponseTimes = true, className }: { site: SiteSettings; showResponseTimes?: boolean; className?: string }) {
  const remoteUrl = site.remoteSupportUrl.trim();
  return (
    <Card className={cn("overflow-hidden", className)}>
      <h2 className="sr-only">So erreichen Sie {site.name}</h2>
      <div className="border-b border-brand-200 bg-brand-50 px-5 py-5 sm:px-6">
        <h3 className="text-base font-bold text-ink">Dringend?</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Wenn niemand arbeiten kann, rufen Sie bitte direkt an. Ein Ticket können Sie danach immer noch anlegen.
        </p>
        <a
          href={`tel:${site.phoneHref}`}
          className="mt-3 inline-flex items-center gap-2 text-lg font-bold whitespace-nowrap text-ink hover:text-brand-700"
        >
          <Phone className="size-4 text-brand-700" aria-hidden />
          {site.phone}
        </a>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        {site.openingHours.length > 0 ? (
          <section aria-labelledby="servicezeiten">
            <h3 id="servicezeiten" className="text-sm font-bold text-ink">
              Servicezeiten
            </h3>
            <dl className="mt-2 space-y-1 text-sm">
              {site.openingHours.map((entry) => (
                <div key={entry.days} className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-ink-soft">{entry.days}</dt>
                  <dd className="font-medium text-ink tabular-nums">{entry.hours}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {showResponseTimes && site.responseTimes.length > 0 ? (
          <section aria-labelledby="reaktionszeiten">
            <h3 id="reaktionszeiten" className="text-sm font-bold text-ink">
              Reaktionszeiten
            </h3>
            <ul className="mt-2 space-y-2 text-sm">
              {site.responseTimes.map((entry) => (
                <li key={entry.priority}>
                  <span className="block text-ink-soft">{entry.label}</span>
                  <span className="block font-medium text-ink">{entry.time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Gilt innerhalb der Servicezeiten für Kunden mit Betreuungsvertrag.
            </p>
          </section>
        ) : null}

        {remoteUrl ? (
          <section aria-labelledby="fernwartung" className="border-t border-line pt-5">
            <h3 id="fernwartung" className="flex items-center gap-2 text-sm font-bold text-ink">
              <MonitorSmartphone className="size-4 text-brand-700" aria-hidden />
              Fernwartung
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Sollen wir uns auf Ihren Bildschirm schalten, starten Sie bitte das Programm und nennen uns die angezeigte ID.
            </p>
            <a
              href={remoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              Fernwartung herunterladen
            </a>
          </section>
        ) : null}
      </div>
    </Card>
  );
}

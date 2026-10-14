import { MonitorSmartphone, Phone } from "lucide-react";
import type { SiteSettings } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { Disclosure } from "@/components/portal/disclosure";
import type { PortalContact } from "@/components/portal/portal-data";

/**
 * Telefon für Dringendes, Servicezeiten, Reaktionszeiten und Fernwartung.
 * Telefon und Zeiten kommen vom betreuenden Standort (portalContact); ohne echte Nummer entfällt „Dringend?“.
 */
export function ContactBox({
  site,
  contact,
  showResponseTimes = true,
  className,
}: {
  site: SiteSettings;
  contact: PortalContact;
  showResponseTimes?: boolean;
  className?: string;
}) {
  const remoteUrl = site.remoteSupportUrl.trim();
  const responseTimes = showResponseTimes ? site.responseTimes : [];
  return (
    <Card className={cn("overflow-hidden", className)}>
      <h2 className="sr-only">So erreichen Sie {site.name}</h2>
      {contact.phone && contact.phoneHref ? (
        <div className="border-b border-brand-200 bg-brand-50 px-5 py-4 sm:px-6">
          <h3 className="text-sm font-bold text-ink">Dringend?</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">Wenn niemand arbeiten kann, rufen Sie bitte direkt an.</p>
          <a
            href={contact.phoneHref}
            className="mt-2 inline-flex items-center gap-2 text-lg font-bold whitespace-nowrap text-ink hover:text-brand-700"
          >
            <Phone className="size-4 text-brand-700" aria-hidden />
            {contact.phone}
          </a>
          {contact.locationName ? <p className="text-xs text-ink-muted">{contact.locationName}</p> : null}
        </div>
      ) : null}

      <div className="space-y-5 px-5 py-5 sm:px-6">
        {contact.hours.length > 0 ? (
          <section aria-labelledby="servicezeiten">
            <h3 id="servicezeiten" className="text-sm font-bold text-ink">
              Servicezeiten
            </h3>
            <dl className="mt-2 space-y-1 text-sm">
              {contact.hours.map((entry) => (
                <div key={`${entry.days}-${entry.hours}`} className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-ink-soft">{entry.days}</dt>
                  {entry.hours ? <dd className="font-medium text-ink tabular-nums">{entry.hours}</dd> : null}
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {responseTimes.length > 0 ? (
          <Disclosure summary="Reaktionszeiten" summaryClassName="text-sm font-bold text-ink">
            <ul className="mt-2 space-y-2 text-sm">
              {responseTimes.map((entry) => (
                <li key={entry.priority}>
                  <span className="block text-ink-soft">{entry.label}</span>
                  <span className="block font-medium text-ink">{entry.time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Gilt innerhalb der Servicezeiten für Kunden mit Betreuungsvertrag.
            </p>
          </Disclosure>
        ) : null}

        {remoteUrl ? (
          <section aria-labelledby="fernwartung" className="border-t border-line pt-5">
            <h3 id="fernwartung" className="flex items-center gap-2 text-sm font-bold text-ink">
              <MonitorSmartphone className="size-4 text-brand-700" aria-hidden />
              Fernwartung
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Nur starten, wenn Sie gerade mit uns telefonieren: Programm herunterladen, öffnen und uns ID und Kennwort
              vorlesen.
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

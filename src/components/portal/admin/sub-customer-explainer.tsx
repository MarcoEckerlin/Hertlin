import { cn } from "@/lib/cn";
import { Disclosure } from "@/components/portal/disclosure";

/** Kurze Erklärung, wofür Unterkunden da sind. Aufklappbar; ohne Unterkunden gleich offen. */
export function SubCustomerExplainer({
  rootName,
  portalHost,
  defaultOpen = false,
  className,
}: {
  rootName: string;
  portalHost: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const points = [
    {
      title: "Eigene Benutzer",
      text: `Jede Unterkunde bekommt eigene Zugänge. Angemeldet wird sich wie gewohnt unter ${portalHost}.`,
    },
    {
      title: "Eigene Tickets",
      text: "Tickets laufen unter der Unterkunde. Unsere Techniker sehen sofort, welcher Standort betroffen ist.",
    },
    {
      title: "Sie behalten den Überblick",
      text: `Als Hauptansprechpartner von ${rootName} sehen Sie Tickets und Benutzer aller Unterkunden. Hauptansprechpartner einer Unterkunde sehen nur deren Tickets und Benutzer.`,
    },
    {
      title: "Keine Obergrenze",
      text: "Legen Sie so viele Unterkunden an, wie Sie brauchen. Nicht mehr benötigte deaktivieren Sie – die Tickets bleiben erhalten.",
    },
  ];

  return (
    <Disclosure
      summary="Wofür Unterkunden da sind"
      defaultOpen={defaultOpen}
      className={cn("rounded-2xl border border-line bg-brand-50 px-5 py-4 sm:px-6", className)}
      summaryClassName="text-base font-bold text-ink"
    >
      <p className="mt-2 max-w-3xl text-[0.9375rem] leading-relaxed text-ink-soft">
        Mit Unterkunden bilden Sie ab, wie Ihre Firma aufgebaut ist: Filialen, Standorte, Tochterfirmen, Abteilungen oder
        das Homeoffice.
      </p>
      <dl className="mt-4 grid gap-x-8 gap-y-4 pb-1 md:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="border-l-2 border-brand-300 pl-4">
            <dt className="text-sm font-bold text-ink">{p.title}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-ink-soft">{p.text}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}

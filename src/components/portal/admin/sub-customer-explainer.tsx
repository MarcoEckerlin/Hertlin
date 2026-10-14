import { cn } from "@/lib/cn";

/** Kurze Erklärung, wofür Unterkunden da sind. Wird über bzw. unter der Liste angezeigt. */
export function SubCustomerExplainer({
  rootName,
  portalHost,
  className,
}: {
  rootName: string;
  portalHost: string;
  className?: string;
}) {
  const points = [
    {
      title: "Eigene Benutzer",
      text: `Jede Unterkunde bekommt eigene Zugänge. Angemeldet wird sich wie gewohnt unter ${portalHost} – eine eigene Adresse braucht die Unterkunde nicht.`,
    },
    {
      title: "Eigene Tickets",
      text: "Tickets laufen unter der Unterkunde. Unsere Techniker sehen sofort, welcher Standort betroffen ist und wen sie dort erreichen.",
    },
    {
      title: "Sie behalten den Überblick",
      text: `Als Hauptansprechpartner von ${rootName} sehen Sie die Tickets und Benutzer aller Unterkunden. Wer nur bei einer Unterkunde Hauptansprechpartner ist, sieht nur deren Tickets und Benutzer.`,
    },
    {
      title: "Keine Obergrenze",
      text: "Legen Sie so viele Unterkunden an, wie Sie brauchen. Nicht mehr benötigte deaktivieren Sie einfach – die Tickets bleiben erhalten.",
    },
  ];

  return (
    <section aria-labelledby="unterkunden-erklaerung" className={cn("rounded-2xl border border-line bg-brand-50 p-5 sm:p-6", className)}>
      <h2 id="unterkunden-erklaerung" className="text-base font-bold text-ink">
        Wofür Unterkunden da sind
      </h2>
      <p className="mt-1.5 max-w-3xl text-[0.9375rem] leading-relaxed text-ink-soft">
        Mit Unterkunden bilden Sie ab, wie Ihre Firma aufgebaut ist: Filialen, Standorte, Tochterfirmen, Abteilungen oder
        die Kolleginnen und Kollegen im Homeoffice.
      </p>
      <dl className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="border-l-2 border-brand-300 pl-4">
            <dt className="text-sm font-bold text-ink">{p.title}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-ink-soft">{p.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

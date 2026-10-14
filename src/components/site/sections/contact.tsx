import { cn } from "@/lib/cn";

export type OpeningHour = { days: string; hours: string };

/** Servicezeiten aus den Firmendaten. */
export function OpeningHours({ hours, className }: { hours: OpeningHour[]; className?: string }) {
  if (hours.length === 0) return null;
  return (
    <dl className={cn("space-y-1.5 text-[0.9375rem]", className)}>
      {hours.map((o, i) => (
        <div key={`${o.days}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4">
          <dt className="text-ink-soft">{o.days}</dt>
          <dd className="text-right font-semibold whitespace-nowrap text-ink">{o.hours}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Telefonnummer als anrufbarer Link (ohne gültige Anrufnummer nur als Text). */
export function PhoneLink({ phone, phoneHref, className }: { phone: string; phoneHref: string; className?: string }) {
  const href = phoneHref.replace(/\s+/g, "");
  if (!/^\+?[0-9][0-9/()-]{2,30}$/.test(href)) return <span className={className}>{phone}</span>;
  return (
    <a href={`tel:${href}`} className={cn("hover:underline hover:underline-offset-4", className)}>
      {phone}
    </a>
  );
}

import { Mail, MapPin, Navigation, Phone } from "lucide-react";
import { OpeningHours, PhoneLink } from "@/components/site/sections/contact";
import { cn } from "@/lib/cn";
import type { SiteSettings } from "@/lib/settings";
import { BlockHeading, BlockSection, hasHeading, hasText, headingId, type BlockProps } from "@/cms/blocks/shared";

/** Kontaktkarte mit Telefon, E-Mail, Anschrift, Einsatzgebiet und Servicezeiten aus den Firmendaten. */
export function ContactCard({
  settings,
  showAddress,
  showHours,
  className,
}: {
  settings: SiteSettings;
  showAddress: boolean;
  showHours: boolean;
  className?: string;
}) {
  const { phone, phoneHref, email, legalName, street, zip, city, region, openingHours } = settings;
  const place = [zip, city].filter((v) => v.trim()).join(" ");
  const hasAddress = showAddress && (hasText(street) || hasText(place));

  return (
    <div className={cn("rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8", className)}>
      <ul className="space-y-4 text-[0.9375rem] text-ink-soft">
        {hasText(phone) ? (
          <li className="flex gap-3">
            <Phone className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm text-ink-muted">Telefon</span>
              <PhoneLink phone={phone} phoneHref={phoneHref} className="font-semibold text-ink" />
            </span>
          </li>
        ) : null}
        {hasText(email) ? (
          <li className="flex gap-3">
            <Mail className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm text-ink-muted">E-Mail</span>
              <a
                href={`mailto:${email.trim()}`}
                className="font-semibold break-words text-ink hover:underline hover:underline-offset-4"
              >
                {email}
              </a>
            </span>
          </li>
        ) : null}
        {hasAddress ? (
          <li className="flex gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            <address className="min-w-0 not-italic">
              <span className="block text-sm text-ink-muted">Anschrift</span>
              {hasText(legalName) ? <span className="block text-ink">{legalName}</span> : null}
              {hasText(street) ? <span className="block">{street}</span> : null}
              {hasText(place) ? <span className="block">{place}</span> : null}
            </address>
          </li>
        ) : null}
        {hasText(region) ? (
          <li className="flex gap-3">
            <Navigation className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm text-ink-muted">Einsatzgebiet vor Ort</span>
              <span className="block font-semibold text-ink">{region}</span>
            </span>
          </li>
        ) : null}
      </ul>
      {showHours && openingHours.length > 0 ? (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-semibold text-ink">Servicezeiten</p>
          <OpeningHours hours={openingHours} className="mt-2" />
        </div>
      ) : null}
    </div>
  );
}

/** Kontaktangaben: Überschrift und Text links, Kontaktkarte rechts. */
export function ContactBlock({ block, ctx, layout }: BlockProps<"contact">) {
  const titleId = headingId(block, layout);
  const card = (
    <ContactCard settings={ctx.settings} showAddress={block.showAddress} showHours={block.showHours} />
  );

  if (!hasHeading(block)) {
    return (
      <BlockSection block={block} layout={layout}>
        <div className="max-w-xl">{card}</div>
      </BlockSection>
    );
  }

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
        <BlockHeading block={block} ctx={ctx} id={titleId} />
        {card}
      </div>
    </BlockSection>
  );
}

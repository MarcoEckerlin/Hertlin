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
  onBlue = false,
  className,
}: {
  settings: SiteSettings;
  showAddress: boolean;
  showHours: boolean;
  /** Abschnitt mit hellblauem Hintergrund: Karte weiß mit feinem Rahmen, sonst hellblau ohne Rahmen */
  onBlue?: boolean;
  className?: string;
}) {
  const { phone, phoneHref, email, legalName, street, zip, city, region, openingHours } = settings;
  const place = [zip, city].filter((v) => v.trim()).join(" ");
  const hasAddress = showAddress && (hasText(street) || hasText(place));

  return (
    <div className={cn("rounded-2xl p-6 sm:p-8", onBlue ? "bg-surface ring-1 ring-line" : "bg-brand-50", className)}>
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
        <div className={cn("mt-6 border-t pt-5", onBlue ? "border-line" : "border-line-strong")}>
          <p className="text-sm font-semibold text-ink">Servicezeiten</p>
          <OpeningHours hours={openingHours} className="mt-2" />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Telefon und E-Mail als kurze Liste ohne Kasten (z. B. neben dem Anfrageformular),
 * darunter auf Wunsch die Servicezeiten in einer Zeile je Eintrag.
 */
export function ContactLines({
  settings,
  showHours = true,
  className,
}: {
  settings: Pick<SiteSettings, "phone" | "phoneHref" | "email" | "openingHours">;
  showHours?: boolean;
  className?: string;
}) {
  const { phone, phoneHref, email, openingHours } = settings;
  if (!hasText(phone) && !hasText(email)) return null;
  return (
    <div className={cn("space-y-3 text-[0.9375rem] text-ink-soft", className)}>
      <ul className="space-y-2">
        {hasText(phone) ? (
          <li className="flex items-center gap-3">
            <Phone className="size-4 shrink-0 text-brand-700" aria-hidden />
            <span className="sr-only">Telefon: </span>
            <PhoneLink phone={phone} phoneHref={phoneHref} className="font-semibold text-ink" />
          </li>
        ) : null}
        {hasText(email) ? (
          <li className="flex items-center gap-3">
            <Mail className="size-4 shrink-0 text-brand-700" aria-hidden />
            <span className="sr-only">E-Mail: </span>
            <a
              href={`mailto:${email.trim()}`}
              className="min-w-0 font-semibold break-words text-ink hover:underline hover:underline-offset-4"
            >
              {email}
            </a>
          </li>
        ) : null}
      </ul>
      {showHours && openingHours.length > 0 ? (
        <p className="text-sm leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink-soft">Servicezeiten:</span>{" "}
          {openingHours.map((o) => `${o.days} ${o.hours}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

/** Kontaktangaben: Überschrift und Text links, Kontaktkarte rechts. */
export function ContactBlock({ block, ctx, layout }: BlockProps<"contact">) {
  const titleId = headingId(block, layout);
  const card = (
    <ContactCard
      settings={ctx.settings}
      showAddress={block.showAddress}
      showHours={block.showHours}
      onBlue={layout.bg === "blue"}
    />
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
      <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-20">
        <BlockHeading block={block} ctx={ctx} id={titleId} />
        {card}
      </div>
    </BlockSection>
  );
}

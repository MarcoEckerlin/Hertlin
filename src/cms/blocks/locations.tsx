import { Clock, ExternalLink, Info, Mail, MapPin, Phone } from "lucide-react";
import { listWebsiteLocations } from "@/lib/locations";
import { cn } from "@/lib/cn";
import {
  LocationOpeningHours,
  LocationPhone,
  openingHourLines,
  routeUrl,
  type SiteLocation,
} from "@/components/site/locations";
import {
  BlockHeading,
  BlockSection,
  hasHeading,
  hasText,
  headingId,
  panelClasses,
  type BlockProps,
} from "@/cms/blocks/shared";

/**
 * Modul „Standorte“: alle aktiven Standorte mit „Auf der Website zeigen“ (Verwaltung › Standorte).
 * Ohne Standorte erscheint auf der Website nichts; in der Vorschau steht ein Hinweis.
 */
export async function LocationsBlock(props: BlockProps<"locations">) {
  const locations = await listWebsiteLocations();
  return <LocationsView {...props} locations={locations} />;
}

/** Spalten je Anzahl: einer schmal, zwei nebeneinander, ab drei bis zu drei Spalten. */
function gridClasses(count: number): string {
  if (count === 1) return "max-w-xl";
  if (count === 2) return "sm:grid-cols-2 lg:max-w-5xl";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

export function LocationsView({ block, ctx, layout, locations }: BlockProps<"locations"> & { locations: SiteLocation[] }) {
  const titleId = headingId(block, layout);

  if (locations.length === 0) {
    if (!ctx.preview) return null;
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <BlockHeading block={block} ctx={ctx} id={titleId} />
        <p
          className={cn(
            "max-w-xl rounded-2xl border border-dashed border-line-strong p-6 text-[0.9375rem] text-ink-soft",
            hasHeading(block) && "mt-10",
          )}
        >
          Hier erscheinen die Standorte, sobald unter Verwaltung › Standorte mindestens einer mit „Auf der Website zeigen“
          angelegt ist. Bis dahin bleibt das Modul auf der Website unsichtbar.
        </p>
      </BlockSection>
    );
  }

  const itemHeading = hasText(block.title) ? "h3" : "h2";
  const showMain = locations.length > 1;

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      <ul className={cn("grid gap-6", gridClasses(locations.length), hasHeading(block) && "mt-10 lg:mt-12")}>
        {locations.map((location) => (
          <li key={location.id} className="min-w-0">
            <LocationCard
              location={location}
              headingAs={itemHeading}
              showMain={showMain}
              className={panelClasses(layout.bg)}
            />
          </li>
        ))}
      </ul>
    </BlockSection>
  );
}

const iconClass = "mt-0.5 size-5 shrink-0 text-brand-700";

function LocationCard({
  location,
  headingAs: Heading,
  showMain,
  className,
}: {
  location: SiteLocation;
  headingAs: "h2" | "h3";
  showMain: boolean;
  className?: string;
}) {
  const place = [location.zip, location.city].filter((v) => v.trim()).join(" ");
  const hasHours = openingHourLines(location.openingHours).length > 0;

  return (
    <article className={cn("flex h-full flex-col rounded-2xl p-6 sm:p-7", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Heading className="text-lg font-bold tracking-tight break-words text-ink">{location.name}</Heading>
        {showMain && location.isMain ? (
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800">Hauptsitz</span>
        ) : null}
      </div>

      <ul className="mt-4 space-y-3 text-[0.9375rem] text-ink-soft">
        <li className="flex gap-3">
          <MapPin className={iconClass} aria-hidden />
          <address className="min-w-0 not-italic">
            <span className="sr-only">Anschrift: </span>
            <span className="block">{location.street}</span>
            {place ? <span className="block">{place}</span> : null}
          </address>
        </li>
        {hasText(location.phone) ? (
          <li className="flex gap-3">
            <Phone className={iconClass} aria-hidden />
            <span className="min-w-0">
              <span className="sr-only">Telefon: </span>
              <LocationPhone phone={location.phone} className="font-semibold text-ink" />
            </span>
          </li>
        ) : null}
        {hasText(location.email) ? (
          <li className="flex gap-3">
            <Mail className={iconClass} aria-hidden />
            <span className="min-w-0">
              <span className="sr-only">E-Mail: </span>
              <a
                href={`mailto:${location.email.trim()}`}
                className="font-semibold break-words text-ink hover:underline hover:underline-offset-4"
              >
                {location.email}
              </a>
            </span>
          </li>
        ) : null}
        {hasHours ? (
          <li className="flex gap-3">
            <Clock className={iconClass} aria-hidden />
            <div className="min-w-0 flex-1">
              <span className="sr-only">Öffnungszeiten: </span>
              <LocationOpeningHours text={location.openingHours} />
            </div>
          </li>
        ) : null}
        {hasText(location.note) ? (
          <li className="flex gap-3">
            <Info className={iconClass} aria-hidden />
            <span className="min-w-0">{location.note}</span>
          </li>
        ) : null}
      </ul>

      <p className="mt-auto pt-5">
        <a
          href={routeUrl(location)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-brand-700 hover:text-brand-800 hover:underline hover:underline-offset-4"
        >
          Route planen
          <ExternalLink className="size-4" aria-hidden />
          <span className="sr-only"> zu {location.name} (OpenStreetMap, öffnet in neuem Fenster)</span>
        </a>
      </p>
    </article>
  );
}

import {
  Building2,
  Check,
  Clock,
  Headset,
  House,
  Mail,
  Map as MapIcon,
  Monitor,
  Network,
  Phone,
  Printer,
  Server,
  ShieldCheck,
  Ticket,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { markedRule } from "@/components/site/sections/layout";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import type { ICONS } from "@/cms/schema";
import {
  BlockHeading,
  BlockSection,
  TextLink,
  hasHeading,
  hasText,
  headingId,
  panelClasses,
  plain,
  type BlockProps,
} from "@/cms/blocks/shared";

/** Symbole der Website (gleiche Namen wie im Editor). */
export const ICON_COMPONENTS: Record<(typeof ICONS)[number], LucideIcon> = {
  monitor: Monitor,
  network: Network,
  mail: Mail,
  server: Server,
  shield: ShieldCheck,
  phone: Phone,
  printer: Printer,
  wifi: Wifi,
  headset: Headset,
  building: Building2,
  home: House,
  users: Users,
  clock: Clock,
  ticket: Ticket,
  check: Check,
  map: MapIcon,
};

const gridColumns = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 xl:grid-cols-4",
} as const;

/**
 * Kacheln – drei Darstellungen (Feld „layout“):
 * - tiles:   Kästen mit Hintergrund, z. B. für wenige gleichwertige Angebote
 * - columns: Spalten ohne Kasten, jede mit feiner Linie und hellblauer Markierung darüber
 * - rows:    Zeilen untereinander, Überschrift links und Text rechts (wie eine Übersicht mit Konditionen)
 * Die Abschnittsüberschrift steht immer über den Kacheln.
 */
export function CardsBlock({ block, ctx, layout }: BlockProps<"cards">) {
  const titleId = headingId(block, layout);
  const withHeading = hasHeading(block);
  const ItemTag = hasText(block.title) ? "h3" : "h2";
  const itemHeadingBase = ItemTag === "h3" ? 4 : 3;
  const onBlue = layout.bg === "blue";

  let list: ReactNode = null;
  if (block.items.length > 0 && block.layout === "rows") {
    list = (
      <ul className={cn("border-b", onBlue ? "border-line-strong" : "border-line", withHeading && "mt-10 lg:mt-12")}>
        {block.items.map((item, i) => {
          const Icon = item.icon ? ICON_COMPONENTS[item.icon] : null;
          return (
            <li
              key={i}
              className={cn(
                "grid gap-x-12 gap-y-2 border-t py-6 sm:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] sm:py-7",
                onBlue ? "border-line-strong" : "border-line",
              )}
            >
              <div className="flex items-start gap-3">
                {Icon ? <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden /> : null}
                <ItemTag className="text-lg leading-snug font-bold text-ink">{plain(item.title, ctx)}</ItemTag>
              </div>
              <div>
                <Markdown
                  text={item.text}
                  ctx={ctx.text}
                  variant="compact"
                  headingBase={itemHeadingBase}
                  className="max-w-prose sm:text-base"
                />
                {item.link ? (
                  <div className="mt-3">
                    <TextLink cta={item.link} ctx={ctx} />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  } else if (block.items.length > 0 && block.layout === "columns") {
    list = (
      <ul
        className={cn(
          "grid gap-x-10 gap-y-10 lg:gap-x-12 lg:gap-y-12",
          gridColumns[block.columns],
          withHeading && "mt-10 lg:mt-14",
        )}
      >
        {block.items.map((item, i) => {
          const Icon = item.icon ? ICON_COMPONENTS[item.icon] : null;
          return (
            <li key={i} className={cn("flex flex-col pt-6", markedRule(onBlue))}>
              <div className="flex items-start gap-3">
                {Icon ? <Icon className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden /> : null}
                <ItemTag className="text-lg leading-snug font-bold text-ink">{plain(item.title, ctx)}</ItemTag>
              </div>
              <Markdown
                text={item.text}
                ctx={ctx.text}
                variant="compact"
                headingBase={itemHeadingBase}
                className="mt-2 max-w-prose"
              />
              {item.link ? (
                <div className="mt-auto pt-4">
                  <TextLink cta={item.link} ctx={ctx} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  } else if (block.items.length > 0) {
    list = (
      <ul className={cn("grid gap-4", gridColumns[block.columns], withHeading && "mt-10 lg:mt-12")}>
        {block.items.map((item, i) => {
          const Icon = item.icon ? ICON_COMPONENTS[item.icon] : null;
          return (
            <li key={i} className={cn("flex flex-col rounded-2xl p-6 sm:p-7", panelClasses(layout.bg))}>
              {Icon ? <Icon className="size-6 text-brand-700" aria-hidden /> : null}
              <ItemTag className={cn("text-lg font-bold text-ink", Icon && "mt-4")}>{plain(item.title, ctx)}</ItemTag>
              <Markdown
                text={item.text}
                ctx={ctx.text}
                variant="compact"
                headingBase={itemHeadingBase}
                className="mt-2"
              />
              {item.link ? (
                <div className="mt-auto pt-5">
                  <TextLink cta={item.link} ctx={ctx} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      {list}
    </BlockSection>
  );
}

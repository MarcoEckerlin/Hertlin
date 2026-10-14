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
 * Kacheln.
 * Bei zwei Kacheln pro Zeile steht die Überschrift ab Desktopbreite links neben den Kacheln,
 * sonst darüber.
 */
export function CardsBlock({ block, ctx, layout }: BlockProps<"cards">) {
  const titleId = headingId(block, layout);
  const withHeading = hasHeading(block);
  const sideBySide = block.columns === 2 && withHeading;
  const HeadingTag = hasText(block.title) ? "h3" : "h2";

  const list =
    block.items.length > 0 ? (
      <ul className={cn("grid gap-4", gridColumns[block.columns], withHeading && !sideBySide && "mt-12")}>
        {block.items.map((item, i) => {
          const Icon = item.icon ? ICON_COMPONENTS[item.icon] : null;
          return (
            <li key={i} className={cn("flex flex-col rounded-2xl p-6 sm:p-7", panelClasses(layout.bg))}>
              {Icon ? <Icon className="size-6 text-brand-700" aria-hidden /> : null}
              <HeadingTag className={cn("text-lg font-bold text-ink", Icon && "mt-4")}>{plain(item.title, ctx)}</HeadingTag>
              <Markdown
                text={item.text}
                ctx={ctx.text}
                variant="compact"
                listStyle="check"
                headingBase={HeadingTag === "h3" ? 4 : 3}
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
    ) : null;

  if (sideBySide) {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <BlockHeading block={block} ctx={ctx} id={titleId} className="lg:sticky lg:top-28 lg:self-start" />
          {list}
        </div>
      </BlockSection>
    );
  }

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      {list}
    </BlockSection>
  );
}

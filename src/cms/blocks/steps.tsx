import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import {
  BlockHeading,
  BlockSection,
  hasHeading,
  hasText,
  headingId,
  panelClasses,
  plain,
  type BlockProps,
} from "@/cms/blocks/shared";

/** Spalten ab Desktopbreite, so dass möglichst keine einzelne Karte in der letzten Zeile steht. */
function columnsFor(count: number): string {
  if (count <= 2) return "sm:grid-cols-2";
  if (count % 4 === 0) return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

/** Ab dieser durchschnittlichen Textlänge stehen die Schritte untereinander statt nebeneinander. */
const LONG_TEXT = 220;

/**
 * Nummerierte Schritte.
 * Kurze Schritte stehen nebeneinander (wie „So läuft eine Störungsmeldung ab“),
 * lange untereinander mit der Überschrift links (wie „Wie wir arbeiten“).
 */
export function StepsBlock({ block, ctx, layout }: BlockProps<"steps">) {
  const titleId = headingId(block, layout);
  const withHeading = hasHeading(block);
  const ItemTag = hasText(block.title) ? "h3" : "h2";
  const items = block.items;
  const avgLength = items.length ? items.reduce((sum, s) => sum + s.text.length, 0) / items.length : 0;
  const vertical = avgLength > LONG_TEXT;

  if (vertical) {
    const list = (
      <ol className="space-y-5">
        {items.map((step, i) => (
          <li key={i} className={cn("rounded-3xl p-6 sm:p-8", panelClasses(layout.bg))}>
            <p aria-hidden="true" className="text-sm font-bold text-brand-700">
              {String(i + 1).padStart(2, "0")}
            </p>
            <ItemTag className="mt-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">{plain(step.title, ctx)}</ItemTag>
            <Markdown
              text={step.text}
              ctx={ctx.text}
              variant="compact"
              listStyle="check"
              headingBase={ItemTag === "h3" ? 4 : 3}
              className="mt-3 max-w-prose sm:text-base"
            />
          </li>
        ))}
      </ol>
    );
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        {withHeading ? (
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <BlockHeading block={block} ctx={ctx} id={titleId} className="lg:sticky lg:top-28 lg:self-start" />
            {list}
          </div>
        ) : (
          <div className="max-w-3xl">{list}</div>
        )}
      </BlockSection>
    );
  }

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      {items.length > 0 ? (
        <ol className={cn("grid gap-4 sm:gap-5", columnsFor(items.length), withHeading && "mt-12")}>
          {items.map((step, i) => (
            <li key={i} className={cn("rounded-2xl p-6", panelClasses(layout.bg))}>
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-full bg-brand-400 text-base font-bold text-ink"
              >
                {i + 1}
              </span>
              <ItemTag className="mt-5 text-lg font-bold text-ink">{plain(step.title, ctx)}</ItemTag>
              <Markdown
                text={step.text}
                ctx={ctx.text}
                variant="compact"
                listStyle="check"
                headingBase={ItemTag === "h3" ? 4 : 3}
                className="mt-2"
              />
            </li>
          ))}
        </ol>
      ) : null}
    </BlockSection>
  );
}

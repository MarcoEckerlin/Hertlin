import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import {
  BlockHeading,
  BlockSection,
  CtaButton,
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

/**
 * Nummerierte Schritte.
 * - list:  schlichte nummerierte Liste untereinander, getrennt durch feine Linien. Die Ziffer steht groß
 *          in Hellblau, weil sie hier eine Information trägt (die Reihenfolge).
 * - cards: Kacheln nebeneinander – für kurze Schritte, am besten nur einmal auf der Website.
 * Optional steht direkt unter der Überschrift ein Button (z. B. „Fernwartung herunterladen“) mit einem kurzen
 * Hinweis daneben – so ist die wichtigste Aktion sofort sichtbar und nicht erst nach allen Schritten.
 */
export function StepsBlock({ block, ctx, layout }: BlockProps<"steps">) {
  const titleId = headingId(block, layout);
  const withHeading = hasHeading(block);
  const ItemTag = hasText(block.title) ? "h3" : "h2";
  const items = block.items;
  const onBlue = layout.bg === "blue";
  const hasNote = hasText(block.note);
  const action =
    block.cta || hasNote ? (
      <div
        className={cn(
          "flex max-w-3xl flex-col gap-x-8 gap-y-5 sm:flex-row sm:items-center",
          withHeading && "mt-8",
        )}
      >
        <CtaButton cta={block.cta} ctx={ctx} size="lg" className="self-start sm:self-center" />
        {hasNote ? (
          <Markdown
            text={block.note}
            ctx={ctx.text}
            variant="compact"
            headingBase={ItemTag === "h3" ? 4 : 3}
            className="border-l-2 border-warning-solid pl-4"
          />
        ) : null}
      </div>
    ) : null;
  const listSpacing = withHeading || action ? "mt-10 lg:mt-12" : undefined;

  if (block.layout === "cards") {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <BlockHeading block={block} ctx={ctx} id={titleId} />
        {action}
        {items.length > 0 ? (
          <ol className={cn("grid gap-4 sm:gap-5", columnsFor(items.length), listSpacing)}>
            {items.map((step, i) => (
              <li key={i} className={cn("flex flex-col rounded-2xl p-6 sm:p-7", panelClasses(layout.bg))}>
                <span aria-hidden="true" className="text-[2.5rem] leading-none font-semibold text-brand-500 tabular-nums">
                  {i + 1}
                </span>
                <ItemTag className="mt-5 text-lg leading-snug font-bold text-ink">
                  {plain(step.title, ctx)}
                </ItemTag>
                <Markdown
                  text={step.text}
                  ctx={ctx.text}
                  variant="compact"
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

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      {action}
      {items.length > 0 ? (
        <ol className={cn("max-w-3xl border-b", onBlue ? "border-line-strong" : "border-line", listSpacing)}>
          {items.map((step, i) => (
            <li
              key={i}
              className={cn(
                "grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 border-t py-6 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6 sm:py-7",
                onBlue ? "border-line-strong" : "border-line",
              )}
            >
              <span
                aria-hidden="true"
                className="text-[2rem] leading-none font-semibold text-brand-500 tabular-nums sm:text-[2.5rem]"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <ItemTag className="text-lg leading-snug font-bold text-ink sm:text-xl">
                  {plain(step.title, ctx)}
                </ItemTag>
                <Markdown
                  text={step.text}
                  ctx={ctx.text}
                  variant="compact"
                  headingBase={ItemTag === "h3" ? 4 : 3}
                  className="mt-2 max-w-prose sm:text-base"
                />
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </BlockSection>
  );
}

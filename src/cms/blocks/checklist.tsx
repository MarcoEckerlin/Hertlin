import { Check } from "lucide-react";
import { markedRule } from "@/components/site/sections/layout";
import { cn } from "@/lib/cn";
import { InlineMarkdown, Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, hasText, headingId, plain, type BlockProps } from "@/cms/blocks/shared";

/** Spalten für die kurze Übersicht ohne Überschrift (z. B. direkt unter dem Seitenkopf). */
function stripColumns(count: number): string {
  if (count <= 1) return "";
  if (count === 2 || count === 4) return "sm:grid-cols-2";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

/**
 * Liste mit Häkchen.
 * Mit Überschrift: Überschrift oben, Liste darunter (ab Tabletbreite zweispaltig, wenn es viele Punkte sind).
 * Ohne Überschrift: kurze Übersicht hinter einer feinen Linie, die Dachzeile wird zur kleinen Überschrift
 * (z. B. „Gut zu wissen“). Passt direkt unter den Seitenkopf.
 */
export function ChecklistBlock({ block, ctx, layout }: BlockProps<"checklist">) {
  const titleId = headingId(block, layout);
  const items = block.items.filter((item) => item.trim().length > 0);
  const onBlue = layout.bg === "blue";

  const renderItems = (className: string) =>
    items.length > 0 ? (
      <ul className={cn("text-[0.9375rem] leading-relaxed text-ink-soft", className)}>
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <Check className="mt-[0.3em] size-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden />
            <span className="min-w-0">
              <InlineMarkdown text={item} ctx={ctx.text} />
            </span>
          </li>
        ))}
      </ul>
    ) : null;

  if (hasText(block.title)) {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <BlockHeading block={block} ctx={ctx} id={titleId} />
        {renderItems(
          cn("mt-8 grid max-w-4xl gap-x-12 gap-y-3 sm:text-base", items.length > 4 && "sm:grid-cols-2"),
        )}
      </BlockSection>
    );
  }

  const labelId = hasText(block.eyebrow) ? `${layout.domId}-titel` : undefined;
  return (
    <BlockSection block={block} layout={layout} labelledBy={labelId}>
      <div className={cn("max-w-6xl pt-6", markedRule(onBlue))}>
        {labelId ? (
          <h2 id={labelId} className="text-sm font-bold text-ink">
            {plain(block.eyebrow, ctx)}
          </h2>
        ) : null}
        <Markdown text={block.intro} ctx={ctx.text} variant="compact" className={cn("max-w-2xl", labelId && "mt-2")} />
        {renderItems(
          cn("grid gap-x-10 gap-y-3", stripColumns(items.length), (labelId || hasText(block.intro)) && "mt-4"),
        )}
      </div>
    </BlockSection>
  );
}

import { CheckList } from "@/components/site/sections/check-list";
import { cn } from "@/lib/cn";
import { InlineMarkdown, Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, hasText, headingId, plain, type BlockProps } from "@/cms/blocks/shared";

/**
 * Liste mit Häkchen.
 * Mit Überschrift: Überschrift links, Liste rechts in einem Kasten.
 * Ohne Überschrift: kompakter Kasten, die Dachzeile wird zur Kastenüberschrift (z. B. „Gut zu wissen“).
 */
export function ChecklistBlock({ block, ctx, layout }: BlockProps<"checklist">) {
  const titleId = headingId(block, layout);
  const items = block.items.filter((item) => item.trim().length > 0);
  const box = cn(
    "rounded-3xl p-6 sm:p-8",
    layout.bg === "blue" ? "border border-line bg-white shadow-card" : "bg-brand-50",
  );
  const list =
    items.length > 0 ? (
      <CheckList items={items.map((item, i) => <InlineMarkdown key={i} text={item} ctx={ctx.text} />)} />
    ) : null;

  if (hasText(block.title)) {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <BlockHeading block={block} ctx={ctx} id={titleId} />
          {list ? <div className={cn(box, "lg:self-start")}>{list}</div> : null}
        </div>
      </BlockSection>
    );
  }

  const labelId = hasText(block.eyebrow) ? `${layout.domId}-titel` : undefined;
  return (
    <BlockSection block={block} layout={layout} labelledBy={labelId}>
      <div className={cn(box, "max-w-3xl")}>
        {labelId ? (
          <h2 id={labelId} className="text-sm font-bold text-ink">
            {plain(block.eyebrow, ctx)}
          </h2>
        ) : null}
        <Markdown
          text={block.intro}
          ctx={ctx.text}
          variant="compact"
          className={cn(labelId && "mt-2")}
        />
        {list ? <div className={cn((labelId || hasText(block.intro)) && "mt-4")}>{list}</div> : null}
      </div>
    </BlockSection>
  );
}

import { Faq } from "@/components/site/sections/faq";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, hasHeading, headingId, plain, type BlockProps } from "@/cms/blocks/shared";

/**
 * Häufige Fragen zum Aufklappen (details/summary, funktioniert ohne JavaScript).
 * Überschrift oben, darunter die Fragen als ruhige Liste mit feinen Linien in Lesebreite.
 */
export function FaqBlock({ block, ctx, layout }: BlockProps<"faq">) {
  const titleId = headingId(block, layout);
  const items = block.items.map((item) => ({
    question: plain(item.question, ctx),
    answer: <Markdown text={item.answer} ctx={ctx.text} variant="compact" headingBase={4} className="sm:text-base" />,
  }));
  const withHeading = hasHeading(block);

  return (
    <BlockSection block={block} layout={layout} labelledBy={withHeading ? titleId : undefined}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      {items.length > 0 ? (
        <Faq items={items} onBlue={layout.bg === "blue"} className={cn("max-w-3xl", withHeading && "mt-10 lg:mt-12")} />
      ) : null}
    </BlockSection>
  );
}

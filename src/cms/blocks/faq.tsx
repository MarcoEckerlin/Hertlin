import { Faq } from "@/components/site/sections/faq";
import { Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, hasHeading, headingId, plain, type BlockProps } from "@/cms/blocks/shared";

/** Häufige Fragen zum Aufklappen (details/summary, funktioniert ohne JavaScript). */
export function FaqBlock({ block, ctx, layout }: BlockProps<"faq">) {
  const titleId = headingId(block, layout);
  const items = block.items.map((item) => ({
    question: plain(item.question, ctx),
    answer: (
      <Markdown text={item.answer} ctx={ctx.text} variant="compact" listStyle="check" headingBase={4} />
    ),
  }));
  const faq = items.length > 0 ? <Faq items={items} /> : null;

  if (!hasHeading(block)) {
    return (
      <BlockSection block={block} layout={layout}>
        <div className="max-w-3xl">{faq}</div>
      </BlockSection>
    );
  }

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <BlockHeading block={block} ctx={ctx} id={titleId} className="lg:sticky lg:top-28 lg:self-start" />
        {faq}
      </div>
    </BlockSection>
  );
}

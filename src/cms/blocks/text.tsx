import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, hasHeading, hasText, headingId, type BlockProps } from "@/cms/blocks/shared";

/**
 * Überschrift und Fließtext.
 * - narrow: eine Lesespalte (Rechtstexte, längere Erklärungen)
 * - wide:   mit Überschrift links und Text rechts (z. B. einzelne Leistungsbereiche)
 */
export function TextBlock({ block, ctx, layout }: BlockProps<"text">) {
  const titleId = headingId(block, layout);
  const withHeading = hasHeading(block);
  const headingBase = hasText(block.title) ? 3 : 2;

  if (block.width === "wide" && withHeading) {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <BlockHeading block={block} ctx={ctx} id={titleId} className="lg:sticky lg:top-28 lg:self-start" />
          <Markdown
            text={block.body}
            ctx={ctx.text}
            variant="prose"
            listStyle="check"
            headingBase={headingBase}
            className="max-w-2xl"
          />
        </div>
      </BlockSection>
    );
  }

  const wide = block.width === "wide";
  // Nur eine Dachzeile (z. B. „Hinweis“): Text direkt darunter
  const bodySpacing = hasText(block.title) || hasText(block.intro) ? "mt-8" : withHeading ? "mt-3" : undefined;
  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className={wide ? "max-w-4xl" : "max-w-[44rem]"}>
        <BlockHeading block={block} ctx={ctx} id={titleId} />
        <Markdown
          text={block.body}
          ctx={ctx.text}
          variant="prose"
          listStyle={wide ? "check" : "bullet"}
          headingBase={headingBase}
          className={cn(bodySpacing)}
        />
      </div>
    </BlockSection>
  );
}

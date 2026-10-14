import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, hasHeading, hasText, headingId, plain, type BlockProps } from "@/cms/blocks/shared";

/**
 * Überschrift und Fließtext.
 * - narrow: eine Lesespalte (Rechtstexte, längere Erklärungen)
 * - wide:   Überschrift in der Randspalte links, Text rechts (z. B. einzelne Leistungsbereiche)
 * - note:   Hinweis, eingerückt mit hellblauer Randlinie (z. B. „Was der Status-Link kann“)
 */
export function TextBlock({ block, ctx, layout }: BlockProps<"text">) {
  const titleId = headingId(block, layout);
  const withHeading = hasHeading(block);
  const headingBase = hasText(block.title) ? 3 : 2;

  if (block.width === "note") {
    const labelId = hasText(block.title) ? titleId : undefined;
    return (
      <BlockSection block={block} layout={layout} labelledBy={labelId}>
        <aside className="max-w-[44rem] border-l-2 border-brand-400 pl-5 sm:pl-8">
          {hasText(block.eyebrow) ? (
            <p className="text-sm font-semibold text-brand-800">{plain(block.eyebrow, ctx)}</p>
          ) : null}
          {hasText(block.title) ? (
            <h2
              id={labelId}
              className={cn("text-lg font-bold tracking-tight text-ink sm:text-xl", hasText(block.eyebrow) && "mt-1")}
            >
              {plain(block.title, ctx)}
            </h2>
          ) : null}
          <Markdown
            text={block.intro}
            ctx={ctx.text}
            variant="prose"
            headingBase={headingBase}
            className={cn((hasText(block.title) || hasText(block.eyebrow)) && "mt-2")}
          />
          <Markdown
            text={block.body}
            ctx={ctx.text}
            variant="prose"
            headingBase={headingBase}
            className={cn((hasText(block.title) || hasText(block.eyebrow) || hasText(block.intro)) && "mt-2")}
          />
        </aside>
      </BlockSection>
    );
  }

  if (block.width === "wide" && withHeading) {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
          <BlockHeading
            block={block}
            ctx={ctx}
            id={titleId}
            size="minor"
            className="lg:sticky lg:top-28 lg:self-start"
          />
          <Markdown
            text={block.body}
            ctx={ctx.text}
            variant="prose"
            headingBase={headingBase}
            className="max-w-[44rem]"
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
      <div className={wide ? "max-w-4xl" : "max-w-[42rem]"}>
        <BlockHeading block={block} ctx={ctx} id={titleId} />
        <Markdown
          text={block.body}
          ctx={ctx.text}
          variant="prose"
          headingBase={headingBase}
          className={cn(bodySpacing)}
        />
      </div>
    </BlockSection>
  );
}

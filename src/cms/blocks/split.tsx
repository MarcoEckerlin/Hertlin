import { Eyebrow } from "@/components/site/sections/layout";
import { CheckList } from "@/components/site/sections/check-list";
import { cn } from "@/lib/cn";
import { InlineMarkdown, Markdown } from "@/cms/markdown";
import {
  BlockHeading,
  BlockSection,
  CtaButton,
  hasHeading,
  hasText,
  headingId,
  plain,
  type BlockProps,
} from "@/cms/blocks/shared";

/** Zwei (oder drei) gleichwertige Wege nebeneinander, z. B. Unternehmen und Privatkunden. */
export function SplitBlock({ block, ctx, layout }: BlockProps<"split">) {
  const titleId = headingId(block, layout);
  const withHeading = hasHeading(block);
  const PanelTag = hasText(block.title) ? "h3" : "h2";
  const count = block.panels.length;

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      <div
        className={cn(
          "grid gap-5",
          count === 2 && "lg:grid-cols-2",
          count === 3 && "md:grid-cols-2 xl:grid-cols-3",
          count === 1 && "max-w-3xl",
          withHeading && "mt-12",
        )}
      >
        {block.panels.map((panel, i) => {
          const panelId = `${layout.domId}-bereich-${i}`;
          return (
            <article
              key={i}
              aria-labelledby={panelId}
              className={cn(
                "flex flex-col rounded-3xl p-7 sm:p-10",
                layout.bg === "blue" ? "border border-line bg-white shadow-card" : "bg-brand-50",
              )}
            >
              {hasText(panel.eyebrow) ? <Eyebrow>{plain(panel.eyebrow, ctx)}</Eyebrow> : null}
              <PanelTag
                id={panelId}
                className={cn("text-2xl font-bold tracking-tight text-ink", hasText(panel.eyebrow) && "mt-3")}
              >
                {plain(panel.title, ctx)}
              </PanelTag>
              <Markdown
                text={panel.text}
                ctx={ctx.text}
                variant="compact"
                listStyle="check"
                headingBase={PanelTag === "h3" ? 4 : 3}
                className="mt-3 max-w-prose"
              />
              {panel.points.length > 0 ? (
                <CheckList
                  className="mt-6"
                  items={panel.points.map((point, j) => <InlineMarkdown key={j} text={point} ctx={ctx.text} />)}
                />
              ) : null}
              {panel.link ? (
                <div className="mt-auto pt-8">
                  <CtaButton cta={panel.link} ctx={ctx} variant="primary" arrow />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </BlockSection>
  );
}

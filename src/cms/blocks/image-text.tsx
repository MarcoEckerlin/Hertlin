import Image from "next/image";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { mediaUrl } from "@/cms/media";
import { BlockHeading, BlockSection, CtaButton, hasText, headingId, plain, type BlockProps } from "@/cms/blocks/shared";

/** Bild aus der Mediathek neben einem Text. Auf dem Handy steht das Bild über dem Text. */
export function ImageTextBlock({ block, ctx, layout }: BlockProps<"imageText">) {
  const titleId = headingId(block, layout);
  const imageId = hasText(block.imageId) ? block.imageId : null;

  const text = (
    <div>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      <Markdown
        text={block.body}
        ctx={ctx.text}
        variant="prose"
        headingBase={hasText(block.title) ? 3 : 2}
        className={cn("max-w-2xl", (hasText(block.title) || hasText(block.intro)) && "mt-6")}
      />
      {block.link ? (
        <div className="mt-8">
          <CtaButton cta={block.link} ctx={ctx} variant="secondary" arrow />
        </div>
      ) : null}
    </div>
  );

  if (!imageId) {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <div className="max-w-3xl">{text}</div>
      </BlockSection>
    );
  }

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div
          className={cn(
            "relative aspect-[4/3] overflow-hidden rounded-3xl bg-brand-100 shadow-card",
            block.imagePosition === "right" && "lg:order-last",
          )}
        >
          <Image
            src={mediaUrl(encodeURIComponent(imageId))}
            alt={plain(block.imageAlt, ctx)}
            fill
            unoptimized
            sizes="(min-width: 1024px) 40rem, 100vw"
            className="object-cover"
          />
        </div>
        {text}
      </div>
    </BlockSection>
  );
}

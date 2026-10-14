import Image from "next/image";
import { Container, Eyebrow } from "@/components/site/sections/layout";
import { PortalMockup } from "@/components/site/sections/portal-mockup";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { mediaUrl } from "@/cms/media";
import { CtaButton, hasText, plain, toneBg, type BlockProps } from "@/cms/blocks/shared";

/**
 * Kopfbereich.
 * - visual "portal": großer Einstieg wie auf der Startseite, rechts die gezeichnete Portal-Ansicht
 * - visual "image":  Seitenkopf mit Bild aus der Mediathek
 * - visual "none":   schlichter Seitenkopf (Unterseiten, Rechtstexte)
 */
export function HeroBlock({ block, ctx, layout }: BlockProps<"hero">) {
  const Tag = layout.primaryHeading ? "h1" : "h2";
  const titleId = `${layout.domId}-titel`;
  const hasButtons = !!(block.primary || block.secondary);

  const buttons = hasButtons ? (
    <div className="mt-8 flex flex-wrap gap-3">
      <CtaButton cta={block.primary} ctx={ctx} size="lg" />
      <CtaButton cta={block.secondary} ctx={ctx} variant="secondary" size="lg" />
    </div>
  ) : null;

  if (block.visual === "portal") {
    const boxed = block.tone === "blue";
    return (
      <section
        id={block.anchor}
        aria-labelledby={titleId}
        className={cn("scroll-mt-24 bg-white", boxed && "px-2 pt-2 sm:px-4 sm:pt-4")}
      >
        <div className={cn("mx-auto max-w-[90rem] overflow-hidden", boxed && "rounded-3xl bg-brand-100")}>
          <Container className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:py-24">
            <div className="max-w-2xl">
              {hasText(block.eyebrow) ? <Eyebrow>{plain(block.eyebrow, ctx)}</Eyebrow> : null}
              <Tag
                id={titleId}
                className={cn(
                  "text-[2.125rem] leading-tight font-bold tracking-tight break-words text-ink hyphens-auto sm:text-5xl sm:hyphens-manual lg:text-[3.5rem] lg:leading-[1.08]",
                  hasText(block.eyebrow) && "mt-5",
                )}
              >
                {plain(block.title, ctx)}
              </Tag>
              <Markdown
                text={block.text}
                ctx={ctx.text}
                variant="lead"
                headingBase={layout.primaryHeading ? 2 : 3}
                className="mt-6 max-w-xl sm:[&>p:first-child]:text-xl sm:[&>p:first-child]:leading-relaxed"
              />
              {buttons ? <div className="mt-1">{buttons}</div> : null}
            </div>
            <PortalMockup host={ctx.portalExample} companyName={ctx.settings.name} className="lg:mb-6" />
          </Container>
        </div>
      </section>
    );
  }

  const imageId = block.visual === "image" && hasText(block.imageId) ? block.imageId : null;
  const compact = !imageId && !hasText(block.text) && !hasButtons;

  return (
    <section id={block.anchor} aria-labelledby={titleId} className={cn("scroll-mt-24", toneBg(block.tone))}>
      <Container
        className={cn(
          "grid grid-cols-1 gap-10",
          compact ? "pt-12 sm:pt-16" : "pt-14 sm:pt-16 lg:pt-24",
          layout.joinBottom ? "pb-8 lg:pb-10" : compact ? "pb-12 sm:pb-16" : "pb-14 sm:pb-16 lg:pb-24",
          imageId && "lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)] lg:items-center lg:gap-16",
        )}
      >
        <div className={imageId ? "max-w-2xl" : "max-w-4xl"}>
          {hasText(block.eyebrow) ? <Eyebrow>{plain(block.eyebrow, ctx)}</Eyebrow> : null}
          <Tag
            id={titleId}
            className={cn(
              "leading-[1.12] font-bold tracking-tight break-words text-ink hyphens-auto sm:text-5xl sm:hyphens-manual lg:text-[3.25rem]",
              compact ? "text-3xl" : "text-[2rem]",
              hasText(block.eyebrow) && "mt-5",
            )}
          >
            {plain(block.title, ctx)}
          </Tag>
          <Markdown
            text={block.text}
            ctx={ctx.text}
            variant="lead"
            headingBase={layout.primaryHeading ? 2 : 3}
            className="mt-6 max-w-[38rem]"
          />
          {buttons}
        </div>
        {imageId ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-brand-100 shadow-card">
            <Image
              src={mediaUrl(encodeURIComponent(imageId))}
              alt={plain(block.imageAlt, ctx)}
              fill
              unoptimized
              priority={layout.primaryHeading}
              sizes="(min-width: 1024px) 32rem, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </Container>
    </section>
  );
}

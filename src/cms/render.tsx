import { Fragment, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { portalHost } from "@/lib/hosts";
import type { SiteSettings } from "@/lib/settings";
import type { Block } from "@/cms/schema";
import { Container } from "@/components/site/sections/layout";
import { AnchorNav } from "@/components/site/sections/anchor-nav";
import { buildPlaceholderContext, replacePlaceholders } from "@/cms/placeholders";
import type { BlockContext, BlockLayout } from "@/cms/blocks/shared";
import { anchorNavItems } from "@/cms/blocks/anchors";
import { planBlocks } from "@/cms/blocks/layout";
import { HeroBlock } from "@/cms/blocks/hero";
import { TextBlock } from "@/cms/blocks/text";
import { CardsBlock } from "@/cms/blocks/cards";
import { StepsBlock } from "@/cms/blocks/steps";
import { SplitBlock } from "@/cms/blocks/split";
import { ChecklistBlock } from "@/cms/blocks/checklist";
import { FaqBlock } from "@/cms/blocks/faq";
import { ResponseTimesBlock } from "@/cms/blocks/response-times";
import { ImageTextBlock } from "@/cms/blocks/image-text";
import { CtaBlock } from "@/cms/blocks/cta";
import { ContactBlock } from "@/cms/blocks/contact";
import { LocationsBlock } from "@/cms/blocks/locations";
import { InquiryFormBlock } from "@/cms/blocks/inquiry-form";
import { PrivateSupportFormBlock } from "@/cms/blocks/private-support-form";
import { CompanyInfoBlock } from "@/cms/blocks/company-info";

/**
 * Darstellung der Website-Module (Content-Management).
 * Eine Komponente pro Modultyp in src/cms/blocks/, Anordnung und Übergänge in src/cms/blocks/layout.ts.
 */

export type SearchParams = Record<string, string | string[] | undefined>;

export function buildBlockContext(
  settings: SiteSettings,
  opts: { searchParams?: SearchParams; preview?: boolean } = {},
): BlockContext {
  const portalExample = portalHost("ihrefirma");
  return {
    settings,
    text: buildPlaceholderContext(settings, { portalExample }),
    searchParams: opts.searchParams ?? {},
    preview: opts.preview ?? false,
    portalExample,
  };
}

function renderBlock(block: Block, ctx: BlockContext, layout: BlockLayout): ReactNode {
  switch (block.type) {
    case "hero":
      return <HeroBlock block={block} ctx={ctx} layout={layout} />;
    case "text":
      return <TextBlock block={block} ctx={ctx} layout={layout} />;
    case "cards":
      return <CardsBlock block={block} ctx={ctx} layout={layout} />;
    case "steps":
      return <StepsBlock block={block} ctx={ctx} layout={layout} />;
    case "split":
      return <SplitBlock block={block} ctx={ctx} layout={layout} />;
    case "checklist":
      return <ChecklistBlock block={block} ctx={ctx} layout={layout} />;
    case "faq":
      return <FaqBlock block={block} ctx={ctx} layout={layout} />;
    case "responseTimes":
      return <ResponseTimesBlock block={block} ctx={ctx} layout={layout} />;
    case "imageText":
      return <ImageTextBlock block={block} ctx={ctx} layout={layout} />;
    case "cta":
      return <CtaBlock block={block} ctx={ctx} layout={layout} />;
    case "contact":
      return <ContactBlock block={block} ctx={ctx} layout={layout} />;
    case "locations":
      return <LocationsBlock block={block} ctx={ctx} layout={layout} />;
    case "inquiryForm":
      return <InquiryFormBlock block={block} ctx={ctx} layout={layout} />;
    case "privateSupportForm":
      return <PrivateSupportFormBlock block={block} ctx={ctx} layout={layout} />;
    case "companyInfo":
      return <CompanyInfoBlock block={block} ctx={ctx} layout={layout} />;
  }
}

/** Ausgeblendetes Modul in der Vorschau: blass, nicht bedienbar, mit Hinweis. */
function HiddenInPreview({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none opacity-40 select-none" inert>
        {children}
      </div>
      <p
        data-no-translate
        className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-on-ink shadow-card sm:left-6"
      >
        <EyeOff className="size-3.5" aria-hidden />
        ausgeblendet
      </p>
    </div>
  );
}

/**
 * Stellt die Module einer Seite dar.
 * Auf der Website sind ausgeblendete Module bereits entfernt; in der Vorschau (ctx.preview) werden sie
 * halbtransparent mit dem Hinweis „ausgeblendet“ gezeigt.
 * afterHero: erscheint direkt nach dem ersten sichtbaren Kopfbereich (z. B. die Leiste „Auf dieser Seite“).
 */
export function RenderBlocks({ blocks, ctx, afterHero }: { blocks: Block[]; ctx: BlockContext; afterHero?: ReactNode }) {
  const planned = planBlocks(blocks, ctx.preview);
  const heroIndex = planned.findIndex((p) => !p.hidden && p.block.type === "hero");
  return (
    <>
      {heroIndex < 0 ? afterHero : null}
      {planned.map(({ block, layout, hidden }, i) => {
        const key = `${i}-${block.id}`;
        if (hidden) return <HiddenInPreview key={key}>{renderBlock(block, ctx, layout)}</HiddenInPreview>;
        return (
          <Fragment key={key}>
            {renderBlock(block, ctx, layout)}
            {i === heroIndex ? afterHero : null}
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Inhalt einer Seite. Hat die Seite keinen sichtbaren Kopfbereich, bekommt sie trotzdem eine h1
 * (für Screenreader und Suchmaschinen); ganz ohne sichtbare Module erscheint der Seitentitel.
 */
export function PageBlocks({ title, blocks, ctx }: { title: string; blocks: Block[]; ctx: BlockContext }) {
  const visible = blocks.filter((b) => !b.hidden);
  const heading = replacePlaceholders(title, ctx.text);

  if (visible.length === 0) {
    return (
      <>
        <section className="bg-brand-50">
          <Container className="py-12 sm:py-16">
            <h1 className="text-3xl font-bold tracking-tight break-words text-ink sm:text-5xl">{heading}</h1>
            {ctx.preview ? (
              <p className="mt-4 max-w-xl text-ink-soft">
                Diese Seite hat noch keine sichtbaren Module. Fügen Sie im Editor z. B. einen Kopfbereich und einen Text hinzu.
              </p>
            ) : null}
          </Container>
        </section>
        {ctx.preview ? <RenderBlocks blocks={blocks} ctx={ctx} /> : null}
      </>
    );
  }

  const hasHero = visible.some((b) => b.type === "hero");
  const anchors = anchorNavItems(visible, ctx);
  if (anchors.length === 0) {
    return (
      <>
        {hasHero ? null : <h1 className="sr-only">{heading}</h1>}
        <RenderBlocks blocks={blocks} ctx={ctx} />
      </>
    );
  }
  // Mit der Leiste „Auf dieser Seite“ landen Sprünge etwas tiefer, damit die Überschrift nicht darunter verschwindet
  return (
    <div className="[&_section[id]]:scroll-mt-36">
      {hasHero ? null : <h1 className="sr-only">{heading}</h1>}
      <RenderBlocks blocks={blocks} ctx={ctx} afterHero={<AnchorNav items={anchors} />} />
    </div>
  );
}

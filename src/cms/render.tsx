import { Fragment, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { portalHost } from "@/lib/hosts";
import type { SiteSettings } from "@/lib/settings";
import type { Block } from "@/cms/schema";
import { Container } from "@/components/site/sections/layout";
import { buildPlaceholderContext, replacePlaceholders } from "@/cms/placeholders";
import { hasHeading, type BlockContext, type BlockLayout, type Tone } from "@/cms/blocks/shared";
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
import { InquiryFormBlock } from "@/cms/blocks/inquiry-form";
import { PrivateSupportFormBlock } from "@/cms/blocks/private-support-form";
import { CompanyInfoBlock } from "@/cms/blocks/company-info";

/**
 * Darstellung der Website-Module (Content-Management).
 *
 * Abschnitte mit gleichem Hintergrund gehen ineinander über (kein doppelter Abstand), damit z. B. ein
 * Seitenkopf mit nachfolgendem Kasten oder ein in mehrere Textmodule aufgeteilter Rechtstext wie aus
 * einem Guss wirkt. Handlungsaufforderungen (cta) setzen sich farblich vom vorherigen Abschnitt ab.
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

/** Großer Einstieg mit Portal-Ansicht steht für sich und verbindet sich nicht mit Nachbarn. */
function isolated(block: Block): boolean {
  return block.type === "hero" && block.visual === "portal";
}

function isWideText(block: Block): boolean {
  return block.type === "text" && block.width === "wide" && hasHeading(block);
}

function safeDomId(id: string, index: number): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return `m${index}-${clean || "modul"}`;
}

/** Hintergrund rund um ein Modul. */
function surroundingTone(block: Block, previous: Tone | null): Tone {
  if (block.type === "cta") return previous === "blue" ? "white" : "blue";
  if (block.type === "hero" && block.visual === "portal") return "white";
  return block.tone;
}

/** Berechnet Hintergrund, Übergänge und Überschriftenebene für eine Folge sichtbarer Module. */
export function computeLayouts(blocks: Block[], indexOffset: (i: number) => number = (i) => i): BlockLayout[] {
  const tones: Tone[] = [];
  blocks.forEach((block, i) => tones.push(surroundingTone(block, i > 0 ? tones[i - 1] : null)));
  const firstHero = blocks.findIndex((b) => b.type === "hero");

  return blocks.map((block, i) => {
    const prev = i > 0 ? blocks[i - 1] : null;
    const next = i < blocks.length - 1 ? blocks[i + 1] : null;
    const joinTop = !!prev && !isolated(block) && !isolated(prev) && tones[i - 1] === tones[i];
    const joinBottom = !!next && !isolated(block) && !isolated(next) && tones[i + 1] === tones[i];
    return {
      bg: tones[i],
      joinTop,
      joinBottom,
      separator: joinTop && !!prev && isWideText(block) && isWideText(prev),
      primaryHeading: i === firstHero,
      domId: safeDomId(block.id, indexOffset(i)),
    };
  });
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
    <div className="relative" data-no-translate>
      <div className="pointer-events-none opacity-40 select-none" inert>
        {children}
      </div>
      <p className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white shadow-card sm:left-6">
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
 */
export function RenderBlocks({ blocks, ctx }: { blocks: Block[]; ctx: BlockContext }) {
  const indexed = blocks.map((block, index) => ({ block, index }));
  const visible = indexed.filter((x) => !x.block.hidden);
  const layouts = computeLayouts(
    visible.map((x) => x.block),
    (i) => visible[i].index,
  );
  const layoutByIndex = new Map(visible.map((x, i) => [x.index, layouts[i]]));

  return (
    <>
      {indexed.map(({ block, index }) => {
        const layout = layoutByIndex.get(index);
        if (layout) return <Fragment key={`${index}-${block.id}`}>{renderBlock(block, ctx, layout)}</Fragment>;
        if (!ctx.preview) return null;
        // Ausgeblendetes Modul: für sich allein darstellen
        const [own] = computeLayouts([block], () => index);
        return (
          <HiddenInPreview key={`${index}-${block.id}`}>
            {renderBlock(block, ctx, { ...own, primaryHeading: false })}
          </HiddenInPreview>
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
  return (
    <>
      {hasHero ? null : <h1 className="sr-only">{heading}</h1>}
      <RenderBlocks blocks={blocks} ctx={ctx} />
    </>
  );
}

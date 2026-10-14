import { InquiryForm } from "@/components/forms/inquiry-form";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { ContactLines } from "@/cms/blocks/contact";
import { inquiryDefaults, splitIntro } from "@/cms/blocks/inquiry-defaults";
import { BlockHeading, BlockSection, hasHeading, hasText, headingId, type BlockProps } from "@/cms/blocks/shared";

/**
 * Anfrageformular für Neukunden (Paket B).
 * Überschrift und kurze Hinweise oben, das Formular gleich daneben (Desktop) bzw. direkt darunter (Handy).
 * Weitere Hinweise und Telefon/E-Mail aus den Firmendaten stehen links neben dem Formular bzw. darunter.
 */
export function InquiryFormBlock({ block, ctx, layout }: BlockProps<"inquiryForm">) {
  const titleId = headingId(block, layout);
  const { defaultType, defaultTopic } = inquiryDefaults(ctx, block.defaultType);
  const form = (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-8">
      {/* key: Vorauswahl ändert sich, wenn die Seite mit anderem ?typ= aufgerufen wird */}
      <InquiryForm
        key={`${defaultType}-${defaultTopic ?? ""}`}
        defaultType={defaultType}
        defaultTopic={defaultTopic}
        contact={{ phone: ctx.settings.phone, phoneHref: ctx.settings.phoneHref }}
      />
    </div>
  );

  if (!hasHeading(block)) {
    return (
      <BlockSection block={block} layout={layout}>
        <div className="max-w-3xl">{form}</div>
      </BlockSection>
    );
  }

  const { lead, rest } = splitIntro(block.intro);
  const withTitle = hasText(block.title) || hasText(block.eyebrow);

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr] lg:gap-y-10">
        <div className="lg:col-start-1 lg:row-start-1">
          <BlockHeading block={{ ...block, intro: undefined }} ctx={ctx} id={titleId} />
          <Markdown
            text={lead}
            ctx={ctx.text}
            variant="compact"
            headingBase={3}
            className={withTitle ? "mt-4 max-w-md" : "max-w-md"}
          />
        </div>
        <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">{form}</div>
        <div className="space-y-6 lg:sticky lg:top-28 lg:col-start-1 lg:row-start-2 lg:self-start">
          <Markdown text={rest} ctx={ctx.text} variant="compact" headingBase={3} className="max-w-md" />
          <ContactLines
            settings={ctx.settings}
            className={cn("max-w-md border-t pt-5", layout.bg === "blue" ? "border-line-strong" : "border-line")}
          />
        </div>
      </div>
    </BlockSection>
  );
}

import { InquiryForm } from "@/components/forms/inquiry-form";
import { Markdown } from "@/cms/markdown";
import { inquiryDefaults } from "@/cms/blocks/inquiry-defaults";
import { BlockHeading, BlockSection, hasHeading, headingId, type BlockProps } from "@/cms/blocks/shared";

/** Anfrageformular für Neukunden (Paket B). Text links, Formular rechts. */
export function InquiryFormBlock({ block, ctx, layout }: BlockProps<"inquiryForm">) {
  const titleId = headingId(block, layout);
  const { defaultType, defaultTopic } = inquiryDefaults(ctx, block.defaultType);
  const form = (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-8">
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

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <BlockHeading block={{ ...block, intro: undefined }} ctx={ctx} id={titleId} />
          <Markdown
            text={block.intro}
            ctx={ctx.text}
            variant="compact"
            listStyle="check"
            headingBase={3}
            className="mt-4 max-w-md"
          />
        </div>
        <div className="min-w-0">{form}</div>
      </div>
    </BlockSection>
  );
}

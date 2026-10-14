import { InquiryForm } from "@/components/forms/inquiry-form";
import { isInquiryTopic } from "@/components/forms/form-options";
import type { CustomerType } from "@/lib/constants";
import { Markdown } from "@/cms/markdown";
import {
  BlockHeading,
  BlockSection,
  firstParam,
  hasHeading,
  headingId,
  type BlockContext,
  type BlockProps,
} from "@/cms/blocks/shared";

/** ?typ=privat | ?typ=unternehmen (auch „firma“) */
function customerTypeFromQuery(value: string | undefined): CustomerType | undefined {
  const v = value?.trim().toLowerCase();
  if (v === "privat" || v === "private") return "PRIVATE";
  if (v === "unternehmen" || v === "firma" || v === "business") return "BUSINESS";
  return undefined;
}

/** Vorauswahl aus der Adresse (?typ=, ?thema=), sonst aus dem Modul. */
export function inquiryDefaults(ctx: BlockContext, fallback: CustomerType) {
  const thema = firstParam(ctx.searchParams.thema)?.trim().toUpperCase();
  const defaultTopic = isInquiryTopic(thema) ? thema : undefined;
  // „Hilfe für zu Hause“ gibt es nur für Privatpersonen – dann den Kundentyp gleich passend setzen.
  const defaultType =
    customerTypeFromQuery(firstParam(ctx.searchParams.typ)) ?? (defaultTopic === "PRIVAT_HILFE" ? "PRIVATE" : fallback);
  return { defaultType, defaultTopic };
}

/** Anfrageformular für Neukunden (Paket B). Text links, Formular rechts. */
export function InquiryFormBlock({ block, ctx, layout }: BlockProps<"inquiryForm">) {
  const titleId = headingId(block, layout);
  const { defaultType, defaultTopic } = inquiryDefaults(ctx, block.defaultType);
  const form = (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-card sm:p-8">
      {/* key: Vorauswahl ändert sich, wenn die Seite mit anderem ?typ= aufgerufen wird */}
      <InquiryForm key={`${defaultType}-${defaultTopic ?? ""}`} defaultType={defaultType} defaultTopic={defaultTopic} />
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

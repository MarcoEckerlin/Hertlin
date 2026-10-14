import { OpeningHours } from "@/components/site/sections/contact";
import { ResponseTimesTable } from "@/components/site/sections/response-times";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, headingId, type BlockProps } from "@/cms/blocks/shared";

/** Reaktionszeiten und Servicezeiten aus den Firmendaten. */
export function ResponseTimesBlock({ block, ctx, layout }: BlockProps<"responseTimes">) {
  const titleId = headingId(block, layout);
  const { responseTimes, openingHours } = ctx.settings;

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-16">
        <div>
          <BlockHeading block={block} ctx={ctx} id={titleId} />
          <Markdown text={block.note} ctx={ctx.text} variant="compact" className="mt-6 max-w-xl" />
          {openingHours.length > 0 ? (
            <div
              className={cn(
                "mt-8 max-w-sm rounded-2xl p-5",
                layout.bg === "blue" ? "bg-white shadow-card" : "bg-brand-50",
              )}
            >
              <p className="text-sm font-semibold text-ink">Servicezeiten</p>
              <OpeningHours hours={openingHours} className="mt-2" />
            </div>
          ) : null}
        </div>
        <ResponseTimesTable items={responseTimes} className="lg:self-start" />
      </div>
    </BlockSection>
  );
}

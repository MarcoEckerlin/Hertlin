import { OpeningHours } from "@/components/site/sections/contact";
import { ResponseTimesTable } from "@/components/site/sections/response-times";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, headingId, type BlockProps } from "@/cms/blocks/shared";

/**
 * Reaktionszeiten und Servicezeiten aus den Firmendaten.
 * Überschrift oben, darunter die Übersicht – Hinweise und Servicezeiten stehen klein daneben.
 */
export function ResponseTimesBlock({ block, ctx, layout }: BlockProps<"responseTimes">) {
  const titleId = headingId(block, layout);
  const { responseTimes, openingHours } = ctx.settings;
  const onBlue = layout.bg === "blue";

  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <BlockHeading block={block} ctx={ctx} id={titleId} />
      <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] lg:gap-16">
        <ResponseTimesTable items={responseTimes} onBlue={onBlue} className="lg:self-start" />
        <div className="space-y-8">
          <Markdown text={block.note} ctx={ctx.text} variant="compact" className="max-w-xl" />
          {openingHours.length > 0 ? (
            <div className={cn("max-w-sm border-t pt-4", onBlue ? "border-line-strong" : "border-line")}>
              <p className="text-sm font-semibold text-ink">Servicezeiten</p>
              <OpeningHours hours={openingHours} className="mt-2" />
            </div>
          ) : null}
        </div>
      </div>
    </BlockSection>
  );
}

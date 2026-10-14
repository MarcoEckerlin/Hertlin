import { PrivateSupportForm } from "@/components/forms/private-support-form";
import { OpeningHours } from "@/components/site/sections/contact";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { BlockHeading, BlockSection, hasHeading, headingId, type BlockProps } from "@/cms/blocks/shared";

/** Standard-Sprunganker, auf den viele Links zeigen (/privatkunden#hilfe-anfordern). */
export const PRIVATE_SUPPORT_ANCHOR = "hilfe-anfordern";

/** Hilfe-Formular für Privatkunden (Paket B): Text und Servicezeiten links, Formular rechts. */
export function PrivateSupportFormBlock({ block, ctx, layout }: BlockProps<"privateSupportForm">) {
  const titleId = headingId(block, layout);
  const anchored = { ...block, anchor: block.anchor ?? PRIVATE_SUPPORT_ANCHOR };
  const { openingHours } = ctx.settings;
  const form = (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-lift sm:p-8">
      <PrivateSupportForm />
    </div>
  );

  if (!hasHeading(block)) {
    return (
      <BlockSection block={anchored} layout={layout}>
        <div className="max-w-3xl">{form}</div>
      </BlockSection>
    );
  }

  return (
    <BlockSection block={anchored} layout={layout} labelledBy={titleId}>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
        <div>
          <BlockHeading block={{ ...block, intro: undefined }} ctx={ctx} id={titleId} />
          <Markdown
            text={block.intro}
            ctx={ctx.text}
            variant="compact"
            listStyle="check"
            headingBase={3}
            className="mt-4 max-w-md"
          />
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
        <div className="min-w-0">{form}</div>
      </div>
    </BlockSection>
  );
}

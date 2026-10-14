import { OpeningHours, PhoneLink } from "@/components/site/sections/contact";
import { Container } from "@/components/site/sections/layout";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { CtaButton, hasText, plain, sectionPadding, toneBg, type BlockProps } from "@/cms/blocks/shared";

/**
 * Auffälliger Abschluss: Kasten in Hellblau (brand-400) oder Dunkelblau mit Buttons und
 * – wenn gewünscht – Telefonnummer und Servicezeiten aus den Firmendaten.
 * Der Hintergrund rund um den Kasten wechselt automatisch zum vorherigen Abschnitt (siehe render.tsx).
 */
export function CtaBlock({ block, ctx, layout }: BlockProps<"cta">) {
  const titleId = `${layout.domId}-titel`;
  const dark = block.tone === "dark";
  const { phone, phoneHref, openingHours } = ctx.settings;
  const showPhone = block.showPhone && hasText(phone);
  const hasButtons = !!(block.primary || block.secondary);

  return (
    <section
      id={block.anchor}
      aria-labelledby={titleId}
      className={cn("scroll-mt-24", toneBg(layout.bg), sectionPadding(layout))}
    >
      <Container>
        <div
          className={cn(
            "grid gap-10 rounded-3xl px-6 py-10 sm:px-10 sm:py-14 lg:gap-14 lg:px-14",
            dark ? "bg-ink" : "bg-brand-400",
            showPhone && "lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center",
          )}
        >
          <div className="max-w-2xl">
            <h2
              id={titleId}
              className={cn(
                "text-3xl font-bold tracking-tight break-words hyphens-auto sm:text-4xl sm:hyphens-manual",
                dark ? "text-white" : "text-ink",
              )}
            >
              {plain(block.title, ctx)}
            </h2>
            <Markdown
              text={block.text}
              ctx={ctx.text}
              variant="lead"
              colors={dark ? "onDark" : "onBrand"}
              listStyle="check"
              headingBase={3}
              className="mt-4 max-w-xl"
            />
            {hasButtons ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <CtaButton cta={block.primary} ctx={ctx} variant={dark ? "primary" : "dark"} size="lg" />
                <CtaButton cta={block.secondary} ctx={ctx} variant="secondary" size="lg" />
              </div>
            ) : null}
          </div>
          {showPhone ? (
            <div className="rounded-2xl bg-white p-6 sm:p-7">
              <p className="text-sm font-semibold text-ink-muted">Telefon</p>
              <PhoneLink
                phone={phone}
                phoneHref={phoneHref}
                className="mt-1 block text-2xl font-bold tracking-tight break-words text-ink"
              />
              {openingHours.length > 0 ? (
                <>
                  <p className="mt-6 text-sm font-semibold text-ink-muted">Servicezeiten</p>
                  <OpeningHours hours={openingHours} className="mt-2" />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

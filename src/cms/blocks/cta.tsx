import { PhoneLink } from "@/components/site/sections/contact";
import { Container } from "@/components/site/sections/layout";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { CtaButton, hasText, plain, sectionPadding, toneBg, type BlockProps } from "@/cms/blocks/shared";

/**
 * Abschluss einer Seite: Fläche in Hellblau (primary) oder Dunkelblau (navy) mit Buttons und – wenn gewünscht –
 * Telefonnummer und Servicezeiten aus den Firmendaten. Die Telefonangaben stehen ohne eigenen Kasten
 * rechts neben einer feinen Linie.
 * Die Fläche sieht in Hell und Dunkel gleich aus: Die hellblaue ist eine „helle Insel“ (data-theme="light"),
 * die dunkelblaue eine dunkle – Text und Buttons darin nehmen die passenden Farben.
 * Der Hintergrund rund um die Fläche wechselt automatisch zum vorherigen Abschnitt (siehe layout.ts).
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
      // Unten immer voller Abstand: Ein direkt folgender Abschnitt soll nicht am Kasten kleben
      className={cn("scroll-mt-24", toneBg(layout.bg), sectionPadding({ joinTop: layout.joinTop, joinBottom: false }))}
    >
      <Container>
        <div
          data-theme={dark ? "dark" : "light"}
          className={cn(
            "grid gap-10 rounded-3xl px-6 py-10 sm:px-10 sm:py-12 lg:gap-16 lg:px-14 lg:py-14",
            dark ? "bg-navy" : "bg-primary",
            showPhone && "lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-center",
          )}
        >
          <div className="max-w-2xl">
            <h2
              id={titleId}
              className={cn(
                "text-[1.75rem] leading-[1.18] font-bold tracking-tight break-words hyphens-auto sm:text-[2.125rem] sm:hyphens-manual",
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
            <div
              className={cn(
                "border-t pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10",
                dark ? "border-white/20 text-white" : "border-ink/20 text-ink",
              )}
            >
              <p className={cn("text-sm font-semibold", dark ? "text-white/75" : "text-ink/75")}>Telefon</p>
              <PhoneLink
                phone={phone}
                phoneHref={phoneHref}
                className="mt-1 block text-2xl font-bold tracking-tight break-words"
              />
              {openingHours.length > 0 ? (
                <>
                  <p className={cn("mt-6 text-sm font-semibold", dark ? "text-white/75" : "text-ink/75")}>Servicezeiten</p>
                  <dl className="mt-2 space-y-1.5 text-[0.9375rem]">
                    {openingHours.map((o, i) => (
                      <div key={`${o.days}-${i}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4">
                        <dt className={dark ? "text-white/80" : "text-ink/80"}>{o.days}</dt>
                        <dd className="text-right font-semibold whitespace-nowrap">{o.hours}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

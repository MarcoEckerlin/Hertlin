import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/site/sections/layout";
import { cn } from "@/lib/cn";
import type { SiteSettings } from "@/lib/settings";
import { Markdown, type MarkdownColors } from "@/cms/markdown";
import { replacePlaceholders, resolveHref, type PlaceholderContext } from "@/cms/placeholders";
import type { BlockOf, BlockType } from "@/cms/schema";

/** Hintergrund eines Abschnitts: weiß oder hellblau (brand-50) */
export type Tone = "white" | "blue";

/** Alles, was ein Modul zum Darstellen braucht (pro Anfrage einmal erzeugt). */
export type BlockContext = {
  settings: SiteSettings;
  text: PlaceholderContext;
  /** Suchparameter der Seite, z. B. ?typ=privat für das Anfrageformular */
  searchParams: Record<string, string | string[] | undefined>;
  /** Vorschau in der Verwaltung */
  preview: boolean;
  /** Beispieladresse eines Kundenportals, z. B. "ihrefirma.hertlin.de" */
  portalExample: string;
};

/** Lage des Moduls auf der Seite (berechnet in render.tsx). */
export type BlockLayout = {
  /** Hintergrund rund um das Modul */
  bg: Tone;
  /** Vorheriges Modul hat denselben Hintergrund: kein Abstand oben, Abschnitte gehen ineinander über */
  joinTop: boolean;
  /** Nächstes Modul hat denselben Hintergrund: kleinerer Abstand unten */
  joinBottom: boolean;
  /** Trennlinie zum vorherigen Modul (bei mehreren gleichartigen Abschnitten untereinander) */
  separator: boolean;
  /** Dieses Modul trägt die Hauptüberschrift der Seite (h1) */
  primaryHeading: boolean;
  /** Eindeutiger, sicherer Präfix für DOM-ids */
  domId: string;
};

export type BlockProps<T extends BlockType> = { block: BlockOf<T>; ctx: BlockContext; layout: BlockLayout };

/** Platzhalter in einfachem Text ersetzen (Überschriften, Beschriftungen). */
export function plain(text: string | null | undefined, ctx: BlockContext): string {
  return replacePlaceholders(text, ctx.text);
}

export function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type Heading = { eyebrow?: string; title?: string; intro?: string };

export function hasHeading(block: Heading): boolean {
  return hasText(block.eyebrow) || hasText(block.title) || hasText(block.intro);
}

export function sectionPadding(layout: Pick<BlockLayout, "joinTop" | "joinBottom">): string {
  return cn(layout.joinTop ? "pt-0" : "pt-16 lg:pt-24", layout.joinBottom ? "pb-10 lg:pb-14" : "pb-16 lg:pb-24");
}

export function toneBg(tone: Tone): string {
  return tone === "blue" ? "bg-brand-50" : "bg-white";
}

/** Fläche für Kästen innerhalb eines Abschnitts: auf Weiß hellblau, auf Hellblau weiß mit Rahmen. */
export function panelClasses(bg: Tone): string {
  return bg === "blue" ? "border border-line bg-white shadow-card" : "bg-brand-50";
}

/** Abschnitt eines Moduls mit Hintergrund, Abständen, Sprunganker und Seitenbreite. */
export function BlockSection({
  block,
  layout,
  labelledBy,
  className,
  containerClassName,
  children,
}: {
  block: { anchor?: string };
  layout: BlockLayout;
  labelledBy?: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={block.anchor}
      aria-labelledby={labelledBy}
      className={cn("scroll-mt-24", toneBg(layout.bg), sectionPadding(layout), className)}
    >
      <Container className={containerClassName}>
        {layout.separator ? <div aria-hidden="true" className="mb-12 border-t border-line lg:mb-16" /> : null}
        {children}
      </Container>
    </section>
  );
}

/** Überschrift eines Abschnitts mit optionaler Dachzeile und Einleitung (Markdown). */
export function BlockHeading({
  block,
  ctx,
  id,
  as = "h2",
  className,
  titleClassName,
  colors = "default",
}: {
  block: Heading;
  ctx: BlockContext;
  id?: string;
  as?: "h1" | "h2" | "h3";
  className?: string;
  titleClassName?: string;
  colors?: MarkdownColors;
}) {
  if (!hasHeading(block)) return null;
  const Tag = as;
  const hasTitle = hasText(block.title);
  return (
    <div className={cn("max-w-2xl", className)}>
      {hasText(block.eyebrow) ? <Eyebrow>{plain(block.eyebrow, ctx)}</Eyebrow> : null}
      {hasTitle ? (
        <Tag
          id={id}
          className={cn(
            "text-3xl font-bold tracking-tight break-words text-ink hyphens-auto sm:text-4xl sm:hyphens-manual",
            hasText(block.eyebrow) && "mt-3",
            titleClassName,
          )}
        >
          {plain(block.title, ctx)}
        </Tag>
      ) : null}
      <Markdown
        text={block.intro}
        ctx={ctx.text}
        variant="lead"
        colors={colors}
        listStyle="check"
        headingBase={hasTitle ? 3 : 2}
        className={cn("max-w-xl", (hasTitle || hasText(block.eyebrow)) && "mt-4")}
      />
    </div>
  );
}

/** id der Überschrift, wenn das Modul eine hat (für aria-labelledby). */
export function headingId(block: { title?: string }, layout: BlockLayout): string | undefined {
  return hasText(block.title) ? `${layout.domId}-titel` : undefined;
}

type Cta = { label: string; href: string };

/** Button aus einem Link-Feld. Ungültige Ziele werden nicht angezeigt. */
export function CtaButton({
  cta,
  ctx,
  variant = "primary",
  size = "md",
  arrow = false,
  className,
}: {
  cta: Cta | undefined;
  ctx: BlockContext;
  variant?: ButtonVariant;
  size?: ButtonSize;
  arrow?: boolean;
  className?: string;
}) {
  if (!cta) return null;
  const target = resolveHref(cta.href, ctx.text);
  const label = plain(cta.label, ctx);
  if (!target || !label) return null;
  const classes = buttonClasses(variant, size, className);

  if (target.external) {
    return (
      <a href={target.href} target="_blank" rel="noopener noreferrer" className={classes}>
        {label}
        <ExternalLink className="size-4" aria-hidden />
        <span className="sr-only"> (öffnet in neuem Fenster)</span>
      </a>
    );
  }
  const icon = arrow ? <ArrowRight className="size-4" aria-hidden /> : null;
  if (target.href.startsWith("/")) {
    return (
      <Link href={target.href} className={classes}>
        {label}
        {icon}
      </Link>
    );
  }
  return (
    <a href={target.href} className={classes}>
      {label}
      {icon}
    </a>
  );
}

/** Schlichter Textlink mit Pfeil (z. B. unter einer Kachel). */
export function TextLink({ cta, ctx, className }: { cta: Cta | undefined; ctx: BlockContext; className?: string }) {
  if (!cta) return null;
  const target = resolveHref(cta.href, ctx.text);
  const label = plain(cta.label, ctx);
  if (!target || !label) return null;
  const classes = cn(
    "inline-flex items-center gap-1.5 text-[0.9375rem] font-semibold text-brand-700 hover:text-brand-800 hover:underline hover:underline-offset-4",
    className,
  );
  if (target.external) {
    return (
      <a href={target.href} target="_blank" rel="noopener noreferrer" className={classes}>
        {label}
        <ExternalLink className="size-4" aria-hidden />
        <span className="sr-only"> (öffnet in neuem Fenster)</span>
      </a>
    );
  }
  if (target.href.startsWith("/")) {
    return (
      <Link href={target.href} className={classes}>
        {label}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    );
  }
  return (
    <a href={target.href} className={classes}>
      {label}
      <ArrowRight className="size-4" aria-hidden />
    </a>
  );
}

/** Erster Wert eines Suchparameters */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

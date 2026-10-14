import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { resolveHref, splitPlaceholders, type PlaceholderContext } from "@/cms/placeholders";

/**
 * Sicherer Mini-Markdown-Renderer für Website-Texte.
 *
 * Unterstützt: Absätze (Leerzeile), "## " und "### " als Zwischenüberschriften, Aufzählungen mit "- "
 * (auch "* "), nummerierte Listen mit "1. ", **fett**, *kursiv*, [Text](Ziel) und Zeilenumbrüche
 * innerhalb eines Absatzes. Mit "\" lässt sich ein Sonderzeichen wörtlich schreiben (z. B. "\*").
 *
 * Es wird nie HTML aus dem Text übernommen: Alles landet als Textknoten in React und wird escaped.
 * Link-Ziele müssen SAFE_HREF entsprechen, sonst erscheint nur der Linktext.
 */

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

export type MdInline =
  | { t: "text"; v: string }
  | { t: "br" }
  | { t: "strong"; c: MdInline[] }
  | { t: "em"; c: MdInline[] }
  | { t: "link"; href: string; c: MdInline[] };

export type MdBlock =
  | { t: "p"; text: string }
  | { t: "h"; level: 2 | 3; text: string }
  | { t: "list"; ordered: boolean; items: string[] };

const HEADING = /^(#{1,3})\s+(.+?)\s*#*$/;
const BULLET = /^[-*•]\s+(.*)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/;

export function parseMarkdownBlocks(source: string): MdBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ t: "p", text: para.join("\n") });
    para = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ t: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      flushPara();
      flushList();
      continue;
    }

    const heading = HEADING.exec(trimmed);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ t: "h", level: heading[1].length === 3 ? 3 : 2, text: heading[2] });
      continue;
    }

    const bullet = BULLET.exec(trimmed);
    const numbered = bullet ? null : NUMBERED.exec(trimmed);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const content = (bullet ?? numbered)![1];
      flushPara();
      const current = list as { ordered: boolean; items: string[] } | null;
      if (current && current.ordered === ordered) {
        current.items.push(content);
      } else {
        flushList();
        list = { ordered, items: [content] };
      }
      continue;
    }

    const current = list as { ordered: boolean; items: string[] } | null;
    if (current && /^\s/.test(line)) {
      // Eingerückte Zeile gehört noch zum letzten Listenpunkt
      current.items[current.items.length - 1] += `\n${trimmed}`;
      continue;
    }
    flushList();
    para.push(trimmed);
  }
  flushPara();
  flushList();
  return blocks;
}

const ESCAPABLE = /[\\*[\]()#_`{}-]/;

/** Index der schließenden Klammer zu "(" an Position open (verschachtelte Klammern werden mitgezählt). */
function matchingParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\n") return -1;
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Nächstes einzelnes "*" (nicht Teil von "**"), das ein kursives Stück schließt. */
function closingStar(s: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] !== "*") continue;
    if (s[i + 1] === "*") {
      i++;
      continue;
    }
    if (s[i - 1] !== " ") return i;
  }
  return -1;
}

export function parseInline(source: string, inLink = false): MdInline[] {
  const out: MdInline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (ch === "\\" && i + 1 < source.length && ESCAPABLE.test(source[i + 1])) {
      buf += source[i + 1];
      i += 2;
      continue;
    }

    if (ch === "\n") {
      flush();
      out.push({ t: "br" });
      i++;
      continue;
    }

    if (ch === "*" && source[i + 1] === "*") {
      const close = source.indexOf("**", i + 2);
      if (close > i + 2 && source[i + 2] !== " ") {
        flush();
        out.push({ t: "strong", c: parseInline(source.slice(i + 2, close), inLink) });
        i = close + 2;
        continue;
      }
    } else if (ch === "*" && source[i + 1] !== " " && source[i + 1] !== undefined) {
      const close = closingStar(source, i + 1);
      if (close > i + 1) {
        flush();
        out.push({ t: "em", c: parseInline(source.slice(i + 1, close), inLink) });
        i = close + 1;
        continue;
      }
    }

    if (ch === "[" && !inLink) {
      const closeLabel = source.indexOf("]", i + 1);
      if (closeLabel > i + 1 && source[closeLabel + 1] === "(") {
        const closeHref = matchingParen(source, closeLabel + 1);
        if (closeHref > closeLabel + 2) {
          flush();
          out.push({
            t: "link",
            href: source.slice(closeLabel + 2, closeHref).trim(),
            c: parseInline(source.slice(i + 1, closeLabel), true),
          });
          i = closeHref + 1;
          continue;
        }
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/* Darstellung                                                         */
/* ------------------------------------------------------------------ */

/**
 * prose   – längere Texte (Rechtstexte, Leistungsbeschreibungen)
 * lead    – Einleitungen unter großen Überschriften
 * compact – Texte in Kacheln, Schritten, Antworten
 */
export type MarkdownVariant = "prose" | "lead" | "compact";
/** Farben je nach Hintergrund: hell (Standard), Hellblau-Fläche (brand-400) oder Dunkelblau */
export type MarkdownColors = "default" | "onBrand" | "onDark";

type RenderOptions = {
  ctx: PlaceholderContext;
  colors: MarkdownColors;
};

const linkClasses: Record<MarkdownColors, string> = {
  default: "font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800 hover:decoration-brand-700",
  onBrand: "font-semibold text-ink underline underline-offset-2 hover:decoration-2",
  onDark: "font-semibold text-white underline underline-offset-2 hover:text-brand-200",
};

const strongClasses: Record<MarkdownColors, string> = {
  default: "font-semibold text-ink",
  onBrand: "font-bold text-ink",
  onDark: "font-semibold text-white",
};

function SafeLink({
  href,
  external,
  className,
  children,
}: {
  href: string;
  external: boolean;
  className: string;
  children: ReactNode;
}) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
        <span className="sr-only"> (öffnet in neuem Fenster)</span>
      </a>
    );
  }
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function renderText(value: string, key: string, inLink: boolean, opts: RenderOptions): ReactNode {
  const parts = splitPlaceholders(value, opts.ctx);
  return parts.map((part, i) =>
    part.href && !inLink ? (
      <a key={`${key}-${i}`} href={part.href} className={cn(linkClasses[opts.colors], "whitespace-nowrap")}>
        {part.text}
      </a>
    ) : (
      <Fragment key={`${key}-${i}`}>{part.text}</Fragment>
    ),
  );
}

function renderInline(nodes: MdInline[], opts: RenderOptions, keyPrefix: string, inLink = false): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}${i}`;
    switch (node.t) {
      case "text":
        return renderText(node.v, key, inLink, opts);
      case "br":
        return <br key={key} />;
      case "strong":
        return (
          <strong key={key} className={strongClasses[opts.colors]}>
            {renderInline(node.c, opts, `${key}.`, inLink)}
          </strong>
        );
      case "em":
        return (
          <em key={key} className="italic">
            {renderInline(node.c, opts, `${key}.`, inLink)}
          </em>
        );
      case "link": {
        const target = resolveHref(node.href, opts.ctx);
        const label = renderInline(node.c, opts, `${key}.`, true);
        if (!target) return <Fragment key={key}>{label}</Fragment>;
        return (
          <SafeLink key={key} href={target.href} external={target.external} className={linkClasses[opts.colors]}>
            {label}
          </SafeLink>
        );
      }
    }
  });
}

/** Einzeiliger Text mit **fett**, *kursiv*, Links und Platzhaltern (z. B. Listenpunkte). */
export function InlineMarkdown({
  text,
  ctx,
  colors = "default",
}: {
  text: string | null | undefined;
  ctx: PlaceholderContext;
  colors?: MarkdownColors;
}) {
  if (!text) return null;
  return <>{renderInline(parseInline(text.replace(/\r\n?/g, "\n")), { ctx, colors }, "i")}</>;
}

const variantStyles: Record<
  MarkdownVariant,
  { root: string; p: string; h2: string; h3: string; list: string; afterHeading: string }
> = {
  prose: {
    root: "text-base leading-[1.75] sm:text-[1.0625rem]",
    p: "mt-4",
    h2: "mt-10 text-xl font-bold tracking-tight sm:text-[1.375rem]",
    h3: "mt-7 text-lg font-bold",
    list: "mt-4",
    afterHeading: "mt-2",
  },
  lead: {
    root: "text-lg leading-relaxed",
    p: "mt-3",
    h2: "mt-7 text-xl font-bold tracking-tight",
    h3: "mt-6 text-base font-bold",
    list: "mt-4",
    afterHeading: "mt-2",
  },
  compact: {
    root: "text-[0.9375rem] leading-relaxed",
    p: "mt-3",
    h2: "mt-6 text-base font-bold",
    h3: "mt-5 text-sm font-bold",
    list: "mt-3",
    afterHeading: "mt-2",
  },
};

const textColor: Record<MarkdownColors, { root: string; heading: string }> = {
  default: { root: "text-ink-soft", heading: "text-ink" },
  onBrand: { root: "text-ink", heading: "text-ink" },
  onDark: { root: "text-white/85", heading: "text-white" },
};

type HeadingTag = "h2" | "h3" | "h4" | "h5" | "h6";

function headingTag(level: 2 | 3, base: 2 | 3 | 4): HeadingTag {
  const n = Math.min(6, base + (level - 2));
  return `h${n}` as HeadingTag;
}

export type MarkdownProps = {
  text: string | null | undefined;
  ctx: PlaceholderContext;
  variant?: MarkdownVariant;
  colors?: MarkdownColors;
  /** "bullet" = Aufzählungspunkte, "check" = Häkchen wie in den Listen der Website */
  listStyle?: "bullet" | "check";
  /** Überschriftenebene für "##" (Standard h2). In Abschnitten mit eigener Überschrift 3 wählen. */
  headingBase?: 2 | 3 | 4;
  className?: string;
};

/** Mehrzeiliger Text mit einfachem Markdown. Gibt nichts aus, wenn der Text leer ist. */
export function Markdown({
  text,
  ctx,
  variant = "prose",
  colors = "default",
  listStyle = "bullet",
  headingBase = 2,
  className,
}: MarkdownProps) {
  if (!text || !text.trim()) return null;
  const blocks = parseMarkdownBlocks(text);
  if (blocks.length === 0) return null;
  const style = variantStyles[variant];
  const color = textColor[colors];
  const opts: RenderOptions = { ctx, colors };

  return (
    <div className={cn(style.root, color.root, className)}>
      {blocks.map((block, index) => {
        const prev = index > 0 ? blocks[index - 1] : null;
        const spacing = index === 0 ? undefined : prev?.t === "h" ? style.afterHeading : undefined;
        const key = `b${index}`;

        if (block.t === "h") {
          const Tag = headingTag(block.level, headingBase);
          const cls = block.level === 2 ? style.h2 : style.h3;
          return (
            <Tag key={key} className={cn(cls, color.heading, index === 0 && "mt-0")}>
              {renderInline(parseInline(block.text), opts, `${key}.`)}
            </Tag>
          );
        }

        if (block.t === "p") {
          return (
            <p key={key} className={index === 0 ? undefined : (spacing ?? style.p)}>
              {renderInline(parseInline(block.text), opts, `${key}.`)}
            </p>
          );
        }

        const listSpacing = index === 0 ? undefined : (spacing ?? style.list);
        if (block.ordered) {
          return (
            <ol key={key} className={cn("space-y-3", listSpacing)}>
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-brand-700 ring-1 ring-brand-200"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">{renderInline(parseInline(item), opts, `${key}.${i}.`)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (listStyle === "check") {
          return (
            <ul key={key} className={cn("space-y-3", listSpacing)}>
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-[0.2em] grid size-5 shrink-0 place-items-center rounded-full",
                      colors === "onDark" ? "bg-white/15 text-white" : "bg-brand-200 text-brand-800",
                    )}
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0">{renderInline(parseInline(item), opts, `${key}.${i}.`)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <ul
            key={key}
            className={cn(
              "list-disc space-y-1.5 pl-5",
              colors === "default" ? "marker:text-brand-500" : "marker:text-current",
              listSpacing,
            )}
          >
            {block.items.map((item, i) => (
              <li key={i} className="pl-1">
                {renderInline(parseInline(item), opts, `${key}.${i}.`)}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

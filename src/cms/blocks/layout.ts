import type { Block } from "@/cms/schema";
import { hasHeading, hasText, type BlockLayout, type Tone } from "@/cms/blocks/shared";

/**
 * Anordnung der Module auf einer Seite.
 *
 * Abschnitte mit gleichem Hintergrund gehen ineinander über (kein doppelter Abstand), damit z. B. ein
 * Seitenkopf mit nachfolgendem Kasten oder ein in mehrere Textmodule aufgeteilter Rechtstext wie aus
 * einem Guss wirkt. Beginnt dabei ein neuer Abschnitt mit eigener Überschrift, trennt ihn eine feine Linie
 * vom vorherigen – ruhiger als ein Farbwechsel oder ein Kasten.
 * Handlungsaufforderungen (cta) setzen sich farblich vom vorherigen Abschnitt ab.
 */

/** Großer Einstieg mit Portal-Ansicht steht für sich und verbindet sich nicht mit Nachbarn. */
function isolated(block: Block): boolean {
  return block.type === "hero" && block.visual === "portal";
}

function isWideText(block: Block): boolean {
  return block.type === "text" && block.width === "wide" && hasHeading(block);
}

/** Hinweis-Text mit eigener Randlinie braucht keine zusätzliche Trennlinie. */
function isNote(block: Block): boolean {
  return block.type === "text" && block.width === "note";
}

/** Trennlinie zwischen zwei Abschnitten mit gleichem Hintergrund? */
function wantsSeparator(block: Block, prev: Block): boolean {
  if (prev.type === "hero" || prev.type === "cta" || block.type === "cta" || block.type === "hero") return false;
  if (isWideText(block) && isWideText(prev)) return true;
  if (isNote(block)) return false;
  return "title" in block && hasText(block.title);
}

function safeDomId(id: string, index: number): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return `m${index}-${clean || "modul"}`;
}

/** Hintergrund rund um ein Modul. */
function surroundingTone(block: Block, previous: Tone | null): Tone {
  if (block.type === "cta") return previous === "blue" ? "white" : "blue";
  if (block.type === "hero" && block.visual === "portal") return "white";
  return block.tone;
}

/** Berechnet Hintergrund, Übergänge und Überschriftenebene für eine Folge sichtbarer Module. */
export function computeLayouts(blocks: Block[], indexOf: (i: number) => number = (i) => i): BlockLayout[] {
  const tones: Tone[] = [];
  blocks.forEach((block, i) => tones.push(surroundingTone(block, i > 0 ? tones[i - 1] : null)));
  const firstHero = blocks.findIndex((b) => b.type === "hero");

  return blocks.map((block, i) => {
    const prev = i > 0 ? blocks[i - 1] : null;
    const next = i < blocks.length - 1 ? blocks[i + 1] : null;
    const joinTop = !!prev && !isolated(block) && !isolated(prev) && tones[i - 1] === tones[i];
    const joinBottom = !!next && !isolated(block) && !isolated(next) && tones[i + 1] === tones[i];
    return {
      bg: tones[i],
      joinTop,
      joinBottom,
      separator: joinTop && !!prev && wantsSeparator(block, prev),
      primaryHeading: i === firstHero,
      domId: safeDomId(block.id, indexOf(i)),
    };
  });
}

export type PlannedBlock = { block: Block; layout: BlockLayout; hidden: boolean };

/**
 * Welche Module in welcher Lage erscheinen.
 * Auf der Website fallen ausgeblendete Module weg. In der Vorschau erscheinen sie an ihrer Stelle,
 * werden aber für die Übergänge der übrigen Module so behandelt, als fehlten sie – so sieht die Seite
 * aus wie nach dem Veröffentlichen.
 */
export function planBlocks(blocks: Block[], preview: boolean): PlannedBlock[] {
  const indexed = blocks.map((block, index) => ({ block, index }));
  const visible = indexed.filter((x) => !x.block.hidden);
  const layouts = computeLayouts(
    visible.map((x) => x.block),
    (i) => visible[i].index,
  );
  const layoutByIndex = new Map(visible.map((x, i) => [x.index, layouts[i]]));

  const out: PlannedBlock[] = [];
  for (const { block, index } of indexed) {
    const layout = layoutByIndex.get(index);
    if (layout) {
      out.push({ block, layout, hidden: false });
    } else if (preview) {
      const [own] = computeLayouts([block], () => index);
      out.push({ block, layout: { ...own, primaryHeading: false }, hidden: true });
    }
  }
  return out;
}

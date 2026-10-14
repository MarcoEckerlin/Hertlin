import type { AnchorNavItem } from "@/components/site/sections/anchor-nav";
import type { Block } from "@/cms/schema";
import { hasText, plain, type BlockContext } from "@/cms/blocks/shared";

/** Ab so vielen Abschnitten mit Sprunganker und Überschrift bekommt eine Seite die Leiste „Auf dieser Seite“. */
export const ANCHOR_NAV_MIN = 4;

/**
 * Sprungmarken einer Seite: sichtbare Abschnitte mit Anker und Überschrift (ohne Kopfbereich und Abschluss).
 * Erst ab ANCHOR_NAV_MIN Abschnitten lohnt sich die Leiste – sonst kommt eine leere Liste zurück.
 */
export function anchorNavItems(blocks: Block[], ctx: BlockContext): AnchorNavItem[] {
  const items: AnchorNavItem[] = [];
  for (const block of blocks) {
    if (block.hidden || !block.anchor || block.type === "hero" || block.type === "cta") continue;
    if (!("title" in block) || !hasText(block.title)) continue;
    items.push({ id: block.anchor, label: plain(block.title, ctx) });
  }
  return items.length >= ANCHOR_NAV_MIN ? items : [];
}

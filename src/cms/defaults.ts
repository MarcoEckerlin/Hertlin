import type { Block } from "@/cms/schema";

/**
 * Standardinhalte der Kernseiten. Werden verwendet, solange eine Seite noch nicht in der
 * Datenbank liegt, und beim ersten Öffnen im Editor als Ausgangspunkt übernommen.
 *
 * VORLÄUFIG: wird mit den endgültigen Texten der Website befüllt.
 */
export type DefaultPage = {
  title: string;
  description?: string;
  navLabel?: string;
  showInNav: boolean;
  showInFooter: boolean;
  navOrder: number;
  blocks: Block[];
};

export const DEFAULT_PAGES: Record<string, DefaultPage> = {
  "": {
    title: "Startseite",
    showInNav: false,
    showInFooter: false,
    navOrder: 0,
    blocks: [{ id: "hero", type: "hero", title: "IT-Service für Unternehmen und Privatkunden", visual: "portal", tone: "blue" }],
  },
  leistungen: { title: "Leistungen", navLabel: "Leistungen", showInNav: true, showInFooter: false, navOrder: 10, blocks: [] },
  unternehmen: { title: "Für Unternehmen", navLabel: "Für Unternehmen", showInNav: true, showInFooter: false, navOrder: 20, blocks: [] },
  privatkunden: { title: "Für Privatkunden", navLabel: "Für Privatkunden", showInNav: true, showInFooter: false, navOrder: 30, blocks: [] },
  "ueber-uns": { title: "Über uns", navLabel: "Über uns", showInNav: true, showInFooter: false, navOrder: 40, blocks: [] },
  kontakt: { title: "Kontakt", navLabel: "Kontakt", showInNav: true, showInFooter: false, navOrder: 50, blocks: [] },
  support: { title: "Support", showInNav: false, showInFooter: true, navOrder: 60, blocks: [] },
  impressum: { title: "Impressum", showInNav: false, showInFooter: true, navOrder: 90, blocks: [] },
  datenschutz: { title: "Datenschutz", showInNav: false, showInFooter: true, navOrder: 91, blocks: [] },
  agb: { title: "AGB", navLabel: "AGB", showInNav: false, showInFooter: true, navOrder: 92, blocks: [] },
};

export function getDefaultPage(slug: string): DefaultPage | null {
  return DEFAULT_PAGES[slug] ?? null;
}

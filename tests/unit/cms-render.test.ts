import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineMarkdown, Markdown, parseInline, parseMarkdownBlocks, type MarkdownProps } from "@/cms/markdown";
import {
  buildPlaceholderContext,
  formatAddress,
  replacePlaceholders,
  resolveHref,
  splitPlaceholders,
  PLACEHOLDER_KEYS,
} from "@/cms/placeholders";
import { DEFAULT_PAGES, DEFAULT_PAGE_SOURCES, getDefaultPage, type DefaultBlockInput } from "@/cms/defaults";
import {
  SAFE_HREF,
  SYSTEM_PAGE_SLUGS,
  blockSchema,
  blocksSchema,
  pageDraftSchema,
  pageMetaSchema,
  parseBlocks,
  type Block,
} from "@/cms/schema";
import { computeLayouts, endsWithRule, planBlocks } from "@/cms/blocks/layout";
import type { BlockContext } from "@/cms/blocks/shared";
import { TextBlock } from "@/cms/blocks/text";
import { StepsBlock } from "@/cms/blocks/steps";
import { CardsBlock } from "@/cms/blocks/cards";
import { CtaBlock } from "@/cms/blocks/cta";
import { ContactLines } from "@/cms/blocks/contact";
import { CompanyInfoBlock } from "@/cms/blocks/company-info";
import { inquiryDefaults, splitIntro } from "@/cms/blocks/inquiry-defaults";
import { ANCHOR_NAV_MIN, anchorNavItems } from "@/cms/blocks/anchors";
import type { SiteSettings } from "@/lib/settings";

/* ------------------------------------------------------------------ */
/* Testdaten                                                           */
/* ------------------------------------------------------------------ */

const SETTINGS: SiteSettings = {
  name: "Hertlin",
  legalName: "Hertlin IT-Service GmbH",
  tagline: "IT-Service für Unternehmen und Privatkunden",
  owner: "Erika Hertlin",
  street: "Hauptstraße 1",
  zip: "70173",
  city: "Stuttgart",
  region: "Raum Stuttgart",
  phone: "0711 123456",
  phoneHref: "+49711123456",
  email: "info@hertlin.de",
  supportEmail: "support@hertlin.de",
  vatId: "DE123456789",
  register: "Amtsgericht Stuttgart, HRB 12345",
  openingHours: [{ days: "Montag bis Freitag", hours: "8:00 – 17:00 Uhr" }],
  responseTimes: [{ priority: "CRITICAL", label: "Kritisch – der Betrieb steht", time: "innerhalb von 1 Stunde" }],
  remoteSupportUrl: "https://get.teamviewer.com/hertlin",
  hostingProvider: "Beispiel Hosting GmbH, Musterweg 2, 10115 Berlin",
  logRetentionDays: 7,
};

const ctx = buildPlaceholderContext(SETTINGS, { portalExample: "ihrefirma.hertlin.de" });

function md(text: string, props: Partial<MarkdownProps> = {}): string {
  return renderToStaticMarkup(createElement(Markdown, { text, ctx, ...props }));
}

function inline(text: string): string {
  return renderToStaticMarkup(createElement(InlineMarkdown, { text, ctx }));
}

const blockCtx: BlockContext = {
  settings: SETTINGS,
  text: ctx,
  searchParams: {},
  preview: false,
  portalExample: "ihrefirma.hertlin.de",
};

function block(input: DefaultBlockInput): Block {
  return blockSchema.parse(input);
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

describe("Markdown: Grundformate", () => {
  it("trennt Absätze an Leerzeilen und setzt Zeilenumbrüche als <br>", () => {
    const html = md("Erster Absatz\nzweite Zeile\n\nZweiter Absatz");
    expect(html.match(/<p[ >]/g)).toHaveLength(2);
    expect(html).toContain("Erster Absatz<br/>zweite Zeile");
    expect(html).toContain("Zweiter Absatz</p>");
  });

  it("kennt ## und ### als Zwischenüberschriften", () => {
    const html = md("## Groß\n\n### Klein\nText direkt darunter");
    expect(html).toMatch(/<h2[^>]*>Groß<\/h2>/);
    expect(html).toMatch(/<h3[^>]*>Klein<\/h3>/);
    expect(html).toContain("Text direkt darunter</p>");
  });

  it("verschiebt die Überschriftenebene unter einer Abschnittsüberschrift", () => {
    const html = md("## Groß\n\n### Klein", { headingBase: 3 });
    expect(html).toMatch(/<h3[^>]*>Groß<\/h3>/);
    expect(html).toMatch(/<h4[^>]*>Klein<\/h4>/);
  });

  it("überspringt keine Überschriftenebene", () => {
    const html = md("Text\n\n### Nur klein", { headingBase: 3 });
    expect(html).toMatch(/<h3[^>]*>Nur klein<\/h3>/);
    expect(md("### Klein")).toMatch(/<h2[^>]*>Klein<\/h2>/);
  });

  it("baut Listen aus Zeilen mit „- “ und nummerierte Listen", () => {
    const html = md("Vorher\n- eins\n- **zwei**\n\n1. erstens\n2. zweitens");
    expect(html).toMatch(/<ul[^>]*>.*<li[^>]*>eins<\/li><li[^>]*><strong[^>]*>zwei<\/strong><\/li><\/ul>/);
    expect(html).toContain("Vorher</p>");
    expect(html).toMatch(/<ol[^>]*>.*erstens.*zweitens.*<\/ol>/);
  });

  it("zeigt Listen auf Wunsch mit Häkchen", () => {
    const html = md("- eins\n- zwei", { listStyle: "check" });
    expect(html).toContain("<svg");
    expect(html).not.toContain("list-disc");
  });

  it("setzt **fett** und *kursiv*", () => {
    const html = md("Das ist **wichtig** und *betont*.");
    expect(html).toMatch(/<strong[^>]*>wichtig<\/strong>/);
    expect(html).toMatch(/<em[^>]*>betont<\/em>/);
  });

  it("lässt einzelne Sternchen, Rechenzeichen und maskierte Zeichen stehen", () => {
    expect(inline("3 * 4 = 12")).toBe("3 * 4 = 12");
    expect(inline("\\*kein kursiv\\*")).toBe("*kein kursiv*");
    expect(inline("**")).toBe("**");
  });

  it("gibt bei leerem Text nichts aus", () => {
    expect(md("")).toBe("");
    expect(md("   \n\n  ")).toBe("");
  });

  it("ordnet Zeilen beim Parsen richtig zu", () => {
    expect(parseMarkdownBlocks("## Titel\nText\n- a\n  weiter\n- b\nNeu")).toEqual([
      { t: "h", level: 2, text: "Titel" },
      { t: "p", text: "Text" },
      { t: "list", ordered: false, items: ["a\nweiter", "b"] },
      { t: "p", text: "Neu" },
    ]);
  });
});

describe("Markdown: Links", () => {
  it("verlinkt interne Seiten und Anker ohne neues Fenster", () => {
    const html = md("[Kontakt](/kontakt) und [Abschnitt](#abrechnung)");
    expect(html).toMatch(/<a[^>]*href="\/kontakt"[^>]*>Kontakt<\/a>/);
    expect(html).toMatch(/<a[^>]*href="#abrechnung"[^>]*>Abschnitt<\/a>/);
    expect(html).not.toContain("target=");
  });

  it("öffnet externe Links in neuem Fenster mit rel=noopener noreferrer", () => {
    const html = md("[DeepL](https://www.deepl.com/de/privacy)");
    expect(html).toContain('href="https://www.deepl.com/de/privacy"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("verlinkt tel: und mailto: normal", () => {
    const html = md("[Anrufen](tel:+49711123456) oder [Mail](mailto:info@hertlin.de)");
    expect(html).toContain('href="tel:+49711123456"');
    expect(html).toContain('href="mailto:info@hertlin.de"');
    expect(html).not.toContain("target=");
  });

  it("löst {fernwartung} als Link-Ziel auf", () => {
    const html = md("[Programm laden]({fernwartung})");
    expect(html).toContain('href="https://get.teamviewer.com/hertlin"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("zeigt Links mit unzulässigem Ziel nur als Text", () => {
    const attacks = [
      "[Klick](javascript:alert(1))",
      "[Klick](JavaScript:alert(document.cookie))",
      "[Klick](data:text/html;base64,PHNjcmlwdD4=)",
      "[Klick](vbscript:msgbox(1))",
      "[Klick](//evil.example/login)",
      "[Klick](/\\evil.example)",
      "[Klick](https://evil.example\" onmouseover=\"alert(1))",
      "[Klick]( javascript:alert(1) )",
      "[Klick](tel:+49\"><script>alert(1)</script>)",
    ];
    for (const attack of attacks) {
      const html = md(attack);
      expect(html, attack).not.toMatch(/<a\b/);
      expect(html, attack).not.toMatch(/javascript:|vbscript:|data:text|evil\.example|<script/i);
      expect(html, attack).toContain("Klick");
    }
  });

  it("verschachtelt keine Links im Linktext", () => {
    const html = md("[Außen [innen](/b)](/a)");
    expect((html.match(/<a\b/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("verwirft {fernwartung}, wenn in den Firmendaten kein http(s)-Link steht", () => {
    const bad = buildPlaceholderContext({ ...SETTINGS, remoteSupportUrl: "javascript:alert(1)" });
    const html = renderToStaticMarkup(createElement(Markdown, { text: "[Fernwartung]({fernwartung})", ctx: bad }));
    expect(html).not.toMatch(/<a\b/);
    expect(html).toContain("Fernwartung");
  });
});

describe("Markdown: HTML wird nie ausgeführt", () => {
  it("zeigt HTML-Tags als Text", () => {
    const html = md('<script>alert("x")</script>\n\n<img src=x onerror="alert(1)">\n\n<a href="javascript:alert(1)">x</a>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/<a\b/);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("escaped Platzhalterwerte aus den Firmendaten", () => {
    const evil = buildPlaceholderContext({ ...SETTINGS, name: "<b>Böse</b> **Firma**" });
    const html = renderToStaticMarkup(createElement(Markdown, { text: "Willkommen bei {firma}", ctx: evil }));
    expect(html).toContain("&lt;b&gt;Böse&lt;/b&gt; **Firma**");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<strong");
  });

  it("parst Inline-Elemente in eine sichere Struktur", () => {
    expect(parseInline("a **b** [c](/d)")).toEqual([
      { t: "text", v: "a " },
      { t: "strong", c: [{ t: "text", v: "b" }] },
      { t: "text", v: " " },
      { t: "link", href: "/d", c: [{ t: "text", v: "c" }] },
    ]);
  });
});

/* ------------------------------------------------------------------ */
/* Platzhalter                                                         */
/* ------------------------------------------------------------------ */

describe("Platzhalter", () => {
  it("ersetzt alle Firmendaten genau nach Zuordnung", () => {
    const text = "{firma}|{telefon}|{email}|{support_email}|{region}|{adresse}";
    expect(replacePlaceholders(text, ctx)).toBe(
      "Hertlin|0711 123456|info@hertlin.de|support@hertlin.de|Raum Stuttgart|Hauptstraße 1, 70173 Stuttgart",
    );
  });

  it("kennt die zusätzlichen Platzhalter der Darstellung", () => {
    expect(replacePlaceholders("{firmierung} / {hosting} / {log_tage} / {portal_beispiel}", ctx)).toBe(
      "Hertlin IT-Service GmbH / Beispiel Hosting GmbH, Musterweg 2, 10115 Berlin / 7 / ihrefirma.hertlin.de",
    );
    expect(PLACEHOLDER_KEYS).toEqual(expect.arrayContaining(["hosting", "log_tage"]));
  });

  it("lässt unbekannte Platzhalter und leere Texte in Ruhe", () => {
    expect(replacePlaceholders("{unbekannt} und {FIRMA}", ctx)).toBe("{unbekannt} und {FIRMA}");
    expect(replacePlaceholders(undefined, ctx)).toBe("");
    expect(replacePlaceholders("{fernwartung}", ctx)).toBe("{fernwartung}");
  });

  it("baut die Anschrift ohne leere Teile", () => {
    expect(formatAddress({ street: "Weg 1", zip: "", city: "Ulm" })).toBe("Weg 1, Ulm");
    expect(formatAddress({ street: "", zip: "", city: "" })).toBe("");
  });

  it("verlinkt Telefon und E-Mail im Fließtext", () => {
    expect(splitPlaceholders("Ruf {telefon} an", ctx)).toEqual([
      { text: "Ruf " },
      { text: "0711 123456", href: "tel:+49711123456" },
      { text: " an" },
    ]);
    const html = md("Schreiben Sie an {support_email} oder rufen Sie {telefon} an.");
    expect(html).toContain('href="mailto:support@hertlin.de"');
    expect(html).toContain('href="tel:+49711123456"');
  });

  it("verlinkt nicht innerhalb eines Links und nicht bei ungültiger Nummer", () => {
    const html = md("[Rufen Sie {telefon} an](/kontakt)");
    expect((html.match(/<a\b/g) ?? []).length).toBe(1);
    expect(html).toContain("Rufen Sie 0711 123456 an");

    const noHref = buildPlaceholderContext({ ...SETTINGS, phoneHref: "abc" });
    expect(splitPlaceholders("{telefon}", noHref)).toEqual([{ text: "0711 123456" }]);
  });

  it("prüft Link-Ziele gegen SAFE_HREF", () => {
    expect(resolveHref("/kontakt", ctx)).toEqual({ href: "/kontakt", external: false });
    expect(resolveHref("#anker", ctx)).toEqual({ href: "#anker", external: false });
    expect(resolveHref("https://example.org", ctx)).toEqual({ href: "https://example.org", external: true });
    expect(resolveHref("{fernwartung}", ctx)).toEqual({ href: SETTINGS.remoteSupportUrl, external: true });
    for (const bad of ["javascript:alert(1)", "//evil.example", "/\\evil.example", "data:x", "", "ftp://x", "/a\u0000b"]) {
      expect(resolveHref(bad, ctx), bad).toBeNull();
    }
  });
});

/* ------------------------------------------------------------------ */
/* Standardinhalte                                                     */
/* ------------------------------------------------------------------ */

/** Alle Textwerte eines Objekts (rekursiv) */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

/** Alle Link-Ziele: Markdown-Links und Link-Felder ({label, href}) */
function hrefs(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      for (const m of v.matchAll(/\]\(([^)\s]+)\)/g)) out.push(m[1]);
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.href === "string") out.push(o.href);
      Object.values(o).forEach(walk);
    }
  };
  walk(value);
  return out;
}

function anchorsOf(slug: string): Set<string> {
  const anchors = new Set<string>();
  for (const b of DEFAULT_PAGES[slug].blocks) {
    if (b.anchor) anchors.add(b.anchor);
    if (b.type === "privateSupportForm" && !b.anchor) anchors.add("hilfe-anfordern");
  }
  return anchors;
}

describe("Standardinhalte der Kernseiten", () => {
  it("gibt es für jede Kernseite", () => {
    for (const slug of SYSTEM_PAGE_SLUGS) {
      expect(getDefaultPage(slug), `/${slug}`).not.toBeNull();
      expect(DEFAULT_PAGES[slug].blocks.length, `/${slug}`).toBeGreaterThan(0);
    }
    expect(getDefaultPage("gibt-es-nicht")).toBeNull();
    expect(getDefaultPage("toString")).toBeNull();
  });

  it.each(Object.entries(DEFAULT_PAGE_SOURCES))("„/%s“ besteht blocksSchema und pageDraftSchema", (slug, page) => {
    const blocks = blocksSchema.parse(page.blocks);
    expect(blocks).toHaveLength(page.blocks.length);
    expect(DEFAULT_PAGES[slug].blocks).toHaveLength(page.blocks.length);
    expect(() =>
      pageDraftSchema.parse({ title: page.title, description: page.description, blocks: page.blocks }),
    ).not.toThrow();
    expect(() =>
      pageMetaSchema.parse({
        title: page.title,
        description: page.description,
        navLabel: page.navLabel,
        showInNav: page.showInNav,
        showInFooter: page.showInFooter,
        navOrder: page.navOrder,
      }),
    ).not.toThrow();
    // Gespeichert und wieder eingelesen geht nichts verloren
    expect(parseBlocks(JSON.stringify(DEFAULT_PAGES[slug].blocks))).toEqual(DEFAULT_PAGES[slug].blocks);
    // Modul-ids sind je Seite eindeutig
    const ids = page.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(Object.entries(DEFAULT_PAGE_SOURCES))("„/%s“ hat eine Beschreibung ohne Kürzungs-Warnung im Editor", (_, page) => {
    // Der Seiten-Editor warnt ab 160 Zeichen, die mitgelieferten Texte sollen darunter bleiben
    expect((page.description ?? "").length).toBeLessThanOrEqual(160);
  });

  it("hat das Menü wie bisher", () => {
    const entries = Object.entries(DEFAULT_PAGES).sort(([, a], [, b]) => a.navOrder - b.navOrder);
    const main = entries.filter(([, p]) => p.showInNav).map(([, p]) => p.navLabel ?? p.title);
    const footer = entries.filter(([, p]) => p.showInFooter).map(([slug]) => `/${slug}`);
    expect(main).toEqual(["Leistungen", "Für Unternehmen", "Für Privatkunden", "Über uns", "Kontakt"]);
    expect(footer).toEqual(["/impressum", "/datenschutz", "/agb", "/support"]);
  });

  it("enthält die geforderten Module", () => {
    const types = (slug: string) => DEFAULT_PAGES[slug].blocks.map((b) => b.type);
    // Telefon und E-Mail stehen auf der Kontaktseite direkt am Formular (siehe ContactLines unten)
    expect(types("kontakt")).toEqual(expect.arrayContaining(["inquiryForm", "locations"]));
    expect(types("kontakt")[1]).toBe("inquiryForm");
    expect(types("privatkunden")).toContain("privateSupportForm");
    expect(anchorsOf("privatkunden")).toContain("hilfe-anfordern");
    expect(types("impressum")).toContain("companyInfo");
    expect(types("")[0]).toBe("hero");
    expect(DEFAULT_PAGES[""].blocks[0]).toMatchObject({ visual: "portal" });
    expect(hrefs(DEFAULT_PAGE_SOURCES.support)).toContain("{fernwartung}");
  });

  it("hält die Seiten kurz und die wichtigste Aktion oben", () => {
    const types = (slug: string) => DEFAULT_PAGES[slug].blocks.map((b) => b.type);
    // Startseite: Einstieg, zwei Wege, Leistungen, Ablauf, Abschluss – ohne doppelte Portal- und Reaktionszeit-Abschnitte
    expect(types("")).toEqual(["hero", "split", "cards", "steps", "cta"]);
    // Support: Der Download-Knopf steht direkt unter der Überschrift der Fernwartung, nicht in einem Kasten danach
    const fernwartung = DEFAULT_PAGES.support.blocks.find((b) => b.anchor === "fernwartung");
    expect(fernwartung).toMatchObject({ type: "steps", cta: { href: "{fernwartung}" } });
    expect(types("support")).not.toContain("cta");
    // Kontakt: Das Formular folgt direkt auf den Seitenkopf
    expect(types("kontakt").slice(0, 2)).toEqual(["hero", "inquiryForm"]);
    // Leistungen: Sprungleiste statt Linkliste im Seitenkopf
    expect(anchorNavItems(DEFAULT_PAGES.leistungen.blocks, blockCtx).map((i) => i.id)).toEqual([
      "arbeitsplaetze",
      "netzwerk",
      "microsoft-365",
      "server-backup",
      "sicherheit",
      "telefonie",
      "abrechnung",
    ]);
  });

  it("stellt bei den AGB den Muster-Hinweis an den Anfang", () => {
    const [, first] = DEFAULT_PAGES.agb.blocks;
    expect(first.type).toBe("text");
    expect(strings(first).join(" ")).toContain("Muster – vor Verwendung rechtlich prüfen lassen und an Ihre Verträge anpassen.");
    const all = strings(DEFAULT_PAGE_SOURCES.agb).join("\n");
    for (const topic of [
      "Geltungsbereich",
      "Vertragsschluss",
      "Leistungsumfang",
      "Mitwirkungspflichten",
      "Reaktionszeiten",
      "Vergütung",
      "Abnahme",
      "Gewährleistung",
      "Haftung",
      "Auftragsverarbeitung",
      "Kündigung",
      "Widerrufsrecht",
      "Schlussbestimmungen",
      "Produkthaftungsgesetz",
    ]) {
      expect(all, topic).toContain(topic);
    }
  });

  it("deckt in der Datenschutzerklärung die neuen Funktionen ab", () => {
    const all = strings(DEFAULT_PAGE_SOURCES.datenschutz).join("\n");
    for (const topic of ["WebSocket", "DeepL SE", "Anthropic PBC", "Standardvertragsklauseln", "hertlin_lang", "localStorage", "Rufnummer", "{hosting}", "{log_tage}"]) {
      expect(all, topic).toContain(topic);
    }
  });

  it("schreibt keine Kontaktdaten fest in die Texte", () => {
    const all = Object.values(DEFAULT_PAGE_SOURCES).flatMap(strings).join("\n");
    expect(all).not.toMatch(/@hertlin\.de|\b0\d{3,4}[ /]\d{4,}|TODO/);
  });

  it("verwendet nur bekannte Platzhalter", () => {
    const known = new Set<string>([...PLACEHOLDER_KEYS, "fernwartung"]);
    const used = Object.values(DEFAULT_PAGE_SOURCES)
      .flatMap(strings)
      .flatMap((s) => [...s.matchAll(/\{([a-z_]+)\}/g)].map((m) => m[1]));
    for (const key of used) expect(known.has(key), key).toBe(true);
  });

  it("verlinkt nur auf erlaubte Ziele, vorhandene Seiten und Anker", () => {
    const appRoutes = new Set(["/login", "/status"]);
    for (const [slug, page] of Object.entries(DEFAULT_PAGE_SOURCES)) {
      for (const href of hrefs(page)) {
        expect(SAFE_HREF.test(href), `${href} auf /${slug}`).toBe(true);
        if (href.startsWith("#")) {
          expect(anchorsOf(slug).has(href.slice(1)), `${href} auf /${slug}`).toBe(true);
        } else if (href.startsWith("/")) {
          const [path, anchor] = href.split("#");
          const target = path.slice(1);
          const isPage = Object.hasOwn(DEFAULT_PAGES, target);
          expect(isPage || appRoutes.has(path), `${href} auf /${slug}`).toBe(true);
          if (anchor) expect(anchorsOf(target).has(anchor), `${href} auf /${slug}`).toBe(true);
        }
      }
    }
  });

  it("vermeidet die verbotenen Floskeln", () => {
    const all = Object.values(DEFAULT_PAGE_SOURCES).flatMap(strings).join("\n").toLowerCase();
    for (const phrase of [
      "nahtlos",
      "maßgeschneidert",
      "ganzheitlich",
      "innovativ",
      "aus einer hand",
      "zuverlässiger partner",
      "nächste level",
      "digitalen welt",
      "rundum-sorglos",
      "revolutionär",
      "synergie",
      "mehrwert",
      "state of the art",
      "leidenschaft",
      "brennen für",
      "herzstück",
      "an ihrer seite",
      "smart",
      "game changer",
      "entfessel",
      "reise",
      "landschaft",
      "lassen sie uns gemeinsam",
      "!!",
    ]) {
      // Am Wortanfang suchen, damit z. B. „Preise“ nicht als „Reise“ zählt
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(all, phrase).not.toMatch(new RegExp(`(^|[^\\p{L}])${escaped}`, "u"));
    }
  });
});

/* ------------------------------------------------------------------ */
/* Darstellung der Module                                              */
/* ------------------------------------------------------------------ */

describe("Anordnung der Module", () => {
  const hero = block({ id: "h", type: "hero", title: "Titel", visual: "none", tone: "blue" });
  const list = block({ id: "l", type: "checklist", items: ["a"], tone: "blue" });
  const textA = block({ id: "a", type: "text", title: "A", body: "x", width: "wide", tone: "white" });
  const textB = block({ id: "b", type: "text", title: "B", body: "y", width: "wide", tone: "white" });
  const cta = block({ id: "c", type: "cta", title: "Los", tone: "blue" });

  it("verbindet Abschnitte mit gleichem Hintergrund und trennt gleichartige Texte mit einer Linie", () => {
    const [l0, l1, l2, l3, l4] = computeLayouts([hero, list, textA, textB, cta]);
    expect(l0).toMatchObject({ bg: "blue", joinTop: false, joinBottom: true, primaryHeading: true });
    expect(l1).toMatchObject({ bg: "blue", joinTop: true, joinBottom: false, primaryHeading: false });
    expect(l2).toMatchObject({ bg: "white", joinTop: false, joinBottom: true, separator: false });
    expect(l3).toMatchObject({ bg: "white", joinTop: true, separator: true });
    // Handlungsaufforderung hebt sich vom vorherigen (weißen) Abschnitt ab
    expect(l4.bg).toBe("blue");
  });

  it("lässt den großen Einstieg mit Portal-Ansicht für sich stehen", () => {
    const portal = block({ id: "p", type: "hero", title: "Start", visual: "portal", tone: "blue" });
    const white = block({ id: "w", type: "text", body: "x", tone: "white" });
    const [p, w] = computeLayouts([portal, white]);
    expect(p).toMatchObject({ bg: "white", joinBottom: false });
    expect(w).toMatchObject({ joinTop: false });
  });

  it("setzt keine zweite Linie unter Module, die schon mit einer Linie enden", () => {
    const rows = block({ id: "r", type: "cards", layout: "rows", title: "Zeilen", items: [{ title: "a" }], tone: "white" });
    const steps = block({ id: "s", type: "steps", layout: "list", title: "Ablauf", items: [{ title: "a" }], tone: "white" });
    const faq = block({ id: "f", type: "faq", title: "Fragen", items: [{ question: "a?", answer: "b" }], tone: "white" });
    const tiles = block({ id: "k", type: "cards", layout: "tiles", title: "Kacheln", items: [{ title: "a" }], tone: "white" });
    for (const prev of [rows, steps, faq]) {
      expect(endsWithRule(prev), prev.id).toBe(true);
      const [, next] = computeLayouts([prev, textA]);
      expect(next, prev.id).toMatchObject({ joinTop: true, separator: false });
    }
    // Ohne Linie am Ende bleibt die Trennlinie
    expect(endsWithRule(tiles)).toBe(false);
    expect(computeLayouts([tiles, textA])[1]).toMatchObject({ joinTop: true, separator: true });
  });

  it("zeigt die Leiste „Auf dieser Seite“ erst ab mehreren Abschnitten mit Anker", () => {
    const sections = Array.from({ length: ANCHOR_NAV_MIN }, (_, i) =>
      block({ id: `t${i}`, type: "text", anchor: `teil-${i}`, title: `Teil {firma} ${i}`, body: "x", tone: "white" }),
    );
    const items = anchorNavItems([hero, ...sections, cta], blockCtx);
    expect(items).toHaveLength(ANCHOR_NAV_MIN);
    expect(items[0]).toEqual({ id: "teil-0", label: "Teil Hertlin 0" });
    expect(anchorNavItems([hero, ...sections.slice(1)], blockCtx)).toEqual([]);
    // Ausgeblendete Abschnitte zählen nicht
    expect(anchorNavItems([{ ...sections[0], hidden: true }, ...sections.slice(1)], blockCtx)).toEqual([]);
  });

  it("erzeugt sichere, eindeutige DOM-ids", () => {
    const odd = block({ id: 'x"><script>', type: "text", body: "x", tone: "white" });
    const [layout] = computeLayouts([odd]);
    expect(layout.domId).toMatch(/^m0-[A-Za-z0-9_-]+$/);
  });

  it("lässt ausgeblendete Module auf der Website weg und zeigt sie in der Vorschau", () => {
    const hidden = { ...textB, hidden: true };
    expect(planBlocks([hero, hidden, textA], false).map((p) => p.block.id)).toEqual(["h", "a"]);
    const preview = planBlocks([hero, hidden, textA], true);
    expect(preview.map((p) => [p.block.id, p.hidden])).toEqual([
      ["h", false],
      ["b", true],
      ["a", false],
    ]);
    // Ausgeblendetes beeinflusst die Übergänge der übrigen Module nicht
    expect(preview[2].layout.joinTop).toBe(false);
  });
});

describe("Module", () => {
  it("setzt Sprunganker und Hintergrund", () => {
    const b = block({ id: "t", type: "text", anchor: "abrechnung", title: "Kosten", body: "Text", tone: "blue" });
    const [layout] = computeLayouts([b]);
    const html = renderToStaticMarkup(createElement(TextBlock, { block: b as Extract<Block, { type: "text" }>, ctx: blockCtx, layout }));
    expect(html).toContain('id="abrechnung"');
    expect(html).toContain("bg-brand-50");
    expect(html).toMatch(/<h2[^>]*>Kosten<\/h2>/);
  });

  it("zeigt im Impressum alle Angaben aus den Firmendaten", () => {
    const b = block({ id: "i", type: "companyInfo", variant: "impressum", tone: "white" }) as Extract<Block, { type: "companyInfo" }>;
    const [layout] = computeLayouts([b]);
    const html = renderToStaticMarkup(createElement(CompanyInfoBlock, { block: b, ctx: blockCtx, layout }));
    for (const value of [
      "Angaben gemäß § 5 DDG",
      SETTINGS.legalName,
      SETTINGS.owner,
      SETTINGS.street,
      "70173 Stuttgart",
      'href="tel:+49711123456"',
      'href="mailto:info@hertlin.de"',
      SETTINGS.vatId,
      SETTINGS.register,
      "§ 18 Abs. 2 MStV",
    ]) {
      expect(html, value).toContain(value);
    }
    expect(html).not.toContain("Angaben noch unvollständig");
  });

  it("weist im Impressum auf unvollständige Firmendaten hin und lässt leere Angaben weg", () => {
    const b = block({ id: "i", type: "companyInfo", variant: "impressum", tone: "white" }) as Extract<Block, { type: "companyInfo" }>;
    const [layout] = computeLayouts([b]);
    const settings = { ...SETTINGS, owner: "TODO Vorname Nachname", register: "", vatId: "" };
    const html = renderToStaticMarkup(
      createElement(CompanyInfoBlock, { block: b, ctx: { ...blockCtx, settings }, layout }),
    );
    expect(html).toContain("Angaben noch unvollständig");
    expect(html).not.toContain("Registereintrag");
    expect(html).not.toContain("Umsatzsteuer-Identifikationsnummer");
  });

  it("zeigt in der Kurzform nur Anschrift und Kontakt", () => {
    const b = block({ id: "k", type: "companyInfo", variant: "kontakt", tone: "white", title: "1. Verantwortlicher" }) as Extract<
      Block,
      { type: "companyInfo" }
    >;
    const [layout] = computeLayouts([b]);
    const html = renderToStaticMarkup(createElement(CompanyInfoBlock, { block: b, ctx: blockCtx, layout }));
    expect(html).toContain("1. Verantwortlicher");
    expect(html).toContain(SETTINGS.legalName);
    expect(html).not.toContain(SETTINGS.vatId);
  });

  it("stellt im Ablauf den Button samt Hinweis direkt unter die Überschrift", () => {
    const b = block({
      id: "f",
      type: "steps",
      layout: "list",
      anchor: "fernwartung",
      title: "So funktioniert die Fernwartung",
      cta: { label: "Fernwartung herunterladen", href: "{fernwartung}" },
      note: "**Nur nach Absprache am Telefon.**",
      items: [{ title: "Anrufen", text: "x" }],
      tone: "white",
    }) as Extract<Block, { type: "steps" }>;
    const [layout] = computeLayouts([b]);
    const html = renderToStaticMarkup(createElement(StepsBlock, { block: b, ctx: blockCtx, layout }));
    expect(html).toContain('href="https://get.teamviewer.com/hertlin"');
    expect(html).toContain("Nur nach Absprache am Telefon.");
    // Button und Hinweis stehen vor der Liste der Schritte
    expect(html.indexOf("Fernwartung herunterladen")).toBeLessThan(html.indexOf("<ol"));
  });

  it("macht verlinkte Kacheln als Ganzes klickbar", () => {
    const b = block({
      id: "c",
      type: "cards",
      layout: "columns",
      title: "Leistungen",
      items: [{ title: "Netzwerk", text: "Mehr im [Plan](/leistungen#netzwerk)", link: { label: "Mehr", href: "/leistungen" } }],
      tone: "white",
    }) as Extract<Block, { type: "cards" }>;
    const [layout] = computeLayouts([b]);
    const html = renderToStaticMarkup(createElement(CardsBlock, { block: b, ctx: blockCtx, layout }));
    expect(html).toMatch(/<a[^>]*class="[^"]*after:absolute after:inset-0[^"]*"[^>]*href="\/leistungen"|<a[^>]*href="\/leistungen"[^>]*class="[^"]*after:absolute after:inset-0/);
    // Links im Text liegen über der Klickfläche
    expect(html).toContain("[&amp;_a]:z-10");
  });

  it("zeigt die Handlungsaufforderung in Hell und Dunkel gleich (Insel)", () => {
    const blue = block({ id: "c", type: "cta", title: "Los", tone: "blue" }) as Extract<Block, { type: "cta" }>;
    const dark = block({ id: "d", type: "cta", title: "Los", tone: "dark" }) as Extract<Block, { type: "cta" }>;
    const [layout] = computeLayouts([blue]);
    expect(renderToStaticMarkup(createElement(CtaBlock, { block: blue, ctx: blockCtx, layout }))).toContain('data-theme="light"');
    expect(renderToStaticMarkup(createElement(CtaBlock, { block: dark, ctx: blockCtx, layout }))).toContain('data-theme="dark"');
  });

  it("zeigt am Anfrageformular Telefon, E-Mail und Servicezeiten", () => {
    const html = renderToStaticMarkup(createElement(ContactLines, { settings: SETTINGS }));
    expect(html).toContain('href="tel:+49711123456"');
    expect(html).toContain('href="mailto:info@hertlin.de"');
    expect(html).toContain("Montag bis Freitag 8:00 – 17:00 Uhr");
    expect(renderToStaticMarkup(createElement(ContactLines, { settings: { ...SETTINGS, phone: "", email: "" } }))).toBe("");
  });

  it("teilt die Einleitung des Anfrageformulars an der ersten Zwischenüberschrift", () => {
    expect(splitIntro("Hinweis oben\n\n## So geht es weiter\n1. a")).toEqual({
      lead: "Hinweis oben",
      rest: "## So geht es weiter\n1. a",
    });
    expect(splitIntro("Nur Text")).toEqual({ lead: "Nur Text", rest: "" });
    expect(splitIntro("## Gleich eine Überschrift\nText")).toEqual({ lead: "", rest: "## Gleich eine Überschrift\nText" });
    expect(splitIntro(undefined)).toEqual({ lead: "", rest: "" });
    const kontakt = DEFAULT_PAGES.kontakt.blocks.find((b) => b.type === "inquiryForm");
    expect(splitIntro(kontakt && "intro" in kontakt ? kontakt.intro : "").lead).toContain("Schon Firmenkunde?");
  });

  it("übernimmt ?typ= und ?thema= für das Anfrageformular", () => {
    const withQuery = (q: Record<string, string>) => inquiryDefaults({ ...blockCtx, searchParams: q }, "BUSINESS");
    expect(withQuery({})).toEqual({ defaultType: "BUSINESS", defaultTopic: undefined });
    expect(withQuery({ typ: "privat" }).defaultType).toBe("PRIVATE");
    expect(withQuery({ typ: "firma" }).defaultType).toBe("BUSINESS");
    expect(withQuery({ thema: "privat_hilfe" })).toEqual({ defaultType: "PRIVATE", defaultTopic: "PRIVAT_HILFE" });
    expect(withQuery({ thema: "quatsch" }).defaultTopic).toBeUndefined();
    expect(inquiryDefaults(blockCtx, "PRIVATE").defaultType).toBe("PRIVATE");
  });
});

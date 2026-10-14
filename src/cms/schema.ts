import { z } from "zod";

/**
 * Datenformat der Website-Module (Content-Management).
 * Eine Seite besteht aus einer Liste von Modulen ("blocks"). Jedes Modul hat eine id, einen type
 * und typabhängige Felder. Dieses Schema ist der Vertrag zwischen Editor (Verwaltung) und Darstellung (Website).
 *
 * Textfelder dürfen Platzhalter enthalten, die beim Anzeigen ersetzt werden:
 *   {firma} {telefon} {email} {support_email} {region} {adresse}
 * Felder namens "body", "text", "answer" und "intro" unterstützen einfaches Markdown:
 *   Absätze (Leerzeile), "## Überschrift", "### Unterüberschrift", "- Aufzählung", **fett**, *kursiv*, [Link](/pfad)
 * Erlaubte Link-Ziele: /pfad, #anker, https://…, http://…, mailto:…, tel:…  sowie {fernwartung} (Fernwartungslink)
 */

const short = (max = 160) => z.string().trim().max(max);
const long = (max = 20_000) => z.string().max(max);

export const SAFE_HREF = /^(\/(?!\/)[^\s]*|#[\w-]*|https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s/()-]+|\{fernwartung\})$/;

export const ctaSchema = z.object({
  label: short(60).min(1),
  href: short(500).regex(SAFE_HREF, "Ungültiges Link-Ziel"),
});

export const toneSchema = z.enum(["white", "blue"]).default("white");

const base = {
  id: z.string().min(1).max(40),
  hidden: z.boolean().optional(),
  /** optionaler Sprunganker, z. B. "hilfe-anfordern" */
  anchor: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional(),
};

const heading = {
  eyebrow: short(60).optional(),
  title: short(200).optional(),
  intro: long(2000).optional(),
};

export const ICONS = [
  "monitor",
  "network",
  "mail",
  "server",
  "shield",
  "phone",
  "printer",
  "wifi",
  "headset",
  "building",
  "home",
  "users",
  "clock",
  "ticket",
  "check",
  "map",
] as const;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("hero"),
    eyebrow: short(60).optional(),
    title: short(200).min(1),
    text: long(1500).optional(),
    primary: ctaSchema.optional(),
    secondary: ctaSchema.optional(),
    /** portal = gezeichnete Vorschau des Kundenportals, image = Bild aus der Mediathek */
    visual: z.enum(["portal", "image", "none"]).default("portal"),
    imageId: z.string().max(40).optional(),
    imageAlt: short(200).optional(),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("text"),
    ...heading,
    body: long(),
    /** narrow = Lesespalte, wide = Überschrift links und Text rechts, note = Hinweis mit hellblauer Randlinie */
    width: z.enum(["narrow", "wide", "note"]).default("narrow"),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("cards"),
    ...heading,
    /**
     * tiles = Kästen mit Hintergrund, columns = ohne Kasten mit feiner Linie darüber,
     * rows = Zeilen untereinander (Überschrift links, Text rechts). Ältere Module ohne Angabe bleiben Kacheln.
     */
    layout: z.enum(["tiles", "columns", "rows"]).default("tiles"),
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
    items: z
      .array(
        z.object({
          title: short(120).min(1),
          text: long(1500).default(""),
          icon: z.enum(ICONS).optional(),
          link: ctaSchema.optional(),
        }),
      )
      .max(24),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("steps"),
    ...heading,
    /** list = schlichte nummerierte Liste, cards = Kacheln nebeneinander (sparsam einsetzen) */
    layout: z.enum(["list", "cards"]).default("list"),
    items: z.array(z.object({ title: short(120).min(1), text: long(1500).default("") })).max(12),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("split"),
    ...heading,
    panels: z
      .array(
        z.object({
          eyebrow: short(60).optional(),
          title: short(160).min(1),
          text: long(1500).default(""),
          points: z.array(short(200)).max(10).default([]),
          link: ctaSchema.optional(),
        }),
      )
      .min(1)
      .max(3),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("checklist"),
    ...heading,
    items: z.array(short(300)).max(30),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("faq"),
    ...heading,
    items: z.array(z.object({ question: short(300).min(1), answer: long(4000) })).max(30),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("responseTimes"),
    ...heading,
    note: long(500).optional(),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("imageText"),
    ...heading,
    body: long(),
    imageId: z.string().max(40).optional(),
    imageAlt: short(200).optional(),
    imagePosition: z.enum(["left", "right"]).default("right"),
    link: ctaSchema.optional(),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("cta"),
    title: short(200).min(1),
    text: long(1000).optional(),
    primary: ctaSchema.optional(),
    secondary: ctaSchema.optional(),
    showPhone: z.boolean().default(true),
    tone: z.enum(["blue", "dark"]).default("blue"),
  }),
  z.object({
    ...base,
    type: z.literal("contact"),
    ...heading,
    showAddress: z.boolean().default(true),
    showHours: z.boolean().default(true),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("inquiryForm"),
    ...heading,
    /** Vorauswahl, falls die Seite nicht per ?typ= aufgerufen wird */
    defaultType: z.enum(["BUSINESS", "PRIVATE"]).default("BUSINESS"),
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("privateSupportForm"),
    ...heading,
    tone: toneSchema,
  }),
  z.object({
    ...base,
    type: z.literal("companyInfo"),
    ...heading,
    /** impressum = Angaben nach § 5 DDG aus den Firmendaten */
    variant: z.enum(["impressum", "kontakt"]).default("impressum"),
    tone: toneSchema,
  }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

export const blocksSchema = z.array(blockSchema).max(60);

/** Deutsche Namen und Kurzbeschreibungen für den Editor */
export const BLOCK_LABELS: Record<BlockType, { label: string; description: string }> = {
  hero: { label: "Kopfbereich", description: "Große Überschrift mit Text, Buttons und Bild oder Portal-Vorschau" },
  text: { label: "Text", description: "Überschrift und Fließtext, z. B. für Rechtstexte – auch als Hinweis mit Randlinie" },
  cards: {
    label: "Kacheln",
    description: "Gleichwertige Punkte mit Überschrift, Text und Link – als Kästen, Spalten oder Zeilen",
  },
  steps: { label: "Ablauf", description: "Nummerierte Schritte, z. B. „So läuft eine Störungsmeldung ab“" },
  split: { label: "Zwei Wege", description: "Nebeneinanderstehende Bereiche, z. B. Unternehmen und Privatkunden" },
  checklist: { label: "Liste", description: "Aufzählung mit Häkchen" },
  faq: { label: "Häufige Fragen", description: "Fragen und Antworten zum Aufklappen" },
  responseTimes: { label: "Reaktionszeiten", description: "Tabelle aus den Firmendaten" },
  imageText: { label: "Bild und Text", description: "Bild aus der Mediathek neben einem Text" },
  cta: { label: "Handlungsaufforderung", description: "Auffälliger Kasten mit Buttons und Telefonnummer" },
  contact: { label: "Kontaktangaben", description: "Telefon, E-Mail, Adresse und Öffnungszeiten aus den Firmendaten" },
  inquiryForm: { label: "Anfrageformular", description: "Formular für Neukunden (landet unter Anfragen)" },
  privateSupportForm: { label: "Hilfe-Formular Privatkunden", description: "Erstellt ein Ticket mit persönlichem Status-Link" },
  companyInfo: { label: "Firmenangaben", description: "Angaben für das Impressum aus den Firmendaten" },
};

/* ---------------- Seiten ---------------- */

/** Pfade, die nicht als Seitenadresse vergeben werden dürfen (gehören zur Anwendung) */
export const RESERVED_PAGE_SLUGS = new Set([
  "admin",
  "api",
  "portal",
  "login",
  "status",
  "anfrage",
  "medien",
  "vorschau",
  "passwort",
  "passwort-vergessen",
  "_next",
  "robots.txt",
  "sitemap.xml",
  "icon.svg",
  "favicon.ico",
]);

export const PAGE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

/** Kernseiten, die es immer gibt (nicht löschbar, Adresse fest). "" = Startseite */
export const SYSTEM_PAGE_SLUGS = [
  "",
  "leistungen",
  "unternehmen",
  "privatkunden",
  "ueber-uns",
  "support",
  "kontakt",
  "impressum",
  "datenschutz",
  "agb",
] as const;

export const pageMetaSchema = z.object({
  title: short(120).min(1, "Bitte einen Seitentitel angeben."),
  description: short(300).optional(),
  navLabel: short(40).optional(),
  showInNav: z.boolean().default(false),
  showInFooter: z.boolean().default(false),
  navOrder: z.number().int().min(0).max(999).default(100),
});

/** Entwurf einer Seite (Page.draft) */
export const pageDraftSchema = z.object({
  title: short(120).min(1),
  description: short(300).optional(),
  blocks: blocksSchema,
});

export type PageDraft = z.infer<typeof pageDraftSchema>;

/** Liest gespeicherte Module robust ein: ungültige Module werden übersprungen statt die Seite zu zerstören. */
export function parseBlocks(json: string | null | undefined): Block[] {
  if (!json) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: Block[] = [];
  for (const item of raw) {
    const parsed = blockSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10);
}

import { ICONS, newBlockId, type Block, type BlockType } from "@/cms/schema";

/**
 * Beschreibung der Eingabefelder je Modultyp – exakt nach src/cms/schema.ts.
 * Der Editor baut daraus die Formulare; Validierung macht das Schema (im Browser und auf dem Server).
 */

export type Option = { value: string; label: string };
type Values = Record<string, unknown>;

type Base = {
  label: string;
  hint?: string;
  /** Feld nur anzeigen, wenn die Bedingung erfüllt ist (z. B. Bildauswahl nur bei visual = "image") */
  showIf?: (values: Values) => boolean;
};

/**
 * optional:
 *  - "omit": leeres Feld wird entfernt (Schema: .optional())
 *  - "keep": leeres Feld bleibt als "" erhalten (Schema erlaubt leeren Text)
 *  - nicht gesetzt: Pflichtfeld
 */
type Optional = { optional?: "omit" | "keep" };

export type TextFieldDef = Base & Optional & { kind: "text"; name: string; max: number; placeholder?: string };
export type TextareaFieldDef = Base &
  Optional & { kind: "textarea"; name: string; max: number; rows?: number; markdown?: boolean; placeholder?: string };
export type SelectFieldDef = Base & {
  kind: "select";
  name: string;
  options: Option[];
  /** Werte als Zahl speichern (z. B. columns) */
  numeric?: boolean;
  /** Leere Auswahl erlaubt (Wert wird entfernt) */
  emptyLabel?: string;
  /** Symbolvorschau anzeigen (für icon) */
  iconPreview?: boolean;
};
export type CheckboxFieldDef = Base & { kind: "checkbox"; name: string };
export type LinkFieldDef = Base & { kind: "link"; name: string };
/** Bild aus der Mediathek: Felder imageId + imageAlt */
export type ImageFieldDef = Base & { kind: "image" };
export type InfoFieldDef = {
  kind: "info";
  text: string;
  href?: string;
  linkLabel?: string;
  showIf?: (values: Values) => boolean;
};
export type ListFieldDef = Base & {
  kind: "list";
  name: string;
  itemLabel: string;
  addLabel: string;
  min?: number;
  max: number;
  fields: FieldDef[];
  newItem: () => Values;
};
export type StringListFieldDef = Base & {
  kind: "stringList";
  name: string;
  itemLabel: string;
  addLabel: string;
  max: number;
  maxLength: number;
  placeholder?: string;
};

export type FieldDef =
  | TextFieldDef
  | TextareaFieldDef
  | SelectFieldDef
  | CheckboxFieldDef
  | LinkFieldDef
  | ImageFieldDef
  | InfoFieldDef
  | ListFieldDef
  | StringListFieldDef;

/* ---------------- Bausteine ---------------- */

export const ICON_LABELS: Record<(typeof ICONS)[number], string> = {
  monitor: "Bildschirm",
  network: "Netzwerk",
  mail: "E-Mail",
  server: "Server",
  shield: "Schutzschild",
  phone: "Telefon",
  printer: "Drucker",
  wifi: "WLAN",
  headset: "Headset",
  building: "Firmengebäude",
  home: "Wohnhaus",
  users: "Personen",
  clock: "Uhr",
  ticket: "Ticket",
  check: "Häkchen",
  map: "Karte",
};

const headingFields = (opts: { titleHint?: string } = {}): FieldDef[] => [
  {
    kind: "text",
    name: "eyebrow",
    label: "Dachzeile",
    hint: "Kurze Zeile über der Überschrift, z. B. „Für Unternehmen“.",
    max: 60,
    optional: "omit",
  },
  { kind: "text", name: "title", label: "Überschrift", hint: opts.titleHint, max: 200, optional: "omit" },
  {
    kind: "textarea",
    name: "intro",
    label: "Einleitung",
    hint: "Ein bis zwei Sätze unter der Überschrift.",
    max: 2000,
    rows: 3,
    markdown: true,
    optional: "omit",
  },
];

const toneField: FieldDef = {
  kind: "select",
  name: "tone",
  label: "Hintergrund",
  hint: "Weiße und hellblaue Abschnitte im Wechsel lassen sich gut auseinanderhalten.",
  options: [
    { value: "white", label: "Weiß" },
    { value: "blue", label: "Hellblau" },
  ],
};

const link = (name: string, label: string, hint?: string): LinkFieldDef => ({ kind: "link", name, label, hint });

const imageField = (hint?: string, showIf?: (v: Values) => boolean): ImageFieldDef => ({
  kind: "image",
  label: "Bild",
  hint,
  showIf,
});

/* ---------------- Felder je Modultyp ---------------- */

export const BLOCK_FIELDS: Record<BlockType, FieldDef[]> = {
  hero: [
    {
      kind: "text",
      name: "eyebrow",
      label: "Dachzeile",
      hint: "Kurze Zeile über der Überschrift, z. B. „IT-Service im {region}“.",
      max: 60,
      optional: "omit",
    },
    { kind: "text", name: "title", label: "Überschrift", hint: "Die wichtigste Aussage der Seite.", max: 200 },
    { kind: "textarea", name: "text", label: "Text", max: 1500, rows: 4, markdown: true, optional: "omit" },
    link("primary", "Hauptbutton", "Auffälliger Button, z. B. „Anfrage stellen“ → /kontakt"),
    link("secondary", "Zweiter Button", "Dezenter Button daneben."),
    {
      kind: "select",
      name: "visual",
      label: "Grafik neben dem Text",
      options: [
        { value: "portal", label: "Gezeichnete Vorschau des Kundenportals" },
        { value: "image", label: "Bild aus der Mediathek" },
        { value: "none", label: "Keine Grafik" },
      ],
    },
    imageField(undefined, (v) => v.visual === "image"),
    toneField,
  ],
  text: [
    ...headingFields(),
    {
      kind: "textarea",
      name: "body",
      label: "Text",
      hint: "Für Rechtstexte wie Impressum, Datenschutz und AGB gut geeignet.",
      max: 20_000,
      rows: 12,
      markdown: true,
      optional: "keep",
    },
    {
      kind: "select",
      name: "width",
      label: "Breite",
      options: [
        { value: "narrow", label: "Schmal – angenehm für längere Texte" },
        { value: "wide", label: "Breit" },
      ],
    },
    toneField,
  ],
  cards: [
    ...headingFields(),
    {
      kind: "select",
      name: "columns",
      label: "Kacheln pro Zeile",
      hint: "Auf dem Handy stehen die Kacheln immer untereinander.",
      numeric: true,
      options: [
        { value: "2", label: "2 nebeneinander" },
        { value: "3", label: "3 nebeneinander" },
        { value: "4", label: "4 nebeneinander" },
      ],
    },
    {
      kind: "list",
      name: "items",
      label: "Kacheln",
      itemLabel: "Kachel",
      addLabel: "Kachel hinzufügen",
      max: 24,
      newItem: () => ({ title: "Neue Kachel", text: "" }),
      fields: [
        { kind: "text", name: "title", label: "Überschrift", max: 120 },
        { kind: "textarea", name: "text", label: "Text", max: 1500, rows: 3, markdown: true, optional: "keep" },
        {
          kind: "select",
          name: "icon",
          label: "Symbol",
          emptyLabel: "Kein Symbol",
          iconPreview: true,
          options: ICONS.map((icon) => ({ value: icon, label: ICON_LABELS[icon] })),
        },
        link("link", "Link", "Optional, z. B. „Mehr erfahren“ → /leistungen"),
      ],
    },
    toneField,
  ],
  steps: [
    ...headingFields(),
    {
      kind: "list",
      name: "items",
      label: "Schritte",
      itemLabel: "Schritt",
      addLabel: "Schritt hinzufügen",
      max: 12,
      newItem: () => ({ title: "Neuer Schritt", text: "" }),
      fields: [
        { kind: "text", name: "title", label: "Überschrift", max: 120 },
        { kind: "textarea", name: "text", label: "Text", max: 1500, rows: 3, markdown: true, optional: "keep" },
      ],
    },
    toneField,
  ],
  split: [
    ...headingFields(),
    {
      kind: "list",
      name: "panels",
      label: "Bereiche",
      itemLabel: "Bereich",
      addLabel: "Bereich hinzufügen",
      min: 1,
      max: 3,
      newItem: () => ({ title: "Neuer Bereich", text: "", points: [] }),
      fields: [
        { kind: "text", name: "eyebrow", label: "Dachzeile", max: 60, optional: "omit" },
        { kind: "text", name: "title", label: "Überschrift", max: 160 },
        { kind: "textarea", name: "text", label: "Text", max: 1500, rows: 3, markdown: true, optional: "keep" },
        {
          kind: "stringList",
          name: "points",
          label: "Stichpunkte",
          itemLabel: "Stichpunkt",
          addLabel: "Stichpunkt hinzufügen",
          max: 10,
          maxLength: 200,
        },
        link("link", "Link"),
      ],
    },
    toneField,
  ],
  checklist: [
    ...headingFields(),
    {
      kind: "stringList",
      name: "items",
      label: "Punkte",
      hint: "Jeder Punkt erscheint mit einem Häkchen davor.",
      itemLabel: "Punkt",
      addLabel: "Punkt hinzufügen",
      max: 30,
      maxLength: 300,
    },
    toneField,
  ],
  faq: [
    ...headingFields(),
    {
      kind: "list",
      name: "items",
      label: "Fragen",
      itemLabel: "Frage",
      addLabel: "Frage hinzufügen",
      max: 30,
      newItem: () => ({ question: "Neue Frage", answer: "" }),
      fields: [
        { kind: "text", name: "question", label: "Frage", max: 300 },
        { kind: "textarea", name: "answer", label: "Antwort", max: 4000, rows: 4, markdown: true, optional: "keep" },
      ],
    },
    toneField,
  ],
  responseTimes: [
    ...headingFields(),
    {
      kind: "info",
      text: "Die Tabelle zeigt die Reaktionszeiten aus den Firmendaten.",
      href: "/admin/website/firmendaten",
      linkLabel: "Firmendaten öffnen",
    },
    {
      kind: "textarea",
      name: "note",
      label: "Hinweis unter der Tabelle",
      hint: "Z. B. „Gilt für Firmenkunden mit Betreuungsvertrag innerhalb der Servicezeiten.“",
      max: 500,
      rows: 2,
      optional: "omit",
    },
    toneField,
  ],
  imageText: [
    ...headingFields(),
    { kind: "textarea", name: "body", label: "Text", max: 20_000, rows: 8, markdown: true, optional: "keep" },
    imageField(),
    {
      kind: "select",
      name: "imagePosition",
      label: "Bildposition",
      hint: "Auf dem Handy steht das Bild immer über dem Text.",
      options: [
        { value: "left", label: "Bild links" },
        { value: "right", label: "Bild rechts" },
      ],
    },
    link("link", "Link unter dem Text"),
    toneField,
  ],
  cta: [
    { kind: "text", name: "title", label: "Überschrift", max: 200 },
    { kind: "textarea", name: "text", label: "Text", max: 1000, rows: 3, markdown: true, optional: "omit" },
    link("primary", "Hauptbutton"),
    link("secondary", "Zweiter Button"),
    {
      kind: "checkbox",
      name: "showPhone",
      label: "Telefonnummer anzeigen",
      hint: "Die Nummer kommt aus den Firmendaten.",
    },
    {
      kind: "select",
      name: "tone",
      label: "Hintergrund",
      options: [
        { value: "blue", label: "Hellblau" },
        { value: "dark", label: "Dunkelblau" },
      ],
    },
  ],
  contact: [
    ...headingFields(),
    {
      kind: "info",
      text: "Telefon, E-Mail, Anschrift und Öffnungszeiten kommen aus den Firmendaten.",
      href: "/admin/website/firmendaten",
      linkLabel: "Firmendaten öffnen",
    },
    { kind: "checkbox", name: "showAddress", label: "Anschrift anzeigen" },
    { kind: "checkbox", name: "showHours", label: "Öffnungszeiten anzeigen" },
    toneField,
  ],
  inquiryForm: [
    ...headingFields(),
    {
      kind: "info",
      text: "Abgeschickte Anfragen erscheinen in der Verwaltung unter „Anfragen“. Der Interessent bekommt eine Bestätigung per E-Mail.",
    },
    {
      kind: "select",
      name: "defaultType",
      label: "Vorauswahl im Formular",
      hint: "Gilt, wenn die Seite ohne ?typ= in der Adresse aufgerufen wird.",
      options: [
        { value: "BUSINESS", label: "Unternehmen" },
        { value: "PRIVATE", label: "Privatkunde" },
      ],
    },
    toneField,
  ],
  privateSupportForm: [
    ...headingFields(),
    {
      kind: "info",
      text: "Das Formular legt ein Ticket an. Privatkunden bekommen einen persönlichen Status-Link per E-Mail.",
    },
    toneField,
  ],
  companyInfo: [
    ...headingFields(),
    {
      kind: "select",
      name: "variant",
      label: "Inhalt",
      options: [
        { value: "impressum", label: "Impressum – alle Pflichtangaben" },
        { value: "kontakt", label: "Kurzform – Anschrift und Kontakt" },
      ],
    },
    {
      kind: "info",
      text: "Firmierung, Inhaber, Anschrift, USt-IdNr. und Register kommen aus den Firmendaten.",
      href: "/admin/website/firmendaten",
      linkLabel: "Firmendaten öffnen",
    },
    toneField,
  ],
};

/** Gruppen für die Auswahl „Modul hinzufügen“ */
export const BLOCK_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: "Inhalte", types: ["hero", "text", "imageText", "cards", "steps", "split", "checklist", "faq", "cta"] },
  { label: "Aus den Firmendaten", types: ["contact", "responseTimes", "companyInfo"] },
  { label: "Formulare", types: ["inquiryForm", "privateSupportForm"] },
];

/* ---------------- Neue Module ---------------- */

/** Neues Modul mit sinnvollen Startwerten. */
export function newBlock(type: BlockType): Block {
  const id = newBlockId();
  switch (type) {
    case "hero":
      return { id, type, title: "Überschrift der Seite", text: "", visual: "none", tone: "blue" };
    case "text":
      return { id, type, title: "Überschrift", body: "", width: "narrow", tone: "white" };
    case "cards":
      return {
        id,
        type,
        title: "Überschrift",
        columns: 3,
        items: [
          { title: "Erste Kachel", text: "" },
          { title: "Zweite Kachel", text: "" },
          { title: "Dritte Kachel", text: "" },
        ],
        tone: "white",
      };
    case "steps":
      return {
        id,
        type,
        title: "So läuft es ab",
        items: [
          { title: "Erster Schritt", text: "" },
          { title: "Zweiter Schritt", text: "" },
          { title: "Dritter Schritt", text: "" },
        ],
        tone: "white",
      };
    case "split":
      return {
        id,
        type,
        panels: [
          { title: "Erster Bereich", text: "", points: [] },
          { title: "Zweiter Bereich", text: "", points: [] },
        ],
        tone: "white",
      };
    case "checklist":
      return { id, type, title: "Überschrift", items: [""], tone: "white" };
    case "faq":
      return { id, type, title: "Häufige Fragen", items: [{ question: "Erste Frage", answer: "" }], tone: "white" };
    case "responseTimes":
      return { id, type, title: "Reaktionszeiten", tone: "white" };
    case "imageText":
      return { id, type, title: "Überschrift", body: "", imagePosition: "right", tone: "white" };
    case "cta":
      return {
        id,
        type,
        title: "Überschrift",
        text: "",
        primary: { label: "Kontakt aufnehmen", href: "/kontakt" },
        showPhone: true,
        tone: "blue",
      };
    case "contact":
      return { id, type, title: "Kontakt", showAddress: true, showHours: true, tone: "white" };
    case "inquiryForm":
      return { id, type, title: "Anfrage stellen", defaultType: "BUSINESS", tone: "white" };
    case "privateSupportForm":
      return { id, type, title: "Hilfe anfordern", tone: "white" };
    case "companyInfo":
      return { id, type, title: "Angaben gemäß § 5 DDG", variant: "impressum", tone: "white" };
  }
}

/** Kopie eines Moduls mit neuer id */
export function duplicateBlock(block: Block): Block {
  const copy = JSON.parse(JSON.stringify(block)) as Block;
  return { ...copy, id: newBlockId(), anchor: undefined };
}

/* ---------------- Kurzvorschau ---------------- */

function plain(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`]/g, "")
    .replace(/^\s*-\s+/gm, "")
    .trim();
}

function firstLine(text: unknown): string {
  if (typeof text !== "string") return "";
  const line = text
    .split("\n")
    .map(plain)
    .find((l) => l.length > 0);
  return line ?? "";
}

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()} …` : text;
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Kurzbeschreibung für die zugeklappte Modulkarte */
export function blockSummary(block: Block): string {
  const v = block as Values;
  const headline =
    (typeof v.title === "string" && v.title.trim()) ||
    (typeof v.eyebrow === "string" && v.eyebrow.trim()) ||
    firstLine(v.intro) ||
    firstLine(v.body) ||
    firstLine(v.text);

  let extra = "";
  switch (block.type) {
    case "cards":
      extra = count(block.items.length, "Kachel", "Kacheln");
      break;
    case "steps":
      extra = count(block.items.length, "Schritt", "Schritte");
      break;
    case "split":
      extra = count(block.panels.length, "Bereich", "Bereiche");
      break;
    case "checklist":
      extra = count(block.items.filter((i) => i.trim()).length, "Punkt", "Punkte");
      break;
    case "faq":
      extra = count(block.items.length, "Frage", "Fragen");
      break;
    case "companyInfo":
      extra = block.variant === "impressum" ? "Impressum" : "Kurzform";
      break;
    case "text":
      if (!headline && !block.body.trim()) extra = "noch leer";
      break;
  }
  const parts = [headline ? truncate(headline) : "", extra].filter(Boolean);
  return parts.join(" · ");
}

/* ---------------- Feldbezeichnungen für Fehlermeldungen ---------------- */

const LINK_PARTS: Record<string, string> = { label: "Beschriftung", href: "Ziel" };

function describeIn(defs: FieldDef[], rest: (string | number)[]): string[] {
  if (rest.length === 0) return [];
  const [head, ...tail] = rest;
  if (head === "imageId" || head === "imageAlt") return [head === "imageId" ? "Bild" : "Bildbeschreibung"];
  if (head === "anchor") return ["Sprunganker"];
  const def = defs.find((d) => d.kind !== "info" && d.kind !== "image" && "name" in d && d.name === head);
  if (!def || def.kind === "info" || def.kind === "image") return [String(head)];
  if (def.kind === "link") {
    const part = typeof tail[0] === "string" ? LINK_PARTS[tail[0]] : undefined;
    return part ? [def.label, part] : [def.label];
  }
  if (def.kind === "list") {
    if (typeof tail[0] !== "number") return [def.label];
    return [`${def.itemLabel} ${tail[0] + 1}`, ...describeIn(def.fields, tail.slice(1))];
  }
  if (def.kind === "stringList") {
    if (typeof tail[0] !== "number") return [def.label];
    return [`${def.itemLabel} ${tail[0] + 1}`];
  }
  return [def.label];
}

/** „Kachel 2 › Überschrift“ für einen Pfad innerhalb eines Moduls */
export function describeBlockPath(type: BlockType, rest: (string | number)[]): string {
  return describeIn(BLOCK_FIELDS[type] ?? [], rest).join(" › ");
}

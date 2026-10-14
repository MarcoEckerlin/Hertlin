import "server-only";
import PDFDocument from "pdfkit";
import { SMALL_BUSINESS_NOTE, formatIban, formatTaxRate } from "@/lib/invoices/calc";
import { formatDate, formatMoney, formatQuantity, toDateInput } from "@/lib/format";

/**
 * Rechnungs-PDF (A4, deutsch) mit pdfkit und den Standardschriften (Helvetica).
 * Aufbau nach DIN 5008: Anschriftfeld links (Fensterumschlag), Rechnungsangaben rechts, Positionstabelle mit
 * Seitenumbruch und wiederholtem Tabellenkopf, Summen, Zahlungshinweis, Fußzeile mit Firmen-, Steuer- und Bankangaben
 * und Seitenzahlen auf jeder Seite. Hell und schlicht, Hellblau als Akzent – gut druckbar.
 */

export type InvoicePdfLine = {
  position: number;
  description: string;
  /** z. B. „Ticket T-00042“ */
  reference: string | null;
  performedAt: Date | null;
  quantityHundredths: number;
  unit: string;
  unitPriceCents: number;
  totalCents: number;
};

export type InvoicePdfIssuer = {
  legalName: string;
  owner: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  vatId: string | null;
  taxNumber: string | null;
  register: string | null;
  bank: { holder: string; iban: string; bic: string | null; bankName: string | null } | null;
};

export type InvoicePdfData = {
  kind: "INVOICE" | "CANCELLATION";
  number: string;
  issueDate: Date;
  dueDate: Date;
  servicePeriodStart: Date | null;
  servicePeriodEnd: Date | null;
  customerNumber: string | null;
  recipientName: string;
  /** Anschrift, Zeilen mit \n getrennt */
  recipientAddress: string;
  recipientVatId: string | null;
  /** Bei Stornorechnungen: die stornierte Rechnung */
  cancels: { number: string; issueDate: Date } | null;
  introText: string | null;
  /** Zahlungshinweis (Platzhalter bereits ersetzt) */
  footerText: string | null;
  lines: InvoicePdfLine[];
  netCents: number;
  taxRateBasisPoints: number;
  taxCents: number;
  grossCents: number;
  smallBusiness: boolean;
  issuer: InvoicePdfIssuer;
};

export { SMALL_BUSINESS_NOTE };

/* ------------------------------------------------------------------ */
/* Zeichensatz                                                         */
/* ------------------------------------------------------------------ */

// Die Standardschriften kennen nur Windows-1252. Alles andere wird ersetzt, sonst entstünde Zeichensalat.
const CP1252_EXTRA = new Set("\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178");
const REPLACEMENTS: Record<string, string> = {
  "\u2212": "-", // Minuszeichen
  "\u2010": "-", // Bindestrich
  "\u2011": "-", // geschützter Bindestrich
  "\u2009": " ", // schmales Leerzeichen
  "\u202F": " ", // schmales geschütztes Leerzeichen
  "\u200B": "", // Leerzeichen ohne Breite
  "\u2192": "->",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2248": "~",
  "\u0141": "L",
  "\u0142": "l",
  "\u0110": "D",
  "\u0111": "d",
  "\u0131": "i",
};

function representable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || code === 0x0a || CP1252_EXTRA.has(char);
}

/** Text für die PDF-Standardschriften: Steuerzeichen raus, fremde Zeichen ohne Akzent oder als „?“. */
export function pdfText(value: string): string {
  let out = "";
  for (const char of value.replace(/\r\n?/g, "\n").replace(/\t/g, " ")) {
    if (representable(char)) {
      out += char;
      continue;
    }
    if (char in REPLACEMENTS) {
      out += REPLACEMENTS[char];
      continue;
    }
    const base = char.normalize("NFKD").replace(/\p{M}/gu, "");
    if (base && [...base].every(representable)) out += base;
    else if (!/\p{C}/u.test(char)) out += "?";
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

const PAGE_WIDTH = 595.28;
const LEFT = 64;
const RIGHT = PAGE_WIDTH - 50;
const WIDTH = RIGHT - LEFT;
/** Inhalt endet hier, darunter Seitenzahl und Fußzeile */
const CONTENT_BOTTOM = 738;

const INK = "#10243a";
const SOFT = "#46596e";
const MUTED = "#6b7b8c";
const LINE = "#dde8f1";
const ACCENT = "#66b9ec";
const ACCENT_SOFT = "#e0f1fc";

const REGULAR = "Helvetica";
const BOLD = "Helvetica-Bold";

/** Spalten der Positionstabelle (x = linke Kante) */
const COL = {
  pos: { x: LEFT, w: 26 },
  desc: { x: LEFT + 28, w: 207 },
  qty: { x: LEFT + 237, w: 44 },
  unit: { x: LEFT + 287, w: 52 },
  price: { x: LEFT + 339, w: 66 },
  total: { x: LEFT + 405, w: WIDTH - 405 },
};

function periodText(start: Date | null, end: Date | null): string | null {
  if (!start && !end) return null;
  if (start && end) {
    return toDateInput(start) === toDateInput(end) ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
  }
  return formatDate((start ?? end) as Date);
}

function lineMeta(line: InvoicePdfLine): string {
  return [line.reference, line.performedAt ? formatDate(line.performedAt) : null].filter(Boolean).join(" · ");
}

/** Erzeugt das PDF und gibt es als Buffer zurück. */
export function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const isCancellation = data.kind === "CANCELLATION";
  const title = `${isCancellation ? "Stornorechnung" : "Rechnung"} ${data.number}`;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 20, left: LEFT, right: PAGE_WIDTH - RIGHT },
    bufferPages: true,
    lang: "de-DE",
    displayTitle: true,
    info: {
      Title: pdfText(title),
      Author: pdfText(data.issuer.legalName),
      Subject: pdfText(`${title} an ${data.recipientName}`),
      Creator: "Hertlin Verwaltung",
    },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const text = (value: string, x: number, y: number, options: PDFKit.Mixins.TextOptions = {}) => {
    doc.text(pdfText(value), x, y, options);
  };
  const heightOf = (value: string, width: number) => doc.heightOfString(pdfText(value), { width });
  const hr = (y: number, color = LINE, width = 0.75, from = LEFT, to = RIGHT) => {
    doc.moveTo(from, y).lineTo(to, y).lineWidth(width).strokeColor(color).stroke();
  };

  const issuer = data.issuer;
  const issuerCity = [issuer.zip, issuer.city].filter(Boolean).join(" ");

  /* ---------- Kopf ---------- */

  doc.rect(0, 0, PAGE_WIDTH, 6).fill(ACCENT);
  doc.font(BOLD).fontSize(16).fillColor(INK);
  text(issuer.legalName, LEFT, 44, { width: 280 });

  doc.font(REGULAR).fontSize(8.5).fillColor(SOFT);
  const contact = [issuer.street, issuerCity, issuer.phone ? `Tel. ${issuer.phone}` : "", issuer.email].filter(Boolean);
  text(contact.join("\n"), RIGHT - 200, 44, { width: 200, align: "right", lineGap: 1.5 });

  /* ---------- Anschriftfeld (45 mm von oben) ---------- */

  const addressTop = 128;
  doc.font(REGULAR).fontSize(7).fillColor(MUTED);
  text([issuer.legalName, issuer.street, issuerCity].filter(Boolean).join(" · "), LEFT, addressTop, {
    width: 241,
    height: 9,
    ellipsis: true,
  });
  hr(addressTop + 10, LINE, 0.5, LEFT, LEFT + 241);

  doc.font(REGULAR).fontSize(10).fillColor(INK);
  const recipientLines = [data.recipientName, ...data.recipientAddress.split("\n")].map((l) => l.trim()).filter(Boolean);
  text(recipientLines.join("\n"), LEFT, addressTop + 18, { width: 235, lineGap: 2 });

  /* ---------- Rechnungsangaben rechts ---------- */

  const facts: [string, string][] = [
    [isCancellation ? "Stornorechnung" : "Rechnungsnummer", data.number],
    [isCancellation ? "Datum" : "Rechnungsdatum", formatDate(data.issueDate)],
  ];
  if (data.cancels) facts.push(["Zur Rechnung", `${data.cancels.number} vom ${formatDate(data.cancels.issueDate)}`]);
  if (data.customerNumber) facts.push(["Kundennummer", data.customerNumber]);
  const period = periodText(data.servicePeriodStart, data.servicePeriodEnd);
  if (period) {
    const single = !period.includes("–");
    facts.push([single ? "Leistungsdatum" : "Leistungszeitraum", period]);
  }
  if (!isCancellation) facts.push(["Zahlbar bis", formatDate(data.dueDate)]);
  if (data.recipientVatId) facts.push(["Ihre USt-IdNr.", data.recipientVatId]);

  const factsX = RIGHT - 190;
  let factsY = addressTop;
  for (const [label, value] of facts) {
    doc.font(REGULAR).fontSize(8.5).fillColor(MUTED);
    text(label, factsX, factsY, { width: 82, lineBreak: false });
    doc.font(BOLD).fontSize(8.5).fillColor(INK);
    const h = heightOf(value, 108);
    text(value, factsX + 82, factsY, { width: 108 });
    factsY += Math.max(h, 10) + 4;
  }

  /* ---------- Titel und Einleitung ---------- */

  let y = Math.max(268, factsY + 18, addressTop + 18 + recipientLines.length * 14 + 30);
  doc.font(BOLD).fontSize(16).fillColor(INK);
  text(title, LEFT, y, { width: WIDTH });
  y += 24;
  doc.rect(LEFT, y, 36, 2.5).fill(ACCENT);
  y += 14;

  if (data.cancels) {
    doc.font(REGULAR).fontSize(10).fillColor(INK);
    const sentence = `Hiermit stornieren wir unsere Rechnung ${data.cancels.number} vom ${formatDate(data.cancels.issueDate)} vollständig.`;
    text(sentence, LEFT, y, { width: WIDTH, lineGap: 2 });
    y += heightOf(sentence, WIDTH) + 10;
  }
  if (data.introText?.trim()) {
    doc.font(REGULAR).fontSize(10).fillColor(INK);
    const intro = data.introText.trim();
    text(intro, LEFT, y, { width: WIDTH, lineGap: 2 });
    y += heightOf(intro, WIDTH) + 14;
  }

  /* ---------- Positionstabelle ---------- */

  const tableHeader = () => {
    doc.rect(LEFT, y, WIDTH, 20).fill(ACCENT_SOFT);
    doc.font(BOLD).fontSize(8).fillColor(SOFT);
    const ty = y + 6.5;
    text("Pos.", COL.pos.x + 4, ty, { width: COL.pos.w - 4, lineBreak: false });
    text("Beschreibung", COL.desc.x, ty, { width: COL.desc.w, lineBreak: false });
    text("Menge", COL.qty.x, ty, { width: COL.qty.w, align: "right", lineBreak: false });
    text("Einheit", COL.unit.x, ty, { width: COL.unit.w, lineBreak: false });
    text("Einzelpreis", COL.price.x, ty, { width: COL.price.w, align: "right", lineBreak: false });
    text("Gesamt", COL.total.x, ty, { width: COL.total.w - 4, align: "right", lineBreak: false });
    y += 26;
  };

  const newPage = () => {
    doc.addPage();
    doc.rect(0, 0, PAGE_WIDTH, 6).fill(ACCENT);
    doc.font(REGULAR).fontSize(8.5).fillColor(MUTED);
    text(`${title} – Fortsetzung`, LEFT, 40, { width: WIDTH, lineBreak: false });
    y = 66;
  };

  // Tabellenkopf nicht allein am Seitenende stehen lassen
  if (y + 26 + 40 > CONTENT_BOTTOM) newPage();
  tableHeader();

  for (const line of data.lines) {
    doc.font(REGULAR).fontSize(9);
    const descHeight = heightOf(line.description, COL.desc.w);
    const meta = lineMeta(line);
    doc.fontSize(7.5);
    const metaHeight = meta ? heightOf(meta, COL.desc.w) + 2 : 0;
    doc.fontSize(9);
    const unitHeight = heightOf(line.unit, COL.unit.w);
    const rowHeight = Math.max(descHeight + metaHeight, unitHeight, 11) + 10;

    if (y + rowHeight > CONTENT_BOTTOM) {
      newPage();
      tableHeader();
    }

    doc.font(REGULAR).fontSize(9).fillColor(SOFT);
    text(String(line.position), COL.pos.x + 4, y, { width: COL.pos.w - 4, lineBreak: false });
    doc.fillColor(INK);
    text(line.description, COL.desc.x, y, { width: COL.desc.w });
    if (meta) {
      doc.fontSize(7.5).fillColor(MUTED);
      text(meta, COL.desc.x, y + descHeight + 2, { width: COL.desc.w });
      doc.fontSize(9);
    }
    doc.fillColor(INK);
    text(formatQuantity(line.quantityHundredths), COL.qty.x, y, { width: COL.qty.w, align: "right", lineBreak: false });
    text(line.unit, COL.unit.x + 6, y, { width: COL.unit.w - 6 });
    text(formatMoney(line.unitPriceCents), COL.price.x, y, { width: COL.price.w, align: "right", lineBreak: false });
    doc.font(BOLD);
    text(formatMoney(line.totalCents), COL.total.x, y, { width: COL.total.w - 4, align: "right", lineBreak: false });

    y += rowHeight;
    hr(y - 5);
  }

  /* ---------- Summen ---------- */

  const totalsHeight = data.smallBusiness ? 52 : 70;
  if (y + totalsHeight > CONTENT_BOTTOM) newPage();
  y += 6;
  const labelX = RIGHT - 230;
  const labelW = 150;
  const valueX = RIGHT - 80;
  const valueW = 76;
  const sumRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? BOLD : REGULAR).fontSize(bold ? 10.5 : 9.5).fillColor(INK);
    text(label, labelX, y, { width: labelW, lineBreak: false });
    text(value, valueX, y, { width: valueW, align: "right", lineBreak: false });
    y += bold ? 18 : 15;
  };

  if (data.smallBusiness) {
    hr(y - 2, ACCENT, 1.2, labelX, RIGHT);
    y += 5;
    sumRow("Gesamtbetrag", formatMoney(data.grossCents), true);
  } else {
    sumRow("Nettobetrag", formatMoney(data.netCents));
    sumRow(`zzgl. ${formatTaxRate(data.taxRateBasisPoints)} Umsatzsteuer`, formatMoney(data.taxCents));
    hr(y - 2, ACCENT, 1.2, labelX, RIGHT);
    y += 5;
    sumRow("Gesamtbetrag", formatMoney(data.grossCents), true);
  }

  /* ---------- Hinweise ---------- */

  const notes: string[] = [];
  if (data.smallBusiness) notes.push(SMALL_BUSINESS_NOTE);
  if (data.footerText?.trim()) notes.push(data.footerText.trim());
  if (notes.length > 0) {
    y += 14;
    doc.font(REGULAR).fontSize(10).fillColor(INK);
    for (const note of notes) {
      const h = heightOf(note, WIDTH);
      if (y + h > CONTENT_BOTTOM) newPage();
      text(note, LEFT, y, { width: WIDTH, lineGap: 2 });
      y += h + 8;
    }
  }

  /* ---------- Fußzeile und Seitenzahlen auf jeder Seite ---------- */

  const col1 = [issuer.legalName, issuer.owner ? `Inhaber: ${issuer.owner}` : "", issuer.street, issuerCity].filter(Boolean);
  const col2 = [
    issuer.phone ? `Tel. ${issuer.phone}` : "",
    issuer.email,
    issuer.taxNumber ? `Steuernummer: ${issuer.taxNumber}` : "",
    issuer.vatId ? `USt-IdNr.: ${issuer.vatId}` : "",
    issuer.register ?? "",
  ].filter(Boolean);
  const col3 = issuer.bank
    ? [
        issuer.bank.bankName ?? "",
        `Kontoinhaber: ${issuer.bank.holder}`,
        `IBAN: ${formatIban(issuer.bank.iban)}`,
        issuer.bank.bic ? `BIC: ${issuer.bank.bic}` : "",
      ].filter(Boolean)
    : [];

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Fußzeile liegt im unteren Rand: ohne Rand rechnen, sonst legt pdfkit eine neue Seite an
    doc.page.margins.bottom = 0;
    doc.font(REGULAR).fontSize(8).fillColor(MUTED);
    text(`Seite ${i - range.start + 1} von ${range.count}`, LEFT, 748, { width: WIDTH, align: "right", lineBreak: false });
    hr(762, LINE, 0.75);
    doc.font(REGULAR).fontSize(7).fillColor(SOFT);
    const colW = (WIDTH - 20) / 3;
    const footer = { width: colW, lineGap: 1, height: 64, ellipsis: true };
    text(col1.join("\n"), LEFT, 769, footer);
    text(col2.join("\n"), LEFT + colW + 10, 769, footer);
    text(col3.join("\n"), LEFT + 2 * (colW + 10), 769, footer);
  }

  doc.end();
  return done;
}

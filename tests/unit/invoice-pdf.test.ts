import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { pdfText, renderInvoicePdf, SMALL_BUSINESS_NOTE, type InvoicePdfData } from "@/lib/invoices/pdf";
import { invoiceAmounts } from "@/lib/invoices/calc";

/** pdftotext (poppler) ist auf vielen Systemen vorhanden – sonst prüfen wir nur den Dateikopf. */
function pdfToText(pdf: Buffer): string | null {
  try {
    return execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", "-", "-"], { input: pdf }).toString("utf8");
  } catch {
    return null;
  }
}

const issuer: InvoicePdfData["issuer"] = {
  legalName: "Hertlin IT-Service GmbH",
  owner: "Anna Hertlin",
  street: "Hauptstraße 21",
  zip: "12345",
  city: "Musterstadt",
  phone: "01234 98760",
  email: "info@hertlin.de",
  vatId: "DE123456789",
  taxNumber: "12/345/67890",
  register: "Amtsgericht Musterstadt, HRB 12345",
  bank: { holder: "Hertlin IT-Service GmbH", iban: "DE89370400440532013000", bic: "COBADEFFXXX", bankName: "Commerzbank" },
};

function sample(overrides: Partial<InvoicePdfData> = {}, lineCount = 3): InvoicePdfData {
  const lines = Array.from({ length: lineCount }, (_, i) => ({
    position: i + 1,
    description: i === 0 ? "Trommeleinheit Kyocera DK-1150 – getauscht, Testdruck ok" : `Arbeitszeit Technik, Einsatz ${i + 1}`,
    reference: "Ticket T-00042",
    performedAt: new Date(Date.UTC(2026, 9, 12, 12)),
    quantityHundredths: i === 0 ? 100 : 150,
    unit: i === 0 ? "Stk." : "Std.",
    unitPriceCents: i === 0 ? 8990 : 9500,
    totalCents: i === 0 ? 8990 : 14250,
  }));
  const amounts = invoiceAmounts(
    lines.map((l) => l.totalCents),
    { taxRateBasisPoints: 1900, smallBusiness: false },
  );
  return {
    kind: "INVOICE",
    number: "RE-2026-0001",
    issueDate: new Date(Date.UTC(2026, 9, 14, 9)),
    dueDate: new Date(Date.UTC(2026, 9, 28, 12)),
    servicePeriodStart: new Date(Date.UTC(2026, 9, 1, 12)),
    servicePeriodEnd: new Date(Date.UTC(2026, 9, 12, 12)),
    customerNumber: "K-1001",
    recipientName: "Muster Steuerberatung GmbH",
    recipientAddress: "Beispielweg 12\n12345 Musterstadt",
    recipientVatId: "DE987654321",
    cancels: null,
    introText: "Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen die folgenden Leistungen:",
    footerText: "Bitte überweisen Sie 1.234,56 € bis zum 28.10.2026.",
    lines,
    ...amounts,
    issuer,
    ...overrides,
  };
}

describe("Rechnungs-PDF", () => {
  it("erzeugt ein gültiges PDF mit allen Pflichtangaben", async () => {
    const pdf = await renderInvoicePdf(sample());
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");

    const text = pdfToText(pdf);
    if (text === null) return;
    for (const expected of [
      "Rechnung RE-2026-0001",
      "Hertlin IT-Service GmbH",
      "Muster Steuerberatung GmbH",
      "Beispielweg 12",
      "Kundennummer",
      "K-1001",
      "Leistungszeitraum",
      "01.10.2026 – 12.10.2026",
      "Trommeleinheit Kyocera DK-1150 – getauscht",
      "Ticket T-00042 · 12.10.2026",
      "Nettobetrag",
      "zzgl. 19 % Umsatzsteuer",
      "Gesamtbetrag",
      "Steuernummer: 12/345/67890",
      "USt-IdNr.: DE123456789",
      "IBAN: DE89 3704 0044 0532 0130 00",
      "Amtsgericht Musterstadt, HRB 12345",
      "Seite 1 von 1",
      "Hauptstraße",
    ]) {
      expect(text, expected).toContain(expected);
    }
    // 89,90 + 142,50 + 142,50 = 374,90 € netto, 71,23 € USt, 446,13 € brutto
    expect(text).toContain("374,90 €");
    expect(text).toContain("71,23 €");
    expect(text).toContain("446,13 €");
  });

  it("bricht lange Tabellen auf mehrere Seiten um und nummeriert die Seiten", async () => {
    const pdf = await renderInvoicePdf(sample({}, 60));
    const text = pdfToText(pdf);
    if (text === null) return;
    const pages = text.split("\f").filter((p) => p.trim());
    expect(pages.length).toBeGreaterThan(1);
    expect(text).toContain(`Seite ${pages.length} von ${pages.length}`);
    // Tabellenkopf auf jeder Seite mit Positionen
    for (const page of pages.slice(0, -1)) expect(page).toContain("Einzelpreis");
    expect(text).toContain("Rechnung RE-2026-0001 – Fortsetzung");
  });

  it("Kleinunternehmer: ohne Umsatzsteuer, mit Hinweis nach § 19 UStG", async () => {
    const pdf = await renderInvoicePdf(
      sample({ smallBusiness: true, taxRateBasisPoints: 0, taxCents: 0, netCents: 8990, grossCents: 8990 }, 1),
    );
    const text = pdfToText(pdf);
    if (text === null) return;
    expect(text).toContain(SMALL_BUSINESS_NOTE);
    expect(text).not.toContain("Umsatzsteuer berechnet: 19");
    expect(text).not.toContain("zzgl.");
  });

  it("Stornorechnung: eigener Titel, Bezug auf die Originalrechnung, negative Beträge", async () => {
    const original = sample();
    const pdf = await renderInvoicePdf({
      ...original,
      kind: "CANCELLATION",
      number: "RE-2026-0002",
      cancels: { number: "RE-2026-0001", issueDate: original.issueDate },
      introText: null,
      footerText: null,
      lines: original.lines.map((l) => ({ ...l, unitPriceCents: -l.unitPriceCents, totalCents: -l.totalCents })),
      netCents: -original.netCents,
      taxCents: -original.taxCents,
      grossCents: -original.grossCents,
    });
    const text = pdfToText(pdf);
    if (text === null) return;
    expect(text).toContain("Stornorechnung RE-2026-0002");
    expect(text).toContain("Hiermit stornieren wir unsere Rechnung RE-2026-0001 vom 14.10.2026");
    expect(text).toContain("-446,13 €");
    expect(text).not.toContain("Zahlbar bis");
  });

  it("ersetzt Zeichen, die die Standardschrift nicht kennt", () => {
    expect(pdfText("Größe – 5 € „gut“")).toBe("Größe – 5 € „gut“");
    expect(pdfText("Łódź")).toBe("Lódz");
    expect(pdfText("Ελλάδα")).toBe("??????");
    expect(pdfText("Crème brûlée")).toBe("Crème brûlée");
    expect(pdfText("a\u2212b\u202Fc")).toBe("a-b c");
    expect(pdfText("Smiley \u{1F642} ok")).toBe("Smiley ? ok");
    expect(pdfText("Zeile\r\nzwei")).toBe("Zeile\nzwei");
  });
});

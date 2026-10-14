import { describe, expect, it } from "vitest";
import {
  addDaysToInput,
  cancellationAmounts,
  dateFromInput,
  divideRounded,
  fillPlaceholders,
  formatIban,
  formatInvoiceNumber,
  formatTaxRate,
  invoiceAmounts,
  isDateInput,
  isValidBic,
  isValidIban,
  nextSequence,
  parseTaxRate,
  taxOf,
  taxRateToInput,
  unknownPlaceholders,
} from "@/lib/invoices/calc";
import { DEFAULT_BILLING_SETTINGS, billingProblems, type IssuerSiteData } from "@/lib/invoices/settings-schema";
import { adminInvoiceStatus, customerInvoiceStatus, daysOverdue, isUnpaid } from "@/lib/invoices/status";
import { formatDate } from "@/lib/format";

describe("Rechnungsnummer", () => {
  it("vierstellig je Jahr mit Präfix", () => {
    expect(formatInvoiceNumber("RE", 2026, 1)).toBe("RE-2026-0001");
    expect(formatInvoiceNumber("RE", 2026, 42)).toBe("RE-2026-0042");
    expect(formatInvoiceNumber("AR", 2027, 9999)).toBe("AR-2027-9999");
    expect(formatInvoiceNumber("RE", 2027, 10000)).toBe("RE-2027-10000");
  });

  it("zählt im Jahr fortlaufend weiter und beginnt in einem neuen Jahr bei 1", () => {
    expect(nextSequence(null)).toBe(1);
    expect(nextSequence(undefined)).toBe(1);
    expect(nextSequence(0)).toBe(1);
    expect(nextSequence(41)).toBe(42);
  });
});

describe("Beträge und Steuer", () => {
  it("rundet kaufmännisch mit ganzen Zahlen", () => {
    expect(divideRounded(5, 2)).toBe(3);
    expect(divideRounded(4, 2)).toBe(2);
    expect(divideRounded(149, 100)).toBe(1);
    expect(divideRounded(150, 100)).toBe(2);
    expect(divideRounded(-150, 100)).toBe(-2);
    expect(divideRounded(-149, 100)).toBe(-1);
    expect(() => divideRounded(1.5, 2)).toThrow();
    expect(() => divideRounded(1, 0)).toThrow();
  });

  it("berechnet die Umsatzsteuer auf die Nettosumme", () => {
    // 162,49 € × 19 % = 30,8731 € → 30,87 €
    expect(taxOf(16_249, 1900)).toBe(3087);
    // 0,50 € × 19 % = 0,095 € → 0,10 € (ab ,5 aufrunden)
    expect(taxOf(50, 1900)).toBe(10);
    // 0,02 € × 19 % = 0,0038 € → 0,00 €
    expect(taxOf(2, 1900)).toBe(0);
    // 7 % auf 1.000,00 €
    expect(taxOf(100_000, 700)).toBe(7000);
    // 1,05 € × 19 % = 0,1995 € → 0,20 € (kein Gleitkomma-Fehler)
    expect(taxOf(105, 1900)).toBe(20);
  });

  it("Steuer einmal auf die Summe, nicht je Position", () => {
    // Je Position gerundet wären es 3 × 0,10 € = 0,30 €; auf die Summe 1,50 € × 19 % = 0,285 € → 0,29 €
    const amounts = invoiceAmounts([50, 50, 50], { taxRateBasisPoints: 1900, smallBusiness: false });
    expect(amounts).toEqual({ netCents: 150, taxRateBasisPoints: 1900, taxCents: 29, grossCents: 179, smallBusiness: false });
  });

  it("Beispiel aus den Testdaten: 142,50 € + 19,99 €", () => {
    const amounts = invoiceAmounts([14_250, 1999], { taxRateBasisPoints: 1900, smallBusiness: false });
    expect(amounts.netCents).toBe(16_249);
    expect(amounts.taxCents).toBe(3087);
    expect(amounts.grossCents).toBe(19_336);
  });

  it("Kleinunternehmer: keine Umsatzsteuer, Satz 0", () => {
    const amounts = invoiceAmounts([14_250, 1999], { taxRateBasisPoints: 1900, smallBusiness: true });
    expect(amounts).toEqual({ netCents: 16_249, taxRateBasisPoints: 0, taxCents: 0, grossCents: 16_249, smallBusiness: true });
  });

  it("Stornorechnung: exakt die negierten Beträge, Summe beider = 0", () => {
    const original = invoiceAmounts([14_250, 1999], { taxRateBasisPoints: 1900, smallBusiness: false });
    const storno = cancellationAmounts(original);
    expect(storno.netCents).toBe(-16_249);
    expect(storno.taxCents).toBe(-3087);
    expect(storno.grossCents).toBe(-19_336);
    expect(storno.taxRateBasisPoints).toBe(1900);
    expect(original.grossCents + storno.grossCents).toBe(0);
  });

  it("Steuersatz eingeben und anzeigen", () => {
    expect(parseTaxRate("19")).toBe(1900);
    expect(parseTaxRate("19,5")).toBe(1950);
    expect(parseTaxRate(" 7 % ")).toBe(700);
    expect(parseTaxRate("0")).toBe(0);
    expect(parseTaxRate("100")).toBe(10_000);
    expect(parseTaxRate("101")).toBeNull();
    expect(parseTaxRate("-5")).toBeNull();
    expect(parseTaxRate("abc")).toBeNull();
    expect(parseTaxRate("19,555")).toBeNull();
    expect(formatTaxRate(1900)).toBe("19 %");
    expect(formatTaxRate(1950)).toBe("19,5 %");
    expect(taxRateToInput(1900)).toBe("19");
    expect(taxRateToInput(1950)).toBe("19,5");
  });
});

describe("Platzhalter", () => {
  it("ersetzt bekannte Platzhalter und lässt unbekannte stehen", () => {
    const text = fillPlaceholders("Bitte {betrag} bis {faellig} zahlen ({nummer}). {unbekannt}", {
      betrag: "193,36 €",
      faellig: "28.10.2026",
      nummer: "RE-2026-0001",
    });
    expect(text).toBe("Bitte 193,36 € bis 28.10.2026 zahlen (RE-2026-0001). {unbekannt}");
  });

  it("findet Tippfehler in Platzhaltern", () => {
    expect(unknownPlaceholders("Fällig am {fällig}, Nummer {nummer}, {Betrag}")).toEqual(["{fällig}", "{Betrag}"]);
    expect(unknownPlaceholders(DEFAULT_BILLING_SETTINGS.paymentNote)).toEqual([]);
    expect(unknownPlaceholders(DEFAULT_BILLING_SETTINGS.emailSubject)).toEqual([]);
    expect(unknownPlaceholders(DEFAULT_BILLING_SETTINGS.emailText)).toEqual([]);
  });
});

describe("Bankverbindung", () => {
  it("prüft die IBAN-Prüfziffer", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("de89370400440532013000")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 01")).toBe(false);
    expect(isValidIban("DE89 3704 0044 0532 0130")).toBe(false);
    expect(isValidIban("AT61 1904 3002 3457 3201")).toBe(true);
    expect(isValidIban("")).toBe(false);
    expect(formatIban("de89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });

  it("prüft den BIC", () => {
    expect(isValidBic("COBADEFFXXX")).toBe(true);
    expect(isValidBic("cobadeff")).toBe(true);
    expect(isValidBic("COBADE")).toBe(false);
  });
});

describe("Kalendertage", () => {
  it("speichert Tage als 12:00 UTC – in deutscher Zeit immer derselbe Tag", () => {
    expect(dateFromInput("2026-03-29").toISOString()).toBe("2026-03-29T12:00:00.000Z");
    expect(formatDate(dateFromInput("2026-03-29"))).toBe("29.03.2026");
    expect(formatDate(dateFromInput("2026-10-25"))).toBe("25.10.2026");
    expect(formatDate(dateFromInput("2026-12-31"))).toBe("31.12.2026");
  });

  it("Zahlungsziel über Monats- und Jahresgrenzen", () => {
    expect(addDaysToInput("2026-10-14", 14)).toBe("2026-10-28");
    expect(addDaysToInput("2026-12-25", 14)).toBe("2027-01-08");
    expect(addDaysToInput("2028-02-20", 10)).toBe("2028-03-01");
    expect(addDaysToInput("2026-10-14", 0)).toBe("2026-10-14");
  });

  it("prüft Datumseingaben", () => {
    expect(isDateInput("2026-02-28")).toBe(true);
    expect(isDateInput("2026-02-29")).toBe(false);
    expect(isDateInput("2026-13-01")).toBe(false);
    expect(isDateInput("14.10.2026")).toBe(false);
  });
});

describe("Pflichtangaben für Rechnungen", () => {
  const site: IssuerSiteData = {
    name: "Hertlin",
    legalName: "Hertlin IT-Service",
    owner: "Anna Hertlin",
    street: "Hauptstraße 21",
    zip: "12345",
    city: "Musterstadt",
    phone: "01234 98760",
    email: "info@hertlin.de",
    vatId: "TODO USt-IdNr.",
    register: "",
  };
  const complete = { ...DEFAULT_BILLING_SETTINGS, taxNumber: "12/345/67890", iban: "DE89370400440532013000" };

  it("vollständig: keine Probleme", () => {
    expect(billingProblems(complete, site)).toEqual([]);
  });

  it("Platzhalter in den Firmendaten, keine Steuernummer, keine IBAN", () => {
    const problems = billingProblems(DEFAULT_BILLING_SETTINGS, { ...site, street: "TODO Straße", city: "" });
    expect(problems.map((p) => p.message).join(" ")).toContain("Straße und Hausnummer, Ort");
    expect(problems.some((p) => p.message.includes("Steuernummer oder Ihre USt-IdNr."))).toBe(true);
    expect(problems.some((p) => p.message.includes("IBAN"))).toBe(true);
    expect(problems[0].href).toBe("/admin/website/firmendaten");
  });

  it("USt-IdNr. aus den Firmendaten genügt statt Steuernummer", () => {
    expect(billingProblems({ ...complete, taxNumber: "" }, { ...site, vatId: "DE123456789" })).toEqual([]);
  });

  it("ungültige IBAN", () => {
    const problems = billingProblems({ ...complete, iban: "DE00370400440532013000" }, site);
    expect(problems.map((p) => p.message)).toEqual(["Die hinterlegte IBAN ist ungültig."]);
  });
});

describe("Stand einer Rechnung", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  const due = dateFromInput("2026-10-28");

  it("überfällig erst nach dem Fälligkeitstag", () => {
    expect(daysOverdue({ kind: "INVOICE", status: "SENT", dueDate: due }, new Date("2026-10-28T21:00:00Z"))).toBe(0);
    expect(daysOverdue({ kind: "INVOICE", status: "SENT", dueDate: due }, now)).toBe(2);
    expect(daysOverdue({ kind: "INVOICE", status: "PAID", dueDate: due }, now)).toBe(0);
    expect(daysOverdue({ kind: "CANCELLATION", status: "OPEN", dueDate: due }, now)).toBe(0);
  });

  it("Bezeichnungen für Verwaltung und Kunden", () => {
    expect(adminInvoiceStatus({ kind: "INVOICE", status: "OPEN", dueDate: due }, new Date("2026-10-20T10:00:00Z")).label).toBe(
      "Noch nicht versendet",
    );
    expect(adminInvoiceStatus({ kind: "INVOICE", status: "SENT", dueDate: due }, now)).toEqual({ label: "Überfällig", tone: "red" });
    expect(adminInvoiceStatus({ kind: "INVOICE", status: "CANCELLED", dueDate: due }, now).label).toBe("Storniert");
    expect(customerInvoiceStatus({ kind: "INVOICE", status: "SENT", dueDate: due }, new Date("2026-10-20T10:00:00Z")).label).toBe(
      "Offen",
    );
    expect(customerInvoiceStatus({ kind: "INVOICE", status: "PAID", dueDate: due }, now).label).toBe("Bezahlt");
    expect(customerInvoiceStatus({ kind: "CANCELLATION", status: "SENT", dueDate: due }, now).label).toBe("Stornorechnung");
    expect(isUnpaid({ kind: "INVOICE", status: "OPEN" })).toBe(true);
    expect(isUnpaid({ kind: "INVOICE", status: "CANCELLED" })).toBe(false);
  });
});

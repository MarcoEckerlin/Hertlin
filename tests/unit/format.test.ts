import { describe, expect, it } from "vitest";
import {
  centsToInput,
  formatMoney,
  formatQuantity,
  formatTicketNumber,
  lineTotalCents,
  parseMoney,
  parseQuantity,
  parseTicketNumber,
} from "@/lib/format";

describe("Geldbeträge", () => {
  it("liest deutsche und englische Schreibweisen", () => {
    expect(parseMoney("95")).toBe(9500);
    expect(parseMoney("95,50")).toBe(9550);
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("89,90 €")).toBe(8990);
  });

  it("lehnt Unsinn ab", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("1,234")).toBeNull();
  });

  it("formatiert in Euro", () => {
    expect(formatMoney(123456).replace(/\s/g, " ")).toBe("1.234,56 €");
    expect(centsToInput(9550)).toBe("95,50");
  });
});

describe("Mengen", () => {
  it("rechnet in Hundertsteln", () => {
    expect(parseQuantity("1,25")).toBe(125);
    expect(parseQuantity("0.5")).toBe(50);
    expect(parseQuantity("2")).toBe(200);
    expect(parseQuantity("1,234")).toBeNull();
    expect(formatQuantity(125)).toBe("1,25");
  });

  it("berechnet Positionssummen ohne Rundungsfehler", () => {
    expect(lineTotalCents(125, 9500)).toBe(11875);
    expect(lineTotalCents(33, 9500)).toBe(3135);
    expect(lineTotalCents(100, 8990)).toBe(8990);
  });
});

describe("Ticketnummern", () => {
  it("formatiert und liest Ticketnummern", () => {
    expect(formatTicketNumber(42)).toBe("T-00042");
    expect(parseTicketNumber("T-00042")).toBe(42);
    expect(parseTicketNumber("t42")).toBe(42);
    expect(parseTicketNumber("42")).toBe(42);
    expect(parseTicketNumber("X-42")).toBeNull();
  });
});

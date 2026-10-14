import { describe, expect, it } from "vitest";
import {
  catalogPriceFor,
  cleanName,
  composeCostDescription,
  costBlockMessage,
  costEditBlock,
  groupPresetsForPicker,
  parsePriceField,
  parseQuantityField,
  presetMatchesQuery,
  presetNameKey,
  quantityToInput,
  resolveUnitPrice,
  toCostKind,
} from "@/lib/cost-catalog";

describe("Katalog: Bezeichnung und Dubletten-Schlüssel", () => {
  it("fasst Leerzeichen zusammen und schreibt klein", () => {
    expect(presetNameKey("  Anfahrt   STADTGEBIET ")).toBe("anfahrt stadtgebiet");
    expect(presetNameKey("Arbeitszeit\tTechnik\n")).toBe("arbeitszeit technik");
  });

  it("passt zu den Schlüsseln der Startpositionen aus der Migration", () => {
    expect(presetNameKey("Fahrtkosten je Kilometer")).toBe("fahrtkosten je kilometer");
    expect(presetNameKey("Material nach Beleg")).toBe("material nach beleg");
  });

  it("behandelt Umlaute und Unicode-Schreibweisen gleich", () => {
    // „Ü“ als ein Zeichen und als U + Trema
    expect(presetNameKey("Überprüfung")).toBe(presetNameKey("Überprüfung"));
    expect(presetNameKey("ÜBERPRÜFUNG")).toBe("überprüfung");
  });

  it("räumt die Anzeige-Bezeichnung auf, ohne die Schreibweise zu ändern", () => {
    expect(cleanName("  Netzteil   Dell 90 W ")).toBe("Netzteil Dell 90 W");
  });

  it("hängt die Notiz mit Gedankenstrich an", () => {
    expect(composeCostDescription("Arbeitszeit Technik", "Trommel getauscht")).toBe("Arbeitszeit Technik – Trommel getauscht");
    expect(composeCostDescription("Arbeitszeit Technik", "   ")).toBe("Arbeitszeit Technik");
    expect(composeCostDescription("Anfahrt Stadtgebiet", null)).toBe("Anfahrt Stadtgebiet");
  });

  it("macht aus unbekannten Arten eine Pauschale", () => {
    expect(toCostKind("TRAVEL")).toBe("TRAVEL");
    expect(toCostKind("SONSTWAS")).toBe("FLAT");
  });
});

describe("Eingaben in deutscher Schreibweise", () => {
  it("liest Mengen mit Komma", () => {
    expect(parseQuantityField("1,25")).toEqual({ ok: true, value: 125 });
    expect(parseQuantityField("0,5")).toEqual({ ok: true, value: 50 });
    expect(parseQuantityField("")).toMatchObject({ ok: false });
    expect(parseQuantityField("0")).toMatchObject({ ok: false, error: "Die Menge muss größer als 0 sein." });
    expect(parseQuantityField("1,255")).toMatchObject({ ok: false });
  });

  it("liest Preise mit Tausenderpunkt; leer ist nur erlaubt, wenn optional", () => {
    expect(parsePriceField("1.234,50", { required: false })).toEqual({ ok: true, value: 123450 });
    expect(parsePriceField("", { required: false })).toEqual({ ok: true, value: null });
    expect(parsePriceField("", { required: true })).toMatchObject({ ok: false });
    expect(parsePriceField("abc", { required: false })).toMatchObject({ ok: false });
    expect(parsePriceField("0", { required: true })).toEqual({ ok: true, value: 0 });
  });

  it("schreibt Mengen so zurück, dass sie wieder eingelesen werden können", () => {
    expect(quantityToInput(2000)).toBe("20");
    expect(quantityToInput(125)).toBe("1,25");
    expect(parseQuantityField(quantityToInput(123456)).ok).toBe(true);
  });
});

describe("Preis einer neuen Position", () => {
  const arbeitszeit = { unit: "Std.", unitPriceCents: 9500 };
  const materialNachBeleg = { unit: "Stk.", unitPriceCents: null };

  it("Techniker: Katalogpreis, Eingaben werden ignoriert", () => {
    expect(resolveUnitPrice({ canSetPrice: false, inputCents: 1, preset: arbeitszeit, unit: "Std." })).toEqual({
      unitPriceCents: 9500,
      needsPrice: false,
      source: "catalog",
    });
  });

  it("Techniker ohne Katalogpreis: Preis fehlt, Betrag 0", () => {
    expect(resolveUnitPrice({ canSetPrice: false, inputCents: 5000, preset: materialNachBeleg, unit: "Stk." })).toEqual({
      unitPriceCents: 0,
      needsPrice: true,
      source: "missing",
    });
    expect(resolveUnitPrice({ canSetPrice: false, inputCents: null, preset: null, unit: "Stk." }).needsPrice).toBe(true);
  });

  it("Techniker mit anderer Einheit als im Katalog: kein Katalogpreis", () => {
    expect(resolveUnitPrice({ canSetPrice: false, inputCents: null, preset: arbeitszeit, unit: "Min." }).needsPrice).toBe(true);
    expect(catalogPriceFor(arbeitszeit, "Min.")).toBeNull();
    expect(catalogPriceFor(arbeitszeit, "Std.")).toBe(9500);
  });

  it("Administrator: es gilt der eingegebene Preis, auch abweichend vom Katalog und auch 0", () => {
    expect(resolveUnitPrice({ canSetPrice: true, inputCents: 12000, preset: arbeitszeit, unit: "Std." })).toMatchObject({
      unitPriceCents: 12000,
      needsPrice: false,
      source: "input",
    });
    expect(resolveUnitPrice({ canSetPrice: true, inputCents: 0, preset: null, unit: "Stk." }).needsPrice).toBe(false);
  });

  it("Administrator mit leerem Preisfeld: Preis steht noch nicht fest", () => {
    expect(resolveUnitPrice({ canSetPrice: true, inputCents: null, preset: arbeitszeit, unit: "Std." })).toMatchObject({
      unitPriceCents: 0,
      needsPrice: true,
    });
  });
});

describe("Rechte an einer Position", () => {
  const admin = { id: "admin", role: "ADMIN" };
  const tech = { id: "tech", role: "TECHNICIAN" };
  const own = { createdById: "tech", billed: false, invoiceId: null };

  it("Techniker ändern eigene, offene Positionen", () => {
    expect(costEditBlock(tech, own)).toBeNull();
  });

  it("Techniker ändern keine fremden oder abgerechneten Positionen", () => {
    expect(costEditBlock(tech, { ...own, createdById: "admin" })).toBe("foreign");
    expect(costEditBlock(tech, { ...own, createdById: null })).toBe("foreign");
    expect(costEditBlock(tech, { ...own, billed: true })).toBe("billed");
  });

  it("Administratoren ändern alles, auch von Hand abgerechnete Positionen", () => {
    expect(costEditBlock(admin, { ...own, billed: true })).toBeNull();
    expect(costEditBlock(admin, { ...own, createdById: "jemand" })).toBeNull();
  });

  it("Positionen auf einer Rechnung sind für alle gesperrt", () => {
    const invoiced = { ...own, billed: true, invoiceId: "inv1" };
    expect(costEditBlock(admin, invoiced)).toBe("invoice");
    expect(costEditBlock(tech, invoiced)).toBe("invoice");
    expect(costBlockMessage("invoice", "RE-2026-0001")).toContain("RE-2026-0001");
  });

  it("Kunden dürfen nie", () => {
    expect(costEditBlock({ id: "k", role: "CUSTOMER_ADMIN" }, { ...own, createdById: "k" })).toBe("role");
  });
});

describe("Auswahl im Ticket", () => {
  const presets = [
    { id: "a", kind: "LABOR", name: "Arbeitszeit Technik", usageCount: 2, lastUsedAt: "2026-10-01T10:00:00.000Z", sortOrder: 10 },
    { id: "b", kind: "LABOR", name: "Fernwartung", usageCount: 9, lastUsedAt: "2026-09-01T10:00:00.000Z", sortOrder: 20 },
    { id: "c", kind: "TRAVEL", name: "Anfahrt Stadtgebiet", usageCount: 0, lastUsedAt: null, sortOrder: 30 },
    { id: "d", kind: "LABOR", name: "Einrichtung", usageCount: 2, lastUsedAt: "2026-10-05T10:00:00.000Z", sortOrder: 5 },
    { id: "e", kind: "MATERIAL", name: "Netzwerkkabel Cat. 6", usageCount: 0, lastUsedAt: null, sortOrder: 0 },
  ];

  it("gruppiert nach Art in fester Reihenfolge, häufig und zuletzt benutzte zuerst", () => {
    const groups = groupPresetsForPicker(presets);
    expect(groups.map((g) => g.label)).toEqual(["Arbeitszeit", "Anfahrt", "Material"]);
    expect(groups[0].presets.map((p) => p.id)).toEqual(["b", "d", "a"]);
  });

  it("sucht nach allen Wörtern in Bezeichnung und Art", () => {
    expect(presetMatchesQuery(presets[2], "anfahrt")).toBe(true);
    expect(presetMatchesQuery(presets[4], "kabel cat")).toBe(true);
    expect(presetMatchesQuery(presets[4], "material")).toBe(true);
    expect(presetMatchesQuery(presets[4], "kabel ulm")).toBe(false);
    expect(presetMatchesQuery(presets[0], "  ")).toBe(true);
  });
});

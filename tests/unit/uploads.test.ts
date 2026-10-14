import { describe, expect, it } from "vitest";
import { safeFileName } from "@/lib/uploads";

describe("safeFileName", () => {
  it("lässt normale Dateinamen unverändert", () => {
    expect(safeFileName("Rechnung März 2026.pdf")).toBe("Rechnung März 2026.pdf");
    expect(safeFileName("Foto_Drucker (1).jpg")).toBe("Foto_Drucker (1).jpg");
  });

  it("entfernt Formatzeichen, die die Endung verschleiern", () => {
    // U+202E dreht die Schreibrichtung: angezeigt würde „Rechnungslx.pdf“
    expect(safeFileName("Rechnung‮fdp.xls")).toBe("Rechnungfdp.xls");
    expect(safeFileName("bild⁦⁩.png")).toBe("bild.png");
    expect(safeFileName("a​b.txt")).toBe("ab.txt");
  });

  it("ersetzt Steuerzeichen, Pfadangaben und reservierte Zeichen", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("a\u0000b\u0085c.txt")).toBe("a_b_c.txt");
    expect(safeFileName('x<y>:"z".pdf')).toBe("x_y_z_.pdf");
    expect(safeFileName("zeile zwei.txt")).toBe("zeile_zwei.txt");
  });

  it("nimmt den Ersatznamen, wenn nichts übrig bleibt", () => {
    expect(safeFileName("‮")).toBe("datei");
    expect(safeFileName("   ", "bild")).toBe("bild");
  });
});

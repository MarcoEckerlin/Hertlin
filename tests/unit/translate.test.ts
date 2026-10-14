import { describe, expect, it } from "vitest";
import { addsContactData, contactTokens } from "@/lib/translate";

describe("contactTokens", () => {
  it("findet Telefonnummern, Links und E-Mail-Adressen", () => {
    const tokens = contactTokens("Rufen Sie an: 0711 123 456 78, schreiben Sie an support@hertlin.de oder besuchen Sie https://hertlin.de/kontakt.");
    expect(tokens).toEqual(new Set(["tel:4971112345678", "mail:support@hertlin.de", "url:https://hertlin.de/kontakt"]));
  });

  it("zählt Datumsangaben und kurze Zahlen nicht als Nummer", () => {
    expect(contactTokens("Am 01.10.2026 von 8:00 bis 17:00 Uhr, 30 Minuten, Ticket T-00042")).toEqual(new Set());
  });
});

describe("addsContactData", () => {
  it("akzeptiert normale Übersetzungen, auch mit anders geschriebener Nummer", () => {
    expect(addsContactData("Rufen Sie uns an: 0711 12345678", "Call us: 0711 12345678")).toBe(false);
    expect(addsContactData("Rufen Sie uns an: 0711 12345678", "Call us: +49 711 12345678")).toBe(false);
    expect(addsContactData("Termin am 01.10.2026", "Appointment on 01/10/2026")).toBe(false);
    expect(addsContactData("Mehr unter www.hertlin.de.", "More at www.hertlin.de.")).toBe(false);
  });

  it("erkennt eingeschmuggelte Nummern, Links und Adressen", () => {
    expect(addsContactData("Rufen Sie uns an: 0711 12345678", "Call us: +44 20 7946 0958")).toBe(true);
    expect(addsContactData("Hier finden Sie die Fernwartung.", "Remote support: https://evil.example/qs")).toBe(true);
    expect(addsContactData("Schreiben Sie uns.", "Write to billing@evil.example.")).toBe(true);
  });
});

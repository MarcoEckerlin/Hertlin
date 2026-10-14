import { describe, expect, it } from "vitest";
import { guestGreeting } from "@/lib/guest-mail";

describe("guestGreeting", () => {
  it("spricht mit Namen an, wenn es ein Name ist", () => {
    expect(guestGreeting("Petra Müller")).toBe("Guten Tag Petra Müller,");
    expect(guestGreeting("  Dr. Jean-Luc O’Neill ")).toBe("Guten Tag Dr. Jean-Luc O’Neill,");
    expect(guestGreeting("Zoë Ångström")).toBe("Guten Tag Zoë Ångström,");
  });

  it("übernimmt keine Nummern, Links oder langen Texte aus dem Formular", () => {
    expect(guestGreeting("Ihr Konto wird gesperrt – sofort anrufen +49 30 1234567")).toBe("Guten Tag,");
    expect(guestGreeting("Gewinn abholen: https://evil.example")).toBe("Guten Tag,");
    expect(guestGreeting("info@evil.example")).toBe("Guten Tag,");
    expect(guestGreeting("A".repeat(61))).toBe("Guten Tag,");
    expect(guestGreeting("")).toBe("Guten Tag,");
    expect(guestGreeting(null)).toBe("Guten Tag,");
  });
});

import { describe, expect, it } from "vitest";
import { isValidSlug, parseHost } from "@/lib/hosts";

describe("parseHost", () => {
  const root = "hertlin.de";

  it("erkennt die Hauptdomain", () => {
    expect(parseHost("hertlin.de", root)).toEqual({ kind: "main" });
    expect(parseHost("www.hertlin.de", root)).toEqual({ kind: "main" });
    expect(parseHost("HERTLIN.DE.", root)).toEqual({ kind: "main" });
  });

  it("erkennt Kundenportale", () => {
    expect(parseHost("muster.hertlin.de", root)).toEqual({ kind: "portal", slug: "muster" });
    expect(parseHost("baeckerei-schmidt.hertlin.de", root)).toEqual({ kind: "portal", slug: "baeckerei-schmidt" });
  });

  it("lehnt verschachtelte, reservierte und ungültige Subdomains ab", () => {
    expect(parseHost("a.muster.hertlin.de", root)).toEqual({ kind: "invalid" });
    expect(parseHost("admin.hertlin.de", root)).toEqual({ kind: "invalid" });
    expect(parseHost("mail.hertlin.de", root)).toEqual({ kind: "invalid" });
    expect(parseHost("-muster.hertlin.de", root)).toEqual({ kind: "invalid" });
  });

  it("funktioniert mit Port (lokale Entwicklung)", () => {
    expect(parseHost("localhost:3000", "localhost:3000")).toEqual({ kind: "main" });
    expect(parseHost("muster.localhost:3000", "localhost:3000")).toEqual({ kind: "portal", slug: "muster" });
  });

  it("zeigt bei fremden Hosts die Hauptseite", () => {
    expect(parseHost("192.168.1.10:3000", root)).toEqual({ kind: "main" });
    expect(parseHost(null, root)).toEqual({ kind: "main" });
  });
});

describe("isValidSlug", () => {
  it("prüft Format und reservierte Namen", () => {
    expect(isValidSlug("muster")).toBe(true);
    expect(isValidSlug("muster-gmbh")).toBe(true);
    expect(isValidSlug("Muster")).toBe(false);
    expect(isValidSlug("muster_gmbh")).toBe(false);
    expect(isValidSlug("www")).toBe(false);
    expect(isValidSlug("admin")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { isValidSlug, nextInternalHostname, parseHost, safeLocalPath } from "@/lib/hosts";

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

describe("safeLocalPath (Ziel nach der Anmeldung)", () => {
  it("übernimmt Pfade auf demselben Host samt Query und Anker", () => {
    expect(safeLocalPath("/tickets/12", "/")).toBe("/tickets/12");
    expect(safeLocalPath("/admin/tickets?status=NEW#verlauf", "/admin")).toBe("/admin/tickets?status=NEW#verlauf");
  });

  it("fällt bei fehlenden oder relativen Werten auf das Standardziel zurück", () => {
    expect(safeLocalPath(null, "/admin")).toBe("/admin");
    expect(safeLocalPath("", "/")).toBe("/");
    expect(safeLocalPath("tickets", "/")).toBe("/");
    expect(safeLocalPath("https://evil.example/", "/")).toBe("/");
  });

  it("lässt keine fremden Hosts durch, auch nicht über Steuerzeichen oder Backslashes", () => {
    for (const value of [
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example/x",
      "/\n/evil.example",
      "/\r\n/evil.example",
      "/ /evil.example",
      "/\u0000/evil.example",
      "/\\/evil.example",
      "/.//evil.example",
      "/%09/evil.example",
    ]) {
      const result = safeLocalPath(value, "/");
      expect(new URL(result, "https://muster.hertlin.de").host).toBe("muster.hertlin.de");
    }
    expect(safeLocalPath("/\t/evil.example/x", "/")).toBe("/");
    expect(safeLocalPath("/.//evil.example", "/")).toBe("/");
  });
});

describe("nextInternalHostname (Hostname für Next.js in server.ts)", () => {
  it("gibt Loopback-Adressen als localhost weiter, damit Portal-Rewrites intern bleiben", () => {
    expect(nextInternalHostname("127.0.0.1")).toBe("localhost");
    expect(nextInternalHostname("127.0.1.1")).toBe("localhost");
    expect(nextInternalHostname("::1")).toBe("localhost");
    expect(nextInternalHostname("[::1]")).toBe("localhost");
  });

  it("lässt andere Adressen unverändert", () => {
    expect(nextInternalHostname("0.0.0.0")).toBe("0.0.0.0");
    expect(nextInternalHostname("localhost")).toBe("localhost");
    expect(nextInternalHostname("10.0.0.5")).toBe("10.0.0.5");
    expect(nextInternalHostname("::")).toBe("::");
  });
});

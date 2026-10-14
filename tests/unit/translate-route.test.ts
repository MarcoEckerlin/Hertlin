import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/uebersetzen/route";
import { translateTexts } from "@/lib/translate";

// Ohne Datenbank und Übersetzungsdienst: Zwischenspeicher leer, „Übersetzung“ setzt die Sprache davor
const requestHeaders = { current: new Headers({ "x-forwarded-for": "198.51.100.40" }) };
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("@/lib/translate", () => ({
  translationEnabled: () => true,
  translateTexts: vi.fn(async (texts: string[], lang: string, opts: { cachedOnly?: boolean } = {}) =>
    texts.map((t) => (opts.cachedOnly ? null : { text: `[${lang}] ${t}`, detected: "de", unchanged: false })),
  ),
}));

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest("https://hertlin.de/api/uebersetzen", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { host: "hertlin.de", "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
    }),
  );
}

const freshCalls = () => vi.mocked(translateTexts).mock.calls.filter(([, , opts]) => !opts?.cachedOnly).length;

describe("/api/uebersetzen", () => {
  beforeEach(() => {
    vi.mocked(translateTexts).mockClear();
  });

  it("übersetzt Anfragen der eigenen Seiten", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.41" });
    const res = await post({ lang: "en", texts: ["Guten Tag"] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translations: ["[en] Guten Tag"] });
  });

  it("lehnt Aufrufe fremder Seiten und Anfragen ohne JSON ab", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.42" });
    const body = { lang: "en", texts: ["Guten Tag"] };
    expect((await post(body, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await post(body, { "content-type": "text/plain;charset=UTF-8" })).status).toBe(403);
    expect(translateTexts).not.toHaveBeenCalled();
  });

  it("begrenzt neue Übersetzungen pro Absender und Tag", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.43" });
    const chunk = (n: number) => Array.from({ length: 15 }, (_, i) => `${n}-${i} ${"x".repeat(990)}`);

    for (let n = 0; n < 2; n++) {
      const res = await post({ lang: "en", texts: chunk(n) });
      expect((await res.json()).translations[0]).toMatch(/^\[en\] /);
    }
    expect(freshCalls()).toBe(2);

    // Nach rund 30.000 Zeichen reicht das Budget dieses Absenders nicht mehr für weitere 15.000
    // (null = gerade nicht übersetzt, der Browser zeigt dann das Original)
    const blocked = await post({ lang: "en", texts: chunk(2) });
    expect(blocked.status).toBe(200);
    expect((await blocked.json()).translations[0]).toBeNull();
    expect(freshCalls()).toBe(2);

    // Andere Besucher übersetzen weiter
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.44" });
    const other = await post({ lang: "en", texts: ["Hallo"] });
    expect((await other.json()).translations).toEqual(["[en] Hallo"]);
  });
});

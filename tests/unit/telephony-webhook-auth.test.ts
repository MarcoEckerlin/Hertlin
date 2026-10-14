import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/telefonie/route";
import { processCallEvent } from "@/lib/telephony";

// Absender-IP aus den Request-Headern, Verarbeitung ohne Datenbank
const requestHeaders = { current: new Headers({ "x-forwarded-for": "198.51.100.20" }) };
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("@/lib/telephony", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telephony")>();
  return {
    ...actual,
    processCallEvent: vi.fn(async () => ({ id: "call_1", status: "RINGING", created: true, changed: true })),
  };
});

const TOKEN = "test-token-0123456789abcdefghijkl";
const ringing = JSON.stringify({ event: "ringing", callId: "42", from: "0711 12345" });

function post(token: string | null) {
  const path = token === null ? "/api/telefonie" : `/api/telefonie?token=${encodeURIComponent(token)}`;
  return POST(
    new NextRequest(`https://hertlin.de${path}`, {
      method: "POST",
      body: ringing,
      headers: { host: "hertlin.de", "content-type": "application/json" },
    }),
  );
}

describe("Webhook /api/telefonie – Zugangsschlüssel", () => {
  beforeEach(() => {
    process.env.ROOT_DOMAIN = "hertlin.de";
    process.env.APP_PROTOCOL = "https";
    process.env.TELEPHONY_WEBHOOK_TOKEN = TOKEN;
    delete process.env.TELEPHONY_ALLOWED_IPS;
    vi.mocked(processCallEvent).mockClear();
  });

  afterEach(() => {
    delete process.env.TELEPHONY_WEBHOOK_TOKEN;
  });

  it("lehnt Meldungen ab, solange der Schlüssel auf dem Server zu kurz ist", async () => {
    process.env.TELEPHONY_WEBHOOK_TOKEN = "kurz-1234";
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.21" });
    const res = await post("kurz-1234");
    expect(res.status).toBe(503);
    expect(processCallEvent).not.toHaveBeenCalled();
  });

  it("sperrt nach zu vielen Fehlversuchen auch den richtigen Schlüssel", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.22" });
    for (let i = 0; i < 20; i++) expect((await post(`falsch-${i}`)).status).toBe(401);
    expect((await post("noch-falscher")).status).toBe(429);
    expect((await post(TOKEN)).status).toBe(429);
    expect(processCallEvent).not.toHaveBeenCalled();

    // Andere Absender sind nicht betroffen
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.23" });
    expect((await post(TOKEN)).status).toBe(200);
    expect(processCallEvent).toHaveBeenCalledTimes(1);
  });

  it("nimmt den letzten Eintrag von X-Forwarded-For (vom eigenen Proxy angehängt)", async () => {
    for (let i = 0; i < 20; i++) {
      // Der Client schickt bei jedem Versuch eine andere „eigene“ Adresse mit
      requestHeaders.current = new Headers({ "x-forwarded-for": `10.0.0.${i}, 198.51.100.24` });
      expect((await post(`falsch-${i}`)).status).toBe(401);
    }
    requestHeaders.current = new Headers({ "x-forwarded-for": "10.9.9.9, 198.51.100.24" });
    expect((await post(TOKEN)).status).toBe(429);
  });
});

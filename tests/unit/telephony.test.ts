import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/telefonie/route";
import { processCallEvent } from "@/lib/telephony";
import {
  applyCallEvent,
  counterpartNumber,
  externalCallId,
  formatCallDuration,
  formatCallTime,
  formatPhoneDisplay,
  hangupCauseLabel,
  ipAllowed,
  isMissedCause,
  isStaleRinging,
  normalizePhone,
  parseAllowedIps,
  parseCallWebhook,
  parseGenericCallEvent,
  parsePlacetelCallEvent,
  parseSipgateCallEvent,
  phoneHref,
  phoneSearchSuffix,
  samePhone,
  startOfBerlinDay,
  type CallEvent,
  type CallState,
} from "@/lib/phone";

// Webhook-Tests: Absender-IP aus den Request-Headern, Verarbeitung ohne Datenbank
const requestHeaders = { current: new Headers({ "x-forwarded-for": "198.51.100.7" }) };
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current }));
vi.mock("@/lib/telephony", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telephony")>();
  return {
    ...actual,
    processCallEvent: vi.fn(async () => ({ id: "call_1", status: "RINGING", created: true, changed: true })),
  };
});

describe("normalizePhone", () => {
  it("bringt deutsche Schreibweisen auf E.164 ohne Plus", () => {
    expect(normalizePhone("+49 (0)711 123-45")).toBe("4971112345");
    expect(normalizePhone("0049711 12345")).toBe("4971112345");
    expect(normalizePhone("0049 (0) 711 12345")).toBe("4971112345");
    expect(normalizePhone("0711 12345")).toBe("4971112345");
    expect(normalizePhone("0711/123 45")).toBe("4971112345");
    expect(normalizePhone("4971112345")).toBe("4971112345");
    expect(normalizePhone("+49 171 1234567")).toBe("491711234567");
    expect(normalizePhone("0171 1234567")).toBe("491711234567");
    expect(normalizePhone("01234 567890")).toBe("491234567890");
  });

  it("entfernt die führende 0 nach der Ländervorwahl", () => {
    expect(normalizePhone("+49 0711 12345")).toBe("4971112345");
    expect(normalizePhone("490711 12345")).toBe("4971112345");
  });

  it("lässt ausländische Nummern und SIP-Adressen korrekt", () => {
    expect(normalizePhone("+43 1 2345678")).toBe("4312345678");
    expect(normalizePhone("0043 1 2345678")).toBe("4312345678");
    expect(normalizePhone("+41 44 123 45 67")).toBe("41441234567");
    expect(normalizePhone("sip:+4971112345@sipgate.de")).toBe("4971112345");
    expect(normalizePhone("tel:+49-711-12345;phone-context=x")).toBe("4971112345");
  });

  it("nutzt die eingestellte Ländervorwahl für nationale Nummern", () => {
    expect(normalizePhone("01 234 5678", "43")).toBe("4312345678");
  });

  it("lässt interne Durchwahlen unverändert", () => {
    expect(normalizePhone("12")).toBe("12");
    expect(normalizePhone("205")).toBe("205");
    expect(normalizePhone("10001")).toBe("10001");
  });

  it("liefert null für unterdrückte oder leere Nummern", () => {
    expect(normalizePhone("anonymous")).toBeNull();
    expect(normalizePhone("Anonymous")).toBeNull();
    expect(normalizePhone("unknown")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("sip:anonymous@anonymous.invalid")).toBeNull();
  });

  it("vergleicht unterschiedliche Schreibweisen", () => {
    expect(samePhone("+49 (0)711 123-45", "0711 12345")).toBe(true);
    expect(samePhone("0711 12345", "0711 12346")).toBe(false);
    expect(samePhone(null, null)).toBe(false);
  });
});

describe("Anzeige von Nummern", () => {
  it("gruppiert deutsche Nummern grob", () => {
    expect(formatPhoneDisplay("4971112345")).toBe("+49 711 12345");
    expect(formatPhoneDisplay("0171 1234567")).toBe("+49 171 1234567");
    expect(formatPhoneDisplay("030 1234567")).toBe("+49 30 1234567");
    expect(formatPhoneDisplay("01234 567890")).toBe("+49 1234 567890");
    expect(formatPhoneDisplay("07031 12345")).toBe("+49 7031 12345");
  });

  it("zeigt ausländische Nummern mit Landesvorwahl", () => {
    expect(formatPhoneDisplay("4312345678")).toBe("+43 12345678");
    expect(formatPhoneDisplay("12125551234")).toBe("+1 2125551234");
  });

  it("zeigt Durchwahlen und unterdrückte Nummern verständlich", () => {
    expect(formatPhoneDisplay("12")).toBe("12");
    expect(formatPhoneDisplay("anonymous")).toBe("Rufnummer unterdrückt");
    expect(formatPhoneDisplay(null)).toBe("Rufnummer unterdrückt");
  });

  it("baut Links zum Anrufen", () => {
    expect(phoneHref("0711 12345")).toBe("tel:+4971112345");
    expect(phoneHref("12")).toBe("tel:12");
    expect(phoneHref("anonymous")).toBeNull();
  });

  it("liefert Endziffern zum Vorfiltern nur für externe Nummern", () => {
    expect(phoneSearchSuffix("4971112345")).toBe("1112345");
    expect(phoneSearchSuffix("12")).toBeNull();
    expect(phoneSearchSuffix(null)).toBeNull();
  });

  it("nimmt bei ausgehenden Anrufen die angerufene Nummer als Gegenseite", () => {
    expect(counterpartNumber({ direction: "IN", fromNumber: "4971112345", toNumber: "4971199999" })).toBe("4971112345");
    expect(counterpartNumber({ direction: "OUT", fromNumber: "4971199999", toNumber: "4971112345" })).toBe("4971112345");
    expect(counterpartNumber({ direction: "IN", fromNumber: "", toNumber: null })).toBeNull();
  });
});

describe("Format A (generic JSON)", () => {
  const now = new Date("2026-10-14T08:00:00Z");

  it("liest ein vollständiges Ereignis", () => {
    const result = parseGenericCallEvent(
      { event: "ringing", callId: "1728900000.42", from: "+49 711 1234567", to: "0711 9876500", direction: "in" },
      now,
    );
    expect(result).toEqual({
      ok: true,
      event: {
        provider: "generic",
        kind: "ringing",
        callId: "1728900000.42",
        direction: "IN",
        from: "+49 711 1234567",
        to: "0711 9876500",
        answeredBy: null,
        cause: null,
        at: null,
      },
    });
  });

  it("akzeptiert Zahlen als callId, Richtung out und Zeitstempel", () => {
    const result = parseGenericCallEvent(
      { event: "Answered", callId: 4711, direction: "out", answeredBy: "Jonas Keller", timestamp: "2026-10-14T07:59:30Z" },
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.kind).toBe("answered");
    expect(result.event.callId).toBe("4711");
    expect(result.event.direction).toBe("OUT");
    expect(result.event.answeredBy).toBe("Jonas Keller");
    expect(result.event.at?.toISOString()).toBe("2026-10-14T07:59:30.000Z");
  });

  it("ignoriert unplausible Zeitstempel", () => {
    const result = parseGenericCallEvent({ event: "ended", callId: "a", timestamp: 1000 }, now);
    expect(result.ok && result.event.at).toBeNull();
  });

  it("lehnt unbekannte Ereignisse und fehlende callId ab", () => {
    expect(parseGenericCallEvent({ event: "newCall", callId: "x" }, now).ok).toBe(false);
    expect(parseGenericCallEvent({ event: "ringing" }, now).ok).toBe(false);
    expect(parseGenericCallEvent("ringing", now).ok).toBe(false);
    expect(parseGenericCallEvent(null, now).ok).toBe(false);
    expect(parseGenericCallEvent([], now).ok).toBe(false);
  });

  it("wird über parseCallWebhook für JSON gewählt", () => {
    const result = parseCallWebhook({ kind: "json", data: { event: "missed", callId: "7", from: "0711 12345" } }, now);
    expect(result.ok && result.event.provider).toBe("generic");
    expect(result.ok && result.event.kind).toBe("missed");
  });

  it("versteht dieselben Felder auch als Formulardaten", () => {
    const result = parseCallWebhook({ kind: "form", data: new URLSearchParams("event=ringing&callId=99&from=0711%2012345") }, now);
    expect(result.ok && result.event.provider).toBe("generic");
    expect(result.ok && result.event.from).toBe("0711 12345");
  });
});

describe("Format B (sipgate.io Push-API)", () => {
  it("liest newCall mit mehreren Benutzern", () => {
    const form = new URLSearchParams(
      "event=newCall&direction=in&from=4915791234567&to=4971112345&callId=ABC123&user%5B%5D=Jonas+Keller&user%5B%5D=Support",
    );
    const result = parseCallWebhook({ kind: "form", data: form });
    expect(result).toEqual({
      ok: true,
      event: {
        provider: "sipgate",
        kind: "ringing",
        callId: "ABC123",
        direction: "IN",
        from: "4915791234567",
        to: "4971112345",
        // Eingehend: Benutzer, bei denen es klingelt, sind noch nicht „angenommen von“
        answeredBy: null,
        cause: null,
        at: null,
      },
    });
  });

  it("übernimmt bei ausgehenden Anrufen den anrufenden Mitarbeiter", () => {
    const form = new URLSearchParams("event=newCall&direction=out&from=4971112345&to=4915791234567&callId=OUT1&user%5B%5D=Anna+Hertlin");
    const result = parseSipgateCallEvent(form);
    expect(result.ok && result.event.direction).toBe("OUT");
    expect(result.ok && result.event.answeredBy).toBe("Anna Hertlin");
  });

  it("liest answer mit Benutzer oder Nummer", () => {
    const withUser = parseSipgateCallEvent(new URLSearchParams("event=answer&callId=ABC123&user=Jonas+Keller&answeringNumber=4971112345"));
    expect(withUser.ok && withUser.event.kind).toBe("answered");
    expect(withUser.ok && withUser.event.answeredBy).toBe("Jonas Keller");

    const withNumber = parseSipgateCallEvent(new URLSearchParams("event=answer&callId=ABC123&answeringNumber=4915791234567"));
    expect(withNumber.ok && withNumber.event.answeredBy).toBe("+49 157 91234567");
  });

  it("liest hangup mit Grund", () => {
    const result = parseSipgateCallEvent(new URLSearchParams("event=hangup&callId=ABC123&cause=noAnswer&direction=in"));
    expect(result.ok && result.event.kind).toBe("ended");
    expect(result.ok && result.event.cause).toBe("noAnswer");
  });

  it("ignoriert Tastendrücke und lehnt Unvollständiges ab", () => {
    const dtmf = parseSipgateCallEvent(new URLSearchParams("event=dtmf&callId=ABC123&dtmf=1"));
    expect(dtmf).toMatchObject({ ok: false, ignore: true });
    expect(parseSipgateCallEvent(new URLSearchParams("event=newCall&from=123")).ok).toBe(false);
  });

  it("vergibt provider-präfixierte Kennungen", () => {
    const result = parseSipgateCallEvent(new URLSearchParams("event=hangup&callId=ABC123&cause=normalClearing"));
    expect(result.ok && externalCallId(result.event)).toBe("sipgate:ABC123");
  });
});

describe("Placetel Notify-API", () => {
  it("liest die Ereignisse", () => {
    const incoming = parseCallWebhook({ kind: "form", data: new URLSearchParams("event=IncomingCall&from=0711123456&to=0711999&call_id=p1") });
    expect(incoming.ok && incoming.event).toMatchObject({ provider: "placetel", kind: "ringing", direction: "IN", callId: "p1" });

    const accepted = parsePlacetelCallEvent(new URLSearchParams("event=CallAccepted&call_id=p1&peer=Jonas"));
    expect(accepted.ok && accepted.event).toMatchObject({ kind: "answered", answeredBy: "Jonas" });

    const hungUp = parsePlacetelCallEvent(new URLSearchParams("event=HungUp&call_id=p1&type=missed"));
    expect(hungUp.ok && hungUp.event).toMatchObject({ kind: "ended", cause: "missed" });
  });
});

describe("Ablauf eines Anrufs", () => {
  const t0 = new Date("2026-10-14T08:00:00Z");
  const t1 = new Date("2026-10-14T08:00:10Z");
  const t2 = new Date("2026-10-14T08:04:22Z");

  const ev = (kind: CallEvent["kind"], extra: Partial<CallEvent> = {}): CallEvent => ({
    provider: "generic",
    kind,
    callId: "1",
    direction: "IN",
    from: "0711 12345",
    to: null,
    answeredBy: null,
    cause: null,
    at: null,
    ...extra,
  });

  it("Klingelt → Angenommen → Beendet", () => {
    const ringing = applyCallEvent(null, ev("ringing"), t0);
    expect(ringing.status).toBe("RINGING");
    const answered = applyCallEvent(ringing, ev("answered", { answeredBy: "Jonas" }), t1);
    expect(answered).toMatchObject({ status: "ANSWERED", answeredBy: "Jonas" });
    expect(answered.answeredAt).toEqual(t1);
    const ended = applyCallEvent(answered, ev("ended", { cause: "normalClearing" }), t2);
    expect(ended).toMatchObject({ status: "ENDED", hangupCause: "normalClearing" });
    expect(formatCallDuration(ended.answeredAt, ended.endedAt)).toBe("4:12 Min.");
  });

  it("Auflegen ohne Annahme ist verpasst", () => {
    const ringing = applyCallEvent(null, ev("ringing"), t0);
    expect(applyCallEvent(ringing, ev("ended", { cause: "cancel" }), t1).status).toBe("MISSED");
    expect(applyCallEvent(ringing, ev("ended", { cause: "noAnswer" }), t1).status).toBe("MISSED");
    expect(applyCallEvent(ringing, ev("ended", { cause: "busy" }), t1).status).toBe("MISSED");
    expect(applyCallEvent(ringing, ev("ended"), t1).status).toBe("MISSED");
    expect(applyCallEvent(ringing, ev("missed"), t1).status).toBe("MISSED");
  });

  it("normal beendet oder weitergeleitet zählt nicht als verpasst", () => {
    const ringing = applyCallEvent(null, ev("ringing"), t0);
    expect(applyCallEvent(ringing, ev("ended", { cause: "normalClearing" }), t1).status).toBe("ENDED");
    expect(applyCallEvent(ringing, ev("ended", { cause: "forwarded" }), t1).status).toBe("ENDED");
    expect(isMissedCause("NOANSWER")).toBe(true);
    expect(isMissedCause("normal_clearing")).toBe(false);
  });

  it("ausgehende Anrufe sind nie verpasst", () => {
    const out = applyCallEvent(null, ev("ringing", { direction: "OUT", answeredBy: "Anna" }), t0);
    expect(out.answeredBy).toBe("Anna");
    expect(applyCallEvent(out, ev("ended", { direction: "OUT", cause: "noAnswer" }), t1).status).toBe("ENDED");
  });

  it("ist robust gegen doppelte und verspätete Meldungen", () => {
    const ringing = applyCallEvent(null, ev("ringing"), t0);
    // doppelt
    expect(applyCallEvent(ringing, ev("ringing"), t1)).toEqual(ringing);

    // Annahme kommt vor dem Klingeln an
    const answeredFirst = applyCallEvent(null, ev("answered", { answeredBy: "Jonas" }), t1);
    expect(answeredFirst.status).toBe("ANSWERED");
    expect(applyCallEvent(answeredFirst, ev("ringing"), t1).status).toBe("ANSWERED");

    // Auflegen doppelt: Status bleibt, Zeit bleibt
    const ended = applyCallEvent(answeredFirst, ev("ended", { cause: "normalClearing" }), t2);
    const again = applyCallEvent(ended, ev("ended", { cause: "cancel" }), new Date("2026-10-14T09:00:00Z"));
    expect(again).toEqual(ended);

    // Annahme kommt erst nach dem Auflegen: nicht mehr verpasst
    const missed = applyCallEvent(ringing, ev("ended", { cause: "cancel" }), t1);
    const late = applyCallEvent(missed, ev("answered", { answeredBy: "Jonas" }), t2);
    expect(late).toMatchObject({ status: "ENDED", answeredBy: "Jonas" });
  });

  it("geht nie von Beendet zurück auf Angenommen", () => {
    const state: CallState = {
      status: "ENDED",
      direction: "IN",
      answeredAt: t1,
      endedAt: t2,
      answeredBy: "Jonas",
      hangupCause: "normalClearing",
    };
    expect(applyCallEvent(state, ev("answered", { answeredBy: "Jonas" }), t2).status).toBe("ENDED");
  });

  it("erkennt Anrufe ohne Ende-Meldung", () => {
    expect(isStaleRinging({ status: "RINGING", startedAt: t0 }, new Date("2026-10-14T08:30:00Z"))).toBe(true);
    expect(isStaleRinging({ status: "RINGING", startedAt: t0 }, t1)).toBe(false);
    expect(isStaleRinging({ status: "MISSED", startedAt: t0 }, new Date("2026-10-15T08:00:00Z"))).toBe(false);
  });
});

describe("Anzeige von Zeiten und Gründen", () => {
  it("formatiert die Gesprächsdauer", () => {
    const a = new Date("2026-10-14T08:00:00Z");
    expect(formatCallDuration(a, new Date("2026-10-14T08:00:35Z"))).toBe("35 Sek.");
    expect(formatCallDuration(a, new Date("2026-10-14T09:02:03Z"))).toBe("1:02:03 Std.");
    expect(formatCallDuration(null, a)).toBeNull();
  });

  it("schreibt Uhrzeiten deutsch und relativ zu heute", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(formatCallTime(new Date("2026-10-14T07:05:00Z"), now)).toBe("Heute, 9:05 Uhr");
    expect(formatCallTime(new Date("2026-10-13T15:40:00Z"), now)).toBe("Gestern, 17:40 Uhr");
    expect(formatCallTime(new Date("2026-10-10T06:05:00Z"), now)).toBe("10.10.2026, 8:05 Uhr");
  });

  it("berechnet Mitternacht in deutscher Zeit", () => {
    expect(startOfBerlinDay(new Date("2026-10-14T12:00:00Z")).toISOString()).toBe("2026-10-13T22:00:00.000Z");
    expect(startOfBerlinDay(new Date("2026-01-14T00:30:00Z")).toISOString()).toBe("2026-01-13T23:00:00.000Z");
    // Tag der Zeitumstellung (29.03.2026, Mitternacht noch Winterzeit)
    expect(startOfBerlinDay(new Date("2026-03-29T12:00:00Z")).toISOString()).toBe("2026-03-28T23:00:00.000Z");
  });

  it("übersetzt Gründe fürs Auflegen", () => {
    expect(hangupCauseLabel("normalClearing")).toBe("normal beendet");
    expect(hangupCauseLabel("busy")).toBe("besetzt");
    expect(hangupCauseLabel("SOMETHING_ELSE")).toBe("SOMETHING_ELSE");
    expect(hangupCauseLabel(null)).toBeNull();
  });
});

describe("Absender-Prüfung", () => {
  it("liest die Liste aus der Umgebungsvariable", () => {
    expect(parseAllowedIps(" 192.0.2.10, 198.51.100.0/24 ;2001:db8::1 ")).toEqual(["192.0.2.10", "198.51.100.0/24", "2001:db8::1"]);
    expect(parseAllowedIps(undefined)).toEqual([]);
  });

  it("prüft einzelne Adressen und Netze", () => {
    const allowed = ["192.0.2.10", "198.51.100.0/24", "2001:db8::1"];
    expect(ipAllowed("192.0.2.10", allowed)).toBe(true);
    expect(ipAllowed("::ffff:192.0.2.10", allowed)).toBe(true);
    expect(ipAllowed("198.51.100.77", allowed)).toBe(true);
    expect(ipAllowed("198.51.101.1", allowed)).toBe(false);
    expect(ipAllowed("2001:DB8::1", allowed)).toBe(true);
    expect(ipAllowed("unknown", allowed)).toBe(false);
    expect(ipAllowed(null, allowed)).toBe(false);
    expect(ipAllowed("203.0.113.5", ["203.0.113.0/27"])).toBe(true);
    expect(ipAllowed("203.0.113.40", ["203.0.113.0/27"])).toBe(false);
  });
});

describe("Webhook /api/telefonie", () => {
  const TOKEN = "test-token-0123456789abcdefghijkl";

  beforeEach(() => {
    process.env.ROOT_DOMAIN = "hertlin.de";
    process.env.APP_PROTOCOL = "https";
    process.env.TELEPHONY_WEBHOOK_TOKEN = TOKEN;
    delete process.env.TELEPHONY_ALLOWED_IPS;
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.7" });
    vi.mocked(processCallEvent).mockClear();
  });

  afterEach(() => {
    delete process.env.TELEPHONY_WEBHOOK_TOKEN;
    delete process.env.TELEPHONY_ALLOWED_IPS;
  });

  const post = (path: string, body: string, headers: Record<string, string> = {}, host = "hertlin.de") =>
    POST(new NextRequest(`https://${host}${path}`, { method: "POST", body, headers: { host, ...headers } }));

  const sipgateNewCall = "event=newCall&direction=in&from=491234567891&to=4971112345&callId=ABC&user%5B%5D=Support";

  it("antwortet nur auf der Hauptdomain", async () => {
    const res = await post(`/api/telefonie?token=${TOKEN}`, sipgateNewCall, {}, "muster.hertlin.de");
    expect(res.status).toBe(404);
    expect(processCallEvent).not.toHaveBeenCalled();
  });

  it("ist ohne Zugangsschlüssel abgeschaltet", async () => {
    delete process.env.TELEPHONY_WEBHOOK_TOKEN;
    const res = await post(`/api/telefonie?token=${TOKEN}`, sipgateNewCall);
    expect(res.status).toBe(503);
  });

  it("lehnt falsche oder fehlende Schlüssel ab", async () => {
    expect((await post("/api/telefonie?token=falsch", sipgateNewCall)).status).toBe(401);
    expect((await post("/api/telefonie", sipgateNewCall)).status).toBe(401);
    expect(processCallEvent).not.toHaveBeenCalled();
  });

  it("prüft freigegebene Absender", async () => {
    process.env.TELEPHONY_ALLOWED_IPS = "203.0.113.0/24";
    expect((await post(`/api/telefonie?token=${TOKEN}`, sipgateNewCall)).status).toBe(403);
    requestHeaders.current = new Headers({ "x-forwarded-for": "203.0.113.9" });
    expect((await post(`/api/telefonie?token=${TOKEN}`, sipgateNewCall, { "content-type": "application/x-www-form-urlencoded" })).status).toBe(200);
  });

  it("antwortet sipgate auf newCall mit den Adressen für Annahme und Auflegen", async () => {
    const res = await post(`/api/telefonie?token=${TOKEN}`, sipgateNewCall, { "content-type": "application/x-www-form-urlencoded" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/xml");
    const body = await res.text();
    expect(body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(body).toContain(`onAnswer="https://hertlin.de/api/telefonie?token=${TOKEN}"`);
    expect(body).toContain(`onHangup="https://hertlin.de/api/telefonie?token=${TOKEN}"`);
    expect(processCallEvent).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "sipgate", kind: "ringing", callId: "ABC", from: "491234567891", direction: "IN" }),
    );
  });

  it("nimmt JSON mit dem Schlüssel im Header an", async () => {
    const res = await post(
      "/api/telefonie",
      JSON.stringify({ event: "ringing", callId: "42", from: "0711 12345" }),
      { "content-type": "application/json", "x-hertlin-token": TOKEN },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "call_1", status: "RINGING" });
  });

  it("meldet ungültige Inhalte mit 400", async () => {
    const res = await post(`/api/telefonie?token=${TOKEN}`, "{kein json", { "content-type": "application/json" });
    expect(res.status).toBe(400);
    const unknown = await post(`/api/telefonie?token=${TOKEN}`, JSON.stringify({ event: "klingeln", callId: "1" }), {
      "content-type": "application/json",
    });
    expect(unknown.status).toBe(400);
    expect(processCallEvent).not.toHaveBeenCalled();
  });

  it("bestätigt Tastendrücke von sipgate ohne Verarbeitung", async () => {
    const res = await post(`/api/telefonie?token=${TOKEN}`, "event=dtmf&callId=ABC&dtmf=1", {
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(res.status).toBe(200);
    expect(processCallEvent).not.toHaveBeenCalled();
  });
});

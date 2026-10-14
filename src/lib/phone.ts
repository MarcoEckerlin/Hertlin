/**
 * Telefonnummern und Meldungen der Telefonanlage – reine Funktionen ohne Datenbank.
 * Nutzbar im Server, im Browser und in Unit-Tests.
 *
 * Gespeichert werden Nummern im E.164-Format ohne „+“, z. B. "4971112345".
 * Interne Durchwahlen (bis 5 Ziffern) bleiben unverändert.
 */

const TZ = "Europe/Berlin";

/** Bis zu dieser Länge gilt eine Nummer als interne Durchwahl. */
export const INTERNAL_MAX_DIGITS = 5;

/** Ländervorwahl für Nummern ohne internationale Vorwahl (Env TELEPHONY_DEFAULT_COUNTRY, Standard 49). */
export function defaultCountry(): string {
  const raw = typeof process !== "undefined" ? process.env?.TELEPHONY_DEFAULT_COUNTRY : undefined;
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 1 && digits.length <= 3 ? digits : "49";
}

const ANONYMOUS = /^(anonym|anonymous|unknown|unbekannt|unavailable|restricted|private|privat|withheld|unterdrückt|unterdrueckt|nicht übermittelt)$/i;

/** Länder, in denen die führende 0 nach der Ländervorwahl entfällt ("+49 0711" → "49711"). */
const TRUNK_ZERO_COUNTRIES = new Set(["49", "43", "41", "31", "32", "33", "44", "46", "90"]);

const TWO_DIGIT_COUNTRY_CODES = new Set([
  "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49",
  "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84",
  "86", "90", "91", "92", "93", "94", "95", "98",
]);

/** Länge der Ländervorwahl einer internationalen Nummer (ohne „+“). */
export function countryCodeLength(international: string): number {
  if (international.startsWith("1") || international.startsWith("7")) return 1;
  return TWO_DIGIT_COUNTRY_CODES.has(international.slice(0, 2)) ? 2 : 3;
}

/**
 * Bringt beliebige Schreibweisen in ein einheitliches Format (E.164 ohne „+“).
 *   "+49 (0)711 123-45" → "4971112345"   "0711 12345" → "4971112345"
 *   "0049 711 12345"    → "4971112345"   "4971112345" → "4971112345"
 *   "sip:+4971112345@pbx.example" → "4971112345"
 *   "12" (Durchwahl) → "12"   "anonymous" / "" → null
 */
export function normalizePhone(raw: string | number | null | undefined, country: string = defaultCountry()): string | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // SIP- oder Tel-URI: sip:+4971112345@pbx.example;user=phone
  s = s.replace(/^(sips?|tel):/i, "");
  const at = s.indexOf("@");
  if (at >= 0) s = s.slice(0, at);
  s = s.split(";")[0].trim();
  if (!s || ANONYMOUS.test(s)) return null;

  // "(0)" nach der Ländervorwahl wird nicht gewählt
  s = s.replace(/\(\s*0\s*\)/g, "");
  const plus = s.startsWith("+");
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  if (!plus) {
    if (digits.length <= INTERNAL_MAX_DIGITS) return digits;
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.startsWith("0")) digits = country + digits.slice(1);
    // Ohne führende 0 und kürzer als 10 Ziffern: lokale Nummer ohne Vorwahl – so lassen
    else if (digits.length < 10) return digits;
    // sonst bereits international ohne „+“ (so liefert z. B. sipgate die Nummern)
  }

  const ccLength = countryCodeLength(digits);
  const cc = digits.slice(0, ccLength);
  if (TRUNK_ZERO_COUNTRIES.has(cc) && digits.charAt(ccLength) === "0") {
    digits = cc + digits.slice(ccLength + 1);
  }
  return digits || null;
}

/** Ist das eine interne Durchwahl (kurze Nummer)? */
export function isInternalNumber(normalized: string | null | undefined): boolean {
  return !!normalized && normalized.length <= INTERNAL_MAX_DIGITS;
}

/** Nummer, die wie eine vollständige internationale Nummer aussieht. */
function isInternational(normalized: string): boolean {
  return normalized.length >= 10;
}

/** Grobe Länge der deutschen Vorwahl (ohne 0) für die Anzeige. */
function germanAreaLength(rest: string): number {
  if (/^1[5-7]/.test(rest)) return 3; // Mobilfunk: 151, 160, 171 …
  if (/^(30|40|69|89)/.test(rest)) return 2; // Berlin, Hamburg, Frankfurt, München
  if (/^(800|900)/.test(rest)) return 3;
  if (/^[2-9]\d1/.test(rest)) return 3; // z. B. 711, 221, 911
  return 4;
}

/**
 * Lesbare Darstellung, z. B. "+49 711 12345" oder "+49 171 1234567".
 * Unterdrückte oder leere Nummern: "Rufnummer unterdrückt".
 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  const n = normalizePhone(value);
  if (!n) return "Rufnummer unterdrückt";
  if (!isInternational(n)) return n;
  const ccLength = countryCodeLength(n);
  const cc = n.slice(0, ccLength);
  const rest = n.slice(ccLength);
  if (cc === "49") {
    const area = germanAreaLength(rest);
    return `+49 ${rest.slice(0, area)} ${rest.slice(area)}`.trim();
  }
  return `+${cc} ${rest}`;
}

/** Link zum Anrufen (tel:+4971112345) oder null bei unterdrückter Nummer. */
export function phoneHref(value: string | null | undefined): string | null {
  const n = normalizePhone(value);
  if (!n) return null;
  return isInternational(n) ? `tel:+${n}` : `tel:${n}`;
}

/** Letzte Ziffern zum Vorfiltern in der Datenbank (nur für externe Nummern). */
export function phoneSearchSuffix(normalized: string | null | undefined, length = 7): string | null {
  if (!normalized || normalized.length <= INTERNAL_MAX_DIGITS) return null;
  return normalized.slice(-length);
}

/** Gleiche Nummer, unabhängig von der Schreibweise? */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  return !!na && na === normalizePhone(b);
}

/* ------------------------------------------------------------------ */
/* Meldungen der Telefonanlage                                         */
/* ------------------------------------------------------------------ */

export type CallEventKind = "ringing" | "answered" | "ended" | "missed";
export type CallDirection = "IN" | "OUT";
export type CallStatus = "RINGING" | "ANSWERED" | "MISSED" | "ENDED";
export type CallProvider = "generic" | "sipgate" | "placetel" | "test";

/** Einheitliche Form einer Meldung, unabhängig vom Format der Anlage. */
export type CallEvent = {
  provider: CallProvider;
  kind: CallEventKind;
  /** Kennung des Anrufs bei der Anlage (ohne Präfix) */
  callId: string;
  direction: CallDirection;
  /** Nummern so, wie die Anlage sie schickt */
  from: string | null;
  to: string | null;
  /** Ausgehend: wer anruft. Eingehend: wer angenommen hat. */
  answeredBy: string | null;
  cause: string | null;
  /** Zeitpunkt laut Anlage (nur Format A, optional) */
  at: Date | null;
};

export type ParseResult = { ok: true; event: CallEvent } | { ok: false; ignore?: boolean; error: string };

/** Eindeutige Kennung für PhoneCall.externalId, z. B. "sipgate:abc123". */
export function externalCallId(event: Pick<CallEvent, "provider" | "callId">): string {
  return `${event.provider}:${event.callId}`;
}

type FormLike = { get(name: string): string | null; getAll(name: string): string[] };

function text(value: unknown, max = 200): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s.slice(0, max) : null;
}

function key(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

function parseDirection(value: unknown): CallDirection {
  const k = key(text(value));
  return k === "out" || k === "outbound" || k === "outgoing" || k === "ausgehend" ? "OUT" : "IN";
}

function parseTimestamp(value: unknown, now: Date): Date | null {
  let date: Date | null = null;
  if (typeof value === "number" || (typeof value === "string" && /^\d{9,13}$/.test(value.trim()))) {
    const n = Number(value);
    date = new Date(n < 1e12 ? n * 1000 : n);
  } else if (typeof value === "string" && value.trim()) {
    date = new Date(value.trim());
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  // Nur plausible Zeitpunkte übernehmen (± 1 Tag), sonst gilt der Eingang
  return Math.abs(date.getTime() - now.getTime()) <= 24 * 60 * 60 * 1000 ? date : null;
}

const GENERIC_EVENTS: Record<string, CallEventKind> = {
  ringing: "ringing",
  answered: "answered",
  ended: "ended",
  missed: "missed",
};

/**
 * Format A „generic“ (JSON oder Formulardaten):
 * { event: "ringing"|"answered"|"ended"|"missed", callId, from, to?, direction?: "in"|"out", answeredBy?, cause?, timestamp? }
 */
export function parseGenericCallEvent(input: unknown, now: Date = new Date()): ParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Erwartet wird ein JSON-Objekt." };
  }
  const data = input as Record<string, unknown>;
  const kind = GENERIC_EVENTS[key(text(data.event))];
  if (!kind) return { ok: false, error: "Unbekanntes Ereignis. Erlaubt sind ringing, answered, ended und missed." };
  const callId = text(data.callId ?? data.call_id ?? data.id, 200);
  if (!callId) return { ok: false, error: "callId fehlt." };

  return {
    ok: true,
    event: {
      provider: "generic",
      kind,
      callId,
      direction: parseDirection(data.direction),
      from: text(data.from, 80),
      to: text(data.to, 80),
      answeredBy: text(data.answeredBy ?? data.answered_by, 120),
      cause: text(data.cause, 60),
      at: parseTimestamp(data.timestamp ?? data.time, now),
    },
  };
}

/** Ereignisnamen der sipgate.io Push-API */
const SIPGATE_EVENTS = new Set(["newCall", "answer", "hangup", "dtmf"]);
/** Ereignisnamen der Placetel Notify-API */
const PLACETEL_EVENTS = new Set(["IncomingCall", "OutgoingCall", "CallAccepted", "HungUp"]);

function users(form: FormLike): string | null {
  const names = [...form.getAll("user[]"), ...form.getAll("user")].map((u) => u.trim()).filter(Boolean);
  return names.length ? [...new Set(names)].join(", ").slice(0, 120) : null;
}

/**
 * Format B „sipgate.io Push-API“ (application/x-www-form-urlencoded):
 * event=newCall|answer|hangup, callId, from, to, direction, user[], answeringNumber, cause
 */
export function parseSipgateCallEvent(form: FormLike): ParseResult {
  const event = form.get("event")?.trim() ?? "";
  if (event === "dtmf") return { ok: false, ignore: true, error: "Tastendruck – wird nicht ausgewertet." };
  const callId = text(form.get("callId"), 200);
  if (!callId) return { ok: false, error: "callId fehlt." };
  const direction = parseDirection(form.get("direction"));
  const from = text(form.get("from"), 80);
  const to = text(form.get("to"), 80);

  switch (event) {
    case "newCall":
      return {
        ok: true,
        event: {
          provider: "sipgate",
          kind: "ringing",
          callId,
          direction,
          from,
          to,
          // Ausgehend nennt sipgate hier den Mitarbeiter, der anruft
          answeredBy: direction === "OUT" ? users(form) : null,
          cause: null,
          at: null,
        },
      };
    case "answer": {
      const answering = text(form.get("answeringNumber"), 80);
      return {
        ok: true,
        event: {
          provider: "sipgate",
          kind: "answered",
          callId,
          direction,
          from,
          to,
          answeredBy: users(form) ?? (answering ? formatPhoneDisplay(answering) : null),
          cause: null,
          at: null,
        },
      };
    }
    case "hangup":
      return {
        ok: true,
        event: { provider: "sipgate", kind: "ended", callId, direction, from, to, answeredBy: null, cause: text(form.get("cause"), 60), at: null },
      };
    default:
      return { ok: false, error: "Unbekanntes sipgate-Ereignis." };
  }
}

/**
 * Placetel Notify-API (Formulardaten): event=IncomingCall|OutgoingCall|CallAccepted|HungUp,
 * call_id, from, to, peer (angenommen von), type (Ergebnis beim Auflegen).
 */
export function parsePlacetelCallEvent(form: FormLike): ParseResult {
  const event = form.get("event")?.trim() ?? "";
  const callId = text(form.get("call_id") ?? form.get("callId"), 200);
  if (!callId) return { ok: false, error: "call_id fehlt." };
  const from = text(form.get("from"), 80);
  const to = text(form.get("to"), 80);
  const base = { provider: "placetel" as const, callId, from, to, at: null };

  switch (event) {
    case "IncomingCall":
      return { ok: true, event: { ...base, kind: "ringing", direction: "IN", answeredBy: null, cause: null } };
    case "OutgoingCall":
      return { ok: true, event: { ...base, kind: "ringing", direction: "OUT", answeredBy: text(form.get("peer"), 120), cause: null } };
    case "CallAccepted":
      return {
        ok: true,
        event: { ...base, kind: "answered", direction: parseDirection(form.get("direction")), answeredBy: text(form.get("peer"), 120), cause: null },
      };
    case "HungUp":
      return {
        ok: true,
        event: { ...base, kind: "ended", direction: parseDirection(form.get("direction")), answeredBy: null, cause: text(form.get("type"), 60) },
      };
    default:
      return { ok: false, error: "Unbekanntes Placetel-Ereignis." };
  }
}

/** Erkennt das Format anhand des Inhalts und liefert eine einheitliche Meldung. */
export function parseCallWebhook(
  body: { kind: "json"; data: unknown } | { kind: "form"; data: URLSearchParams },
  now: Date = new Date(),
): ParseResult {
  if (body.kind === "json") return parseGenericCallEvent(body.data, now);
  const event = body.data.get("event")?.trim() ?? "";
  if (SIPGATE_EVENTS.has(event)) return parseSipgateCallEvent(body.data);
  if (PLACETEL_EVENTS.has(event)) return parsePlacetelCallEvent(body.data);
  return parseGenericCallEvent(Object.fromEntries(body.data.entries()), now);
}

/* ------------------------------------------------------------------ */
/* Ablauf eines Anrufs                                                 */
/* ------------------------------------------------------------------ */

export type CallState = {
  status: CallStatus;
  direction: CallDirection;
  answeredAt: Date | null;
  endedAt: Date | null;
  answeredBy: string | null;
  hangupCause: string | null;
};

/** Gründe, bei denen trotz fehlender Annahme-Meldung ein Gespräch stattgefunden hat bzw. nichts verpasst wurde. */
const NOT_MISSED_CAUSES = new Set([
  "normalclearing",
  "normal",
  "answer",
  "answered",
  "accepted",
  "completed",
  "ok",
  "success",
  "forwarded",
  "transferred",
  "test",
]);

/**
 * Wurde ein nicht angenommener Anruf verpasst? Ohne Grund: ja.
 * busy, cancel, noAnswer, congestion, notFound, voicemail … ebenfalls.
 */
export function isMissedCause(cause: string | null | undefined): boolean {
  if (!cause) return true;
  return !NOT_MISSED_CAUSES.has(key(cause));
}

/**
 * Wendet eine Meldung auf den bisherigen Stand an (null = neuer Anruf).
 * Robust gegen doppelte und verspätete Meldungen: Der Status geht nie zurück
 * (Klingelt → Angenommen → Beendet/Verpasst).
 */
export function applyCallEvent(current: CallState | null, event: CallEvent, now: Date = new Date()): CallState {
  const at = event.at ?? now;
  const base: CallState = current ?? {
    status: "RINGING",
    direction: event.direction,
    answeredAt: null,
    endedAt: null,
    answeredBy: null,
    hangupCause: null,
  };
  const next: CallState = { ...base };
  const finished = base.status === "ENDED" || base.status === "MISSED";

  switch (event.kind) {
    case "ringing":
      // Ausgehend: Name des anrufenden Mitarbeiters übernehmen
      if (event.answeredBy && !next.answeredBy && base.direction === "OUT") next.answeredBy = event.answeredBy;
      break;

    case "answered":
      if (event.answeredBy) next.answeredBy = event.answeredBy;
      if (finished) {
        // Annahme-Meldung kam erst nach dem Auflegen: dann war es kein verpasster Anruf
        if (base.status === "MISSED") next.status = "ENDED";
      } else {
        next.status = "ANSWERED";
        next.answeredAt = base.answeredAt ?? at;
      }
      break;

    case "ended":
    case "missed": {
      if (finished) {
        if (!next.hangupCause && event.cause) next.hangupCause = event.cause;
        break;
      }
      next.endedAt = at;
      next.hangupCause = event.cause ?? base.hangupCause;
      const answered = base.status === "ANSWERED" || base.answeredAt !== null;
      if (answered || base.direction === "OUT") next.status = "ENDED";
      else if (event.kind === "missed") next.status = "MISSED";
      else next.status = isMissedCause(event.cause) ? "MISSED" : "ENDED";
      break;
    }
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Anzeige                                                             */
/* ------------------------------------------------------------------ */

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  RINGING: "Klingelt",
  ANSWERED: "Angenommen",
  MISSED: "Verpasst",
  ENDED: "Beendet",
};

export const CALL_PROVIDER_LABELS: Record<CallProvider, string> = {
  generic: "Telefonanlage (JSON)",
  sipgate: "sipgate",
  placetel: "Placetel",
  test: "Testanruf",
};

const CAUSE_LABELS: Record<string, string> = {
  normalclearing: "normal beendet",
  normal: "normal beendet",
  busy: "besetzt",
  cancel: "Anrufer hat aufgelegt",
  canceled: "Anrufer hat aufgelegt",
  cancelled: "Anrufer hat aufgelegt",
  noanswer: "nicht angenommen",
  missed: "nicht angenommen",
  congestion: "Leitung überlastet",
  notfound: "Nummer nicht erreichbar",
  unavailable: "nicht erreichbar",
  forwarded: "weitergeleitet",
  transferred: "weitergeleitet",
  voicemail: "Mailbox",
  blocked: "blockiert",
  accepted: "normal beendet",
  test: "Testanruf",
};

/** Deutscher Text zum Grund des Auflegens; unbekannte Gründe so, wie die Anlage sie schickt. */
export function hangupCauseLabel(cause: string | null | undefined): string | null {
  if (!cause) return null;
  return CAUSE_LABELS[key(cause)] ?? cause;
}

/** Ein Anruf, der so lange „klingelt“, hat vermutlich keine Ende-Meldung bekommen. */
export const STALE_RINGING_MS = 15 * 60 * 1000;

export function isStaleRinging(call: { status: string; startedAt: Date | string }, now: Date = new Date()): boolean {
  return call.status === "RINGING" && now.getTime() - new Date(call.startedAt).getTime() > STALE_RINGING_MS;
}

/** Gesprächsdauer "35 Sek.", "4:12 Min." oder "1:02:03 Std."; null, wenn unbekannt. */
export function formatCallDuration(
  answeredAt: Date | string | null | undefined,
  endedAt: Date | string | null | undefined,
): string | null {
  if (!answeredAt || !endedAt) return null;
  const seconds = Math.round((new Date(endedAt).getTime() - new Date(answeredAt).getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${seconds} Sek.`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s} Std.` : `${m}:${s} Min.`;
}

function berlinDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Abstand der deutschen Zeit zu UTC in Minuten zu einem Zeitpunkt. */
function berlinOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** Beginn des Tages (0:00 Uhr deutscher Zeit), in dem date liegt. */
export function startOfBerlinDay(date: Date = new Date()): Date {
  const [y, m, d] = berlinDay(date).split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const guess = new Date(utcMidnight - berlinOffsetMinutes(new Date(utcMidnight)) * 60000);
  // Bei Zeitumstellung um Mitternacht einmal nachjustieren
  return new Date(utcMidnight - berlinOffsetMinutes(guess) * 60000);
}

function clockTime(d: Date): string {
  return new Intl.DateTimeFormat("de-DE", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
}

/** "12.10.2026, 8:05 Uhr" */
export function formatCallDateTime(date: Date | string): string {
  const d = new Date(date);
  const datePart = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  return `${datePart}, ${clockTime(d)} Uhr`;
}

/** "Heute, 9:12 Uhr", "Gestern, 17:40 Uhr" oder "12.10.2026, 8:05 Uhr" */
export function formatCallTime(date: Date | string, now: Date = new Date()): string {
  const d = new Date(date);
  const day = berlinDay(d);
  if (day === berlinDay(now)) return `Heute, ${clockTime(d)} Uhr`;
  if (day === berlinDay(new Date(startOfBerlinDay(now).getTime() - 12 * 60 * 60 * 1000))) return `Gestern, ${clockTime(d)} Uhr`;
  return formatCallDateTime(d);
}

/** Nummer der Gegenseite: eingehend der Anrufer, ausgehend der Angerufene. */
export function counterpartNumber(call: { direction: string; fromNumber: string | null; toNumber: string | null }): string | null {
  return (call.direction === "OUT" ? call.toNumber : call.fromNumber) || null;
}

/* ------------------------------------------------------------------ */
/* Absender-Prüfung für den Webhook                                    */
/* ------------------------------------------------------------------ */

/** Kommagetrennte Liste aus TELEPHONY_ALLOWED_IPS (IPv4, IPv4-Netze wie 1.2.3.0/24, IPv6). */
export function parseAllowedIps(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

function normalizeIp(ip: string): string {
  const s = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return s.startsWith("::ffff:") && s.includes(".") ? s.slice(7) : s;
}

/** Liegt die Adresse in einer der freigegebenen Adressen bzw. Netze? */
export function ipAllowed(ip: string | null | undefined, allowed: string[]): boolean {
  if (!ip) return false;
  const address = normalizeIp(ip);
  for (const entry of allowed) {
    const [net, bitsRaw] = entry.split("/");
    const normalizedNet = normalizeIp(net);
    if (bitsRaw === undefined) {
      if (normalizedNet === address) return true;
      continue;
    }
    const bits = Number(bitsRaw);
    const a = ipv4ToInt(address);
    const b = ipv4ToInt(normalizedNet);
    if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) continue;
    // Bitweise Operatoren arbeiten mit 32-Bit-Vorzeichen – deshalb per Division vergleichen
    const block = 2 ** (32 - bits);
    if (Math.floor(a / block) === Math.floor(b / block)) return true;
  }
  return false;
}

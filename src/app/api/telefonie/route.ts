import { NextResponse, type NextRequest } from "next/server";
import { parseHost } from "@/lib/hosts";
import { ipAllowed, parseCallWebhook, type ParseResult } from "@/lib/phone";
import { clientIp, rateLimit, rateLimitReached } from "@/lib/rate-limit";
import {
  TOKEN_HEADER,
  TOKEN_MIN_LENGTH,
  noteWebhookAccepted,
  noteWebhookRejection,
  processCallEvent,
  telephonyAllowedIps,
  telephonyToken,
  tokenMatches,
  webhookUrlWithToken,
} from "@/lib/telephony";

/**
 * Webhook für die Telefonanlage (nur Hauptdomain).
 *
 * Format A „generic“ (JSON, z. B. aus Asterisk/FreePBX/3CX-Skripten):
 *   { "event": "ringing"|"answered"|"ended"|"missed", "callId": "…", "from": "…", "to": "…",
 *     "direction": "in"|"out", "answeredBy": "…", "cause": "…" }
 * Format B „sipgate.io Push-API“ (Formulardaten): event=newCall|answer|hangup …
 *   Auf newCall antworten wir mit XML, damit sipgate auch Annahme und Auflegen meldet.
 * Zusätzlich erkannt: Placetel Notify-API (IncomingCall, CallAccepted, HungUp).
 *
 * Absicherung: TELEPHONY_WEBHOOK_TOKEN als ?token= oder Header X-Hertlin-Token,
 * optional TELEPHONY_ALLOWED_IPS (kommagetrennt, IPv4-Netze erlaubt).
 */

const MAX_BODY_BYTES = 64 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xml(body: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", ...NO_STORE },
  });
}

async function readPayload(request: NextRequest): Promise<ParseResult> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return { ok: false, error: "Die Meldung ist zu groß." };
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const params = new URLSearchParams();
      for (const [k, v] of form.entries()) if (typeof v === "string") params.append(k, v);
      return parseCallWebhook({ kind: "form", data: params });
    }
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return { ok: false, error: "Die Meldung ist zu groß." };
    if (contentType.includes("application/json") || text.trimStart().startsWith("{")) {
      return parseCallWebhook({ kind: "json", data: JSON.parse(text) as unknown });
    }
    return parseCallWebhook({ kind: "form", data: new URLSearchParams(text) });
  } catch {
    return { ok: false, error: "Die Meldung konnte nicht gelesen werden (kein gültiges JSON bzw. keine Formulardaten)." };
  }
}

export async function POST(request: NextRequest) {
  // Nur auf der Hauptdomain – Kundenportale kennen diese Adresse nicht
  const host = request.headers.get("x-forwarded-host")?.split(",")[0] ?? request.headers.get("host");
  if (parseHost(host).kind !== "main") return json({ error: "Nicht gefunden." }, 404);

  const token = telephonyToken();
  if (!token) return json({ error: "Die Anbindung der Telefonanlage ist nicht eingerichtet." }, 503);
  if (token.length < TOKEN_MIN_LENGTH) {
    noteWebhookRejection("token", `Zugangsschlüssel auf dem Server zu kurz (mindestens ${TOKEN_MIN_LENGTH} Zeichen)`);
    return json({ error: "Die Anbindung der Telefonanlage ist nicht vollständig eingerichtet." }, 503);
  }

  const ip = await clientIp();
  if (!rateLimit(`telephony:${ip}`, 600, 60 * 1000).ok) return json({ error: "Zu viele Meldungen." }, 429);

  const allowed = telephonyAllowedIps();
  if (allowed.length > 0 && !ipAllowed(ip, allowed)) {
    noteWebhookRejection("ip", ip);
    return json({ error: "Absender nicht freigegeben." }, 403);
  }

  // Nach zu vielen Fehlversuchen vergleichen wir gar nicht mehr – sonst ließe sich trotz Sperre weiter raten
  const authKey = `telephony-auth:${ip}`;
  if (rateLimitReached(authKey, 20)) return json({ error: "Zu viele Fehlversuche." }, 429);

  const given = request.nextUrl.searchParams.get("token") ?? request.headers.get(TOKEN_HEADER);
  if (!tokenMatches(given, token)) {
    noteWebhookRejection("token", given ? "falscher Zugangsschlüssel" : "kein Zugangsschlüssel mitgeschickt");
    rateLimit(authKey, 20, 10 * 60 * 1000);
    return json({ error: "Nicht berechtigt." }, 401);
  }

  const parsed = await readPayload(request);
  if (!parsed.ok) {
    if (parsed.ignore) {
      noteWebhookAccepted();
      return json({ ok: true, ignored: true });
    }
    noteWebhookRejection("format", parsed.error);
    return json({ error: parsed.error }, 400);
  }

  let result;
  try {
    result = await processCallEvent(parsed.event);
  } catch (error) {
    console.error("[telefonie] Meldung konnte nicht verarbeitet werden:", error instanceof Error ? error.message : error);
    return json({ error: "Die Meldung konnte nicht gespeichert werden." }, 500);
  }
  noteWebhookAccepted();

  if (parsed.event.provider === "sipgate") {
    if (parsed.event.kind === "ringing") {
      // sipgate schickt Annahme und Auflegen nur an Adressen, die wir hier nennen
      const url = xmlEscape(webhookUrlWithToken(token));
      return xml(`<Response onAnswer="${url}" onHangup="${url}"/>`);
    }
    return xml("<Response/>");
  }
  return json({ ok: true, id: result.id, status: result.status });
}

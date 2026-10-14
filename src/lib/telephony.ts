import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatTicketNumber } from "@/lib/format";
import { mainUrl } from "@/lib/hosts";
import {
  applyCallEvent,
  counterpartNumber,
  defaultCountry,
  externalCallId,
  formatCallDateTime,
  formatCallDuration,
  formatPhoneDisplay,
  isInternalNumber,
  normalizePhone,
  parseAllowedIps,
  phoneSearchSuffix,
  type CallDirection,
  type CallEvent,
  type CallState,
  type CallStatus,
} from "@/lib/phone";
import { publish } from "@/realtime/bus";

/**
 * Anbindung der Telefonanlage: Meldungen verarbeiten, Anrufer erkennen, Live-Hinweise verschicken.
 * Reine Hilfsfunktionen (Nummern, Formate, Ablauf) liegen in src/lib/phone.ts.
 */

/* ------------------------------------------------------------------ */
/* Konfiguration und Absicherung                                       */
/* ------------------------------------------------------------------ */

export const TELEPHONY_PATH = "/api/telefonie";
export const TOKEN_HEADER = "x-hertlin-token";

/** Zugangsschlüssel aus TELEPHONY_WEBHOOK_TOKEN oder null, wenn nicht eingerichtet. */
export function telephonyToken(): string | null {
  const token = process.env.TELEPHONY_WEBHOOK_TOKEN?.trim();
  return token ? token : null;
}

/** Freigegebene Absender aus TELEPHONY_ALLOWED_IPS (leer = keine Einschränkung). */
export function telephonyAllowedIps(): string[] {
  return parseAllowedIps(process.env.TELEPHONY_ALLOWED_IPS);
}

/** Vergleich in konstanter Zeit (auch bei unterschiedlicher Länge). */
export function tokenMatches(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Adresse des Webhooks inkl. Zugangsschlüssel (nur für Antworten an die Anlage, nie anzeigen). */
export function webhookUrlWithToken(token: string): string {
  return `${mainUrl(TELEPHONY_PATH)}?token=${encodeURIComponent(token)}`;
}

/** Adresse mit Platzhalter für die Anzeige in der Einrichtung. */
export function webhookUrlTemplate(placeholder = "IHR-ZUGANGSSCHLUESSEL"): string {
  return `${mainUrl(TELEPHONY_PATH)}?token=${placeholder}`;
}

/* ---------- Diagnose für die Einrichtungsseite (nur im Speicher) ---------- */

export type WebhookRejection = { at: Date; reason: "token" | "ip" | "format"; detail: string | null };

type DiagnosticsState = { lastRejection: WebhookRejection | null; lastAccepted: Date | null };
const g = globalThis as unknown as { __hertlinTelephony?: DiagnosticsState };

function diagnostics(): DiagnosticsState {
  g.__hertlinTelephony ??= { lastRejection: null, lastAccepted: null };
  return g.__hertlinTelephony;
}

export function noteWebhookRejection(reason: WebhookRejection["reason"], detail: string | null = null): void {
  diagnostics().lastRejection = { at: new Date(), reason, detail: detail ? detail.slice(0, 200) : null };
}

export function noteWebhookAccepted(): void {
  diagnostics().lastAccepted = new Date();
}

export function telephonyStatus() {
  const token = telephonyToken();
  const state = diagnostics();
  return {
    tokenSet: token !== null,
    tokenTooShort: token !== null && token.length < 24,
    allowedIps: telephonyAllowedIps(),
    defaultCountry: defaultCountry(),
    lastRejection: state.lastRejection,
    lastAccepted: state.lastAccepted,
  };
}

/* ------------------------------------------------------------------ */
/* Anrufer erkennen                                                    */
/* ------------------------------------------------------------------ */

export type CallerMatch = {
  source: "user" | "company" | "ticket" | "inquiry";
  /** z. B. "Claudia Berger · Muster Steuerberatung GmbH" */
  label: string;
  userId: string | null;
  /** Firma des Anrufers (bei Benutzern einer Unterkunde: die Unterkunde) */
  companyId: string | null;
  /** Firmenkunde für Links in der Verwaltung */
  rootCompanyId: string | null;
  rootCompanyName: string | null;
  /** Privatkunden-Ticket bzw. Ticket, über das die Nummer erkannt wurde */
  ticketId: number | null;
  inquiryId: number | null;
  /** Vorschlag für Kontaktfelder, wenn kein Benutzerkonto erkannt wurde */
  contactName: string | null;
  contactEmail: string | null;
};

type CompanyRef = { id: string; name: string; parentId: string | null; parent: { id: string; name: string } | null };

const companyRefSelect = {
  id: true,
  name: true,
  parentId: true,
  parent: { select: { id: true, name: true } },
} satisfies Prisma.CompanySelect;

/** "Muster Steuerberatung GmbH" bzw. "Muster Steuerberatung GmbH › Büro Ulm" */
export function companyPath(company: CompanyRef): string {
  return company.parent ? `${company.parent.name} › ${company.name}` : company.name;
}

function rootOf(company: CompanyRef): { id: string; name: string } {
  return company.parent ?? { id: company.id, name: company.name };
}

/** Nur Ziffern (für den Vergleich unformatiert gespeicherter Nummern in SQL). */
function digitsOnly(column: string): Prisma.Sql {
  return Prisma.raw(
    `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${column}, ' ', ''), '-', ''), '/', ''), '(', ''), ')', ''), '.', ''), '+', '')`,
  );
}

/**
 * IDs der Datensätze, deren Nummer (ohne Leer- und Trennzeichen) auf eine der Endungen ausgeht.
 * Telefonnummern stehen unformatiert in der Datenbank; der genaue Vergleich folgt danach normalisiert.
 */
async function idsWithPhoneSuffix(
  table: "User" | "Company" | "Ticket" | "Inquiry",
  column: "phone" | "contactPhone",
  suffixes: string[],
): Promise<Array<string | number>> {
  if (suffixes.length === 0) return [];
  const col = `"${column}"`;
  const conditions = suffixes.map((s) => Prisma.sql`${digitsOnly(col)} LIKE ${`%${s}`}`);
  const rows = await db.$queryRaw<{ id: string | number | bigint }[]>(
    Prisma.sql`SELECT "id" AS id FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(col)} IS NOT NULL AND (${Prisma.join(conditions, " OR ")}) LIMIT 500`,
  );
  return rows.map((r) => (typeof r.id === "bigint" ? Number(r.id) : r.id));
}

const CUSTOMER_ROLES = ["CUSTOMER_ADMIN", "CUSTOMER_USER"];

/**
 * Sucht zu mehreren Nummern die passenden Kunden. Reihenfolge:
 * Benutzer eines Kunden (aktive zuerst) → Firmen-/Unterkunden-Nummer → Ticket-Kontakt (jüngstes) → Anfrage (jüngste).
 * Mitarbeiter von Hertlin werden nie zugeordnet. Schlüssel der Ergebnis-Map: normalisierte Nummer.
 */
export async function matchCallers(numbers: Array<string | null | undefined>): Promise<Map<string, CallerMatch>> {
  const result = new Map<string, CallerMatch>();
  const targets = [
    ...new Set(numbers.map((n) => normalizePhone(n)).filter((n): n is string => !!n && !isInternalNumber(n))),
  ];
  if (targets.length === 0) return result;
  const suffixes = [...new Set(targets.map((t) => phoneSearchSuffix(t)).filter((s): s is string => !!s))];

  const [userIds, companyIds, ticketIds, inquiryIds] = await Promise.all([
    idsWithPhoneSuffix("User", "phone", suffixes),
    idsWithPhoneSuffix("Company", "phone", suffixes),
    idsWithPhoneSuffix("Ticket", "contactPhone", suffixes),
    idsWithPhoneSuffix("Inquiry", "phone", suffixes),
  ]);

  const [users, companies, tickets, inquiries] = await Promise.all([
    userIds.length
      ? db.user.findMany({
          where: { id: { in: userIds.map(String) }, role: { in: CUSTOMER_ROLES }, companyId: { not: null } },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            active: true,
            company: { select: { ...companyRefSelect, active: true, parent: { select: { id: true, name: true, active: true } } } },
          },
          orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
        })
      : [],
    companyIds.length
      ? db.company.findMany({
          where: { id: { in: companyIds.map(String) } },
          select: { ...companyRefSelect, phone: true, active: true, email: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    ticketIds.length
      ? db.ticket.findMany({
          where: { id: { in: ticketIds.map(Number) } },
          select: { id: true, contactName: true, contactEmail: true, contactPhone: true, company: { select: companyRefSelect } },
          orderBy: { createdAt: "desc" },
        })
      : [],
    inquiryIds.length
      ? db.inquiry.findMany({
          where: { id: { in: inquiryIds.map(Number) } },
          select: { id: true, name: true, companyName: true, email: true, phone: true, company: { select: companyRefSelect } },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  // Aktive Benutzer aktiver Kunden zuerst, sonst Reihenfolge der Abfrage (zuletzt angemeldet zuerst)
  const userRank = (u: (typeof users)[number]) =>
    u.active && u.company?.active && u.company.parent?.active !== false ? 0 : 1;
  const sortedUsers = [...users].sort((a, b) => userRank(a) - userRank(b));
  const sortedCompanies = [...companies].sort((a, b) => Number(!a.active) - Number(!b.active));

  for (const target of targets) {
    const user = sortedUsers.find((u) => u.company && normalizePhone(u.phone) === target);
    if (user?.company) {
      const root = rootOf(user.company);
      result.set(target, {
        source: "user",
        label: `${user.name} · ${companyPath(user.company)}`,
        userId: user.id,
        companyId: user.company.id,
        rootCompanyId: root.id,
        rootCompanyName: root.name,
        ticketId: null,
        inquiryId: null,
        contactName: user.name,
        contactEmail: user.email,
      });
      continue;
    }

    const company = sortedCompanies.find((c) => normalizePhone(c.phone) === target);
    if (company) {
      const root = rootOf(company);
      result.set(target, {
        source: "company",
        label: companyPath(company),
        userId: null,
        companyId: company.id,
        rootCompanyId: root.id,
        rootCompanyName: root.name,
        ticketId: null,
        inquiryId: null,
        contactName: null,
        contactEmail: null,
      });
      continue;
    }

    const ticket = tickets.find((t) => normalizePhone(t.contactPhone) === target);
    if (ticket) {
      const root = ticket.company ? rootOf(ticket.company) : null;
      result.set(target, {
        source: "ticket",
        label: ticket.company
          ? `${ticket.contactName ?? "Ansprechpartner"} · ${companyPath(ticket.company)}`
          : `Privatkunde: ${ticket.contactName ?? "Name unbekannt"} (${formatTicketNumber(ticket.id)})`,
        userId: null,
        companyId: ticket.company?.id ?? null,
        rootCompanyId: root?.id ?? null,
        rootCompanyName: root?.name ?? null,
        ticketId: ticket.id,
        inquiryId: null,
        contactName: ticket.contactName,
        contactEmail: ticket.contactEmail,
      });
      continue;
    }

    const inquiry = inquiries.find((i) => normalizePhone(i.phone) === target);
    if (inquiry) {
      const root = inquiry.company ? rootOf(inquiry.company) : null;
      result.set(target, {
        source: "inquiry",
        label: inquiry.company
          ? `${inquiry.name} · ${companyPath(inquiry.company)}`
          : `Interessent: ${inquiry.name}${inquiry.companyName ? `, ${inquiry.companyName}` : ""}`,
        userId: null,
        companyId: inquiry.company?.id ?? null,
        rootCompanyId: root?.id ?? null,
        rootCompanyName: root?.name ?? null,
        ticketId: null,
        inquiryId: inquiry.id,
        contactName: inquiry.name,
        contactEmail: inquiry.email,
      });
    }
  }
  return result;
}

/** Anrufer zu einer Nummer oder null. Fehler bei der Suche verhindern nie das Protokollieren des Anrufs. */
export async function matchCaller(number: string | null | undefined): Promise<CallerMatch | null> {
  const n = normalizePhone(number);
  if (!n || isInternalNumber(n)) return null;
  try {
    return (await matchCallers([n])).get(n) ?? null;
  } catch (error) {
    console.error("[telefonie] Anrufer konnte nicht zugeordnet werden:", error instanceof Error ? error.message : error);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Meldungen verarbeiten                                               */
/* ------------------------------------------------------------------ */

const callStateSelect = {
  id: true,
  direction: true,
  status: true,
  fromNumber: true,
  toNumber: true,
  answeredAt: true,
  endedAt: true,
  answeredBy: true,
  hangupCause: true,
  companyId: true,
  callerLabel: true,
} satisfies Prisma.PhoneCallSelect;

export type ProcessedCall = { id: string; status: CallStatus; created: boolean; changed: boolean };

function sameTime(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

class ConcurrentUpdate extends Error {}

function publishIncoming(callId: string, from: string | null, match: CallerMatch | null): void {
  publish({
    type: "staff.notice",
    notice: {
      kind: "call.incoming",
      callId,
      from: formatPhoneDisplay(from),
      callerLabel: match?.label ?? null,
      companyId: match?.rootCompanyId ?? null,
      companyName: match?.rootCompanyName ?? null,
    },
  });
}

function publishUpdated(callId: string, status: string, answeredBy: string | null): void {
  publish({ type: "staff.notice", notice: { kind: "call.updated", callId, status, answeredBy } });
}

async function processOnce(event: CallEvent, now: Date): Promise<ProcessedCall> {
  const externalId = externalCallId(event);
  const from = normalizePhone(event.from);
  const to = normalizePhone(event.to);
  const existing = await db.phoneCall.findUnique({ where: { externalId }, select: callStateSelect });

  if (!existing) {
    const state = applyCallEvent(null, event, now);
    const match = await matchCaller(state.direction === "OUT" ? to : from);
    const call = await db.phoneCall.create({
      data: {
        externalId,
        provider: event.provider,
        direction: state.direction,
        fromNumber: from ?? "",
        toNumber: to,
        status: state.status,
        answeredBy: state.answeredBy,
        hangupCause: state.hangupCause,
        answeredAt: state.answeredAt,
        endedAt: state.endedAt,
        startedAt: event.at ?? now,
        companyId: match?.companyId ?? null,
        userId: match?.userId ?? null,
        callerLabel: match?.label ?? null,
      },
      select: { id: true },
    });
    // Live-Hinweise nur für eingehende Anrufe; ausgehende werden nur protokolliert
    if (state.direction === "IN") {
      if (state.status === "RINGING") publishIncoming(call.id, from, match);
      else publishUpdated(call.id, state.status, state.answeredBy);
    }
    return { id: call.id, status: state.status, created: true, changed: true };
  }

  const current: CallState = {
    status: existing.status as CallStatus,
    direction: existing.direction === "OUT" ? "OUT" : "IN",
    answeredAt: existing.answeredAt,
    endedAt: existing.endedAt,
    answeredBy: existing.answeredBy,
    hangupCause: existing.hangupCause,
  };
  const next = applyCallEvent(current, event, now);

  const data: Prisma.PhoneCallUncheckedUpdateManyInput = {};
  if (next.status !== current.status) data.status = next.status;
  if (!sameTime(next.answeredAt, current.answeredAt)) data.answeredAt = next.answeredAt;
  if (!sameTime(next.endedAt, current.endedAt)) data.endedAt = next.endedAt;
  if (next.answeredBy !== current.answeredBy) data.answeredBy = next.answeredBy;
  if (next.hangupCause !== current.hangupCause) data.hangupCause = next.hangupCause;
  if (!existing.fromNumber && from) data.fromNumber = from;
  if (!existing.toNumber && to) data.toNumber = to;

  // Die erste Meldung kam ohne Nummer – Anrufer jetzt nachträglich erkennen
  const counterpartNew = current.direction === "OUT" ? (data.toNumber as string | undefined) : (data.fromNumber as string | undefined);
  if (counterpartNew && !existing.companyId && !existing.callerLabel) {
    const match = await matchCaller(counterpartNew);
    if (match) {
      data.companyId = match.companyId;
      data.userId = match.userId;
      data.callerLabel = match.label;
    }
  }

  if (Object.keys(data).length === 0) return { id: existing.id, status: current.status, created: false, changed: false };

  // Nur schreiben, wenn sich der Stand seit dem Lesen nicht geändert hat (gleichzeitige Meldungen)
  const updated = await db.phoneCall.updateMany({
    where: {
      id: existing.id,
      status: existing.status,
      answeredAt: existing.answeredAt,
      endedAt: existing.endedAt,
    },
    data,
  });
  if (updated.count === 0) throw new ConcurrentUpdate();

  if (data.status && current.direction === "IN") publishUpdated(existing.id, next.status, next.answeredBy);
  return { id: existing.id, status: next.status, created: false, changed: true };
}

/**
 * Verarbeitet eine Meldung der Telefonanlage: legt den Anruf an bzw. schreibt den neuen Stand fort
 * und verschickt die Live-Hinweise. Doppelte und verspätete Meldungen sind unschädlich.
 */
export async function processCallEvent(event: CallEvent, now: Date = new Date()): Promise<ProcessedCall> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await processOnce(event, now);
    } catch (error) {
      const retry =
        error instanceof ConcurrentUpdate ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002");
      // Zwei Meldungen zum selben Anruf gleichzeitig: beim nächsten Versuch ist der neue Stand sichtbar
      if (retry && attempt < 4) continue;
      throw error;
    }
  }
}

/** Live-Signal nach Änderungen aus der Verwaltung (Liste in anderen Browsern aktualisieren). */
export async function publishCallChanged(callId: string): Promise<void> {
  const call = await db.phoneCall.findUnique({ where: { id: callId }, select: { status: true, answeredBy: true } });
  if (call) publishUpdated(callId, call.status, call.answeredBy);
}

/** Beendet einen simulierten Anruf nach kurzer Zeit wieder (Testanruf aus der Einrichtung). */
export function scheduleTestCallEnd(callId: string, delayMs = 20_000): void {
  const timer = setTimeout(async () => {
    // Inzwischen gelöscht (Testanrufe entfernt)? Dann nichts neu anlegen.
    const exists = await db.phoneCall
      .count({ where: { externalId: externalCallId({ provider: "test", callId }) } })
      .catch(() => 0);
    if (!exists) return;
    const event: CallEvent = {
      provider: "test",
      kind: "ended",
      callId,
      direction: "IN",
      from: null,
      to: null,
      answeredBy: null,
      cause: "test",
      at: null,
    };
    processCallEvent(event).catch((error) =>
      console.error("[telefonie] Testanruf konnte nicht beendet werden:", error instanceof Error ? error.message : error),
    );
  }, delayMs);
  timer.unref?.();
}

/* ------------------------------------------------------------------ */
/* Texte                                                               */
/* ------------------------------------------------------------------ */

/**
 * Eine Zeile für die interne Notiz im Ticket, z. B.
 * "Telefonat am 14.10.2026, 9:12 Uhr mit Claudia Berger · Muster GmbH (+49 711 12345), angenommen von Jonas Keller, Dauer 4:12 Min."
 */
export function describeCall(
  call: {
    direction: string;
    status: string;
    fromNumber: string;
    toNumber: string | null;
    startedAt: Date;
    answeredAt: Date | null;
    endedAt: Date | null;
    answeredBy: string | null;
    callerLabel: string | null;
  },
  who?: string | null,
): string {
  const number = counterpartNumber(call);
  const person = who || call.callerLabel;
  const target = [person, number ? `(${formatPhoneDisplay(number)})` : null].filter(Boolean).join(" ") || "unbekannter Nummer";
  const when = formatCallDateTime(call.startedAt);
  const duration = formatCallDuration(call.answeredAt, call.endedAt);
  const direction: CallDirection = call.direction === "OUT" ? "OUT" : "IN";

  let text: string;
  if (direction === "OUT") {
    text = `Ausgehendes Telefonat am ${when} mit ${target}`;
    if (call.answeredBy) text += `, geführt von ${call.answeredBy}`;
  } else if (call.status === "MISSED") {
    text = `Verpasster Anruf am ${when} von ${target}`;
  } else {
    text = `Telefonat am ${when} mit ${target}`;
    if (call.answeredBy) text += `, angenommen von ${call.answeredBy}`;
  }
  if (duration) text += `, Dauer ${duration}`;
  return text.endsWith(".") ? text : `${text}.`;
}

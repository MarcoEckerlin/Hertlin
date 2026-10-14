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
/** Kürzere Zugangsschlüssel lehnt der Webhook ab, weil sie sich erraten lassen. */
export const TOKEN_MIN_LENGTH = 24;

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
    tokenTooShort: token !== null && token.length < TOKEN_MIN_LENGTH,
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
  /** "ambiguous": verschiedene Kunden haben diese Nummer hinterlegt – nichts zuordnen */
  source: "user" | "company" | "ticket" | "inquiry" | "ambiguous";
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

/** Anzeige, wenn verschiedene Kunden dieselbe Nummer hinterlegt haben. */
export const AMBIGUOUS_CALLER_LABEL = "Nummer bei mehreren Kunden hinterlegt";

/** Mehrdeutige Treffer ordnen nichts zu – weder Kunde noch Ansprechpartner. */
export function isAmbiguousCaller(match: CallerMatch | null | undefined): boolean {
  return match?.source === "ambiguous";
}

/** Bezeichnung, die am Anruf gespeichert wird (bei mehrdeutigen Treffern keine). */
export function storedCallerLabel(match: CallerMatch | null | undefined): string | null {
  return match && !isAmbiguousCaller(match) ? match.label : null;
}

type CandidateCompany = CompanyRef & {
  active: boolean;
  parent: { id: string; name: string; active: boolean } | null;
};

/** Alle Einträge mit derselben Nummer, jeweils in der gewünschten Reihenfolge. */
export type CallerCandidates = {
  /** Benutzer eines Kunden (zuletzt angemeldet zuerst) */
  users: Array<{ id: string; name: string; email: string; active: boolean; company: CandidateCompany }>;
  /** Firmenkunden und Unterkunden (älteste zuerst) */
  companies: CandidateCompany[];
  /** Tickets mit dieser Kontaktnummer (jüngstes zuerst) */
  tickets: Array<{ id: number; contactName: string | null; contactEmail: string | null; company: CandidateCompany | null }>;
  /** Anfragen (jüngste zuerst) */
  inquiries: Array<{ id: number; name: string; companyName: string | null; email: string; company: CompanyRef | null }>;
};

function companyIsActive(company: CandidateCompany): boolean {
  return company.active && company.parent?.active !== false;
}

/** Nur die aktiven Einträge, wenn es welche gibt – sonst alle (z. B. ehemaliger Kunde). */
function preferActive<T>(items: T[], isActive: (item: T) => boolean): T[] {
  const active = items.filter(isActive);
  return active.length > 0 ? active : items;
}

function distinctCount(values: string[]): number {
  return new Set(values).size;
}

function ambiguousMatch(): CallerMatch {
  return {
    source: "ambiguous",
    label: AMBIGUOUS_CALLER_LABEL,
    userId: null,
    companyId: null,
    rootCompanyId: null,
    rootCompanyName: null,
    ticketId: null,
    inquiryId: null,
    contactName: null,
    contactEmail: null,
  };
}

function companyMatch(company: CompanyRef): CallerMatch {
  const root = rootOf(company);
  return {
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
  };
}

function ticketMatch(ticket: CallerCandidates["tickets"][number]): CallerMatch {
  const root = ticket.company ? rootOf(ticket.company) : null;
  return {
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
  };
}

/**
 * Entscheidet, wem eine Nummer gehört. Reihenfolge:
 * 1. Nummer eines aktiven Firmenkunden – die pflegt nur Hertlin, sie legt den Kunden fest.
 *    Gleiche Nummern, die andere Kunden selbst eingetragen haben, zählen dann nicht.
 * 2. Von Kunden selbst gepflegte Nummern (Benutzer, Unterkunden, Kontaktnummer in Firmen-Tickets):
 *    nur, wenn sie alle zum selben Firmenkunden gehören. Teilen sich mehrere Personen eine Nummer
 *    (z. B. die Zentrale), schlagen wir nur die Firma vor.
 * 3. Privatkunden-Ticket, 4. Anfrage – jeweils nur, wenn alle Treffer zur selben Person gehören.
 * Nennen verschiedene Kunden dieselbe Nummer, wird nichts automatisch zugeordnet („mehrdeutig“).
 */
export function resolveCaller(candidates: CallerCandidates): CallerMatch | null {
  const roots = candidates.companies.filter((c) => c.parentId === null);
  const activeRoots = roots.filter(companyIsActive);
  if (distinctCount(activeRoots.map((c) => c.id)) > 1) return ambiguousMatch();
  if (activeRoots.length === 1) return companyMatch(activeRoots[0]);

  const companyTickets = candidates.tickets.filter(
    (t): t is CallerCandidates["tickets"][number] & { company: CandidateCompany } => t.company !== null,
  );
  const claims = [
    ...candidates.users.map((u) => ({ root: rootOf(u.company), active: u.active && companyIsActive(u.company) })),
    ...candidates.companies.map((c) => ({ root: rootOf(c), active: companyIsActive(c) })),
    ...companyTickets.map((t) => ({ root: rootOf(t.company), active: companyIsActive(t.company) })),
  ];
  const tenants = preferActive(claims, (c) => c.active).map((c) => c.root);
  if (distinctCount(tenants.map((r) => r.id)) > 1) return ambiguousMatch();

  if (tenants.length > 0) {
    const tenant = tenants[0];
    const inTenant = (company: CompanyRef) => rootOf(company).id === tenant.id;
    const tenantRoot: CompanyRef = { id: tenant.id, name: tenant.name, parentId: null, parent: null };

    const users = preferActive(
      candidates.users.filter((u) => inTenant(u.company)),
      (u) => u.active && companyIsActive(u.company),
    );
    if (users.length === 1) {
      const user = users[0];
      const root = rootOf(user.company);
      return {
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
      };
    }
    if (users.length > 1) {
      return companyMatch(distinctCount(users.map((u) => u.company.id)) === 1 ? users[0].company : tenantRoot);
    }

    const companies = preferActive(candidates.companies.filter(inTenant), companyIsActive);
    if (companies.length > 0) return companyMatch(companies.length === 1 ? companies[0] : tenantRoot);

    const ticket = companyTickets.find((t) => inTenant(t.company));
    return ticket ? ticketMatch(ticket) : companyMatch(tenantRoot);
  }

  // Privatkunden: dieselbe Person erkennen wir an der E-Mail-Adresse
  const privateTickets = candidates.tickets.filter((t) => t.company === null);
  if (privateTickets.length > 0) {
    const owners = privateTickets.map((t) => t.contactEmail?.trim().toLowerCase() || `ticket:${t.id}`);
    return distinctCount(owners) > 1 ? ambiguousMatch() : ticketMatch(privateTickets[0]);
  }

  if (candidates.inquiries.length > 0) {
    const owners = candidates.inquiries.map((i) => (i.company ? `kunde:${rootOf(i.company).id}` : i.email.trim().toLowerCase()));
    if (distinctCount(owners) > 1) return ambiguousMatch();
    const inquiry = candidates.inquiries[0];
    const root = inquiry.company ? rootOf(inquiry.company) : null;
    return {
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
    };
  }
  return null;
}

const candidateCompanySelect = {
  ...companyRefSelect,
  active: true,
  parent: { select: { id: true, name: true, active: true } },
} satisfies Prisma.CompanySelect;

/**
 * Sucht zu mehreren Nummern die passenden Kunden (Regeln siehe resolveCaller).
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
          select: { id: true, name: true, email: true, phone: true, active: true, company: { select: candidateCompanySelect } },
          orderBy: [{ lastLoginAt: "desc" }, { createdAt: "desc" }],
        })
      : [],
    companyIds.length
      ? db.company.findMany({
          where: { id: { in: companyIds.map(String) } },
          select: { ...candidateCompanySelect, phone: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    ticketIds.length
      ? db.ticket.findMany({
          where: { id: { in: ticketIds.map(Number) } },
          select: { id: true, contactName: true, contactEmail: true, contactPhone: true, company: { select: candidateCompanySelect } },
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

  for (const target of targets) {
    const match = resolveCaller({
      users: users.flatMap((u) => (u.company && normalizePhone(u.phone) === target ? [{ ...u, company: u.company }] : [])),
      companies: companies.filter((c) => normalizePhone(c.phone) === target),
      tickets: tickets.filter((t) => normalizePhone(t.contactPhone) === target),
      inquiries: inquiries.filter((i) => normalizePhone(i.phone) === target),
    });
    if (match) result.set(target, match);
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
        callerLabel: storedCallerLabel(match),
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
    if (match && !isAmbiguousCaller(match)) {
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

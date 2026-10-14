import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { generateToken } from "@/lib/crypto";
import { mainUrl } from "@/lib/hosts";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Anfragen-Chat: Interessenten schreiben über ihren persönlichen Link (/anfrage/<token>)
 * mit dem Hertlin-Team, ohne Konto. Das Token ist das einzige Geheimnis.
 *
 * Grundsätze:
 * - Gäste bekommen nur, was sie selbst geschrieben haben, die Antworten von Hertlin und den Namen
 *   des Mitarbeiters – nie interne Notizen, E-Mail-Adressen des Teams oder die Zuordnung zu Kunden.
 * - Verwaltungsdaten lädt nur, wer requireStaff() besteht.
 */

/** Tokens aus generateToken() sind base64url; offensichtlich falsche Werte gar nicht erst abfragen. */
const INQUIRY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;

/** Längste Chat-Nachricht in Zeichen (Gast und Team). */
export const INQUIRY_MESSAGE_MAX = 4000;

/** Kennung des Verlaufseintrags, der die ursprüngliche Anfrage aus dem Formular zeigt. */
export const ORIGINAL_ENTRY_ID = "anfrage";

export function isPlausibleInquiryToken(token: unknown): token is string {
  return typeof token === "string" && INQUIRY_TOKEN_PATTERN.test(token);
}

/** Absoluter Link zum Chat des Interessenten (für E-Mails und zum Kopieren). */
export function inquiryChatUrl(token: string): string {
  return mainUrl(`/anfrage/${token}`);
}

/**
 * Liefert den Chat-Link-Schlüssel der Anfrage und legt ihn bei Bedarf an.
 * Sicher bei gleichzeitigen Aufrufen: gesetzt wird nur, solange noch kein Schlüssel existiert.
 */
export async function ensureInquiryToken(inquiryId: number): Promise<string> {
  const existing = await db.inquiry.findUnique({ where: { id: inquiryId }, select: { guestToken: true } });
  if (!existing) throw new Error(`Anfrage ${inquiryId} nicht gefunden`);
  if (existing.guestToken) return existing.guestToken;

  const token = generateToken(24);
  const { count } = await db.inquiry.updateMany({ where: { id: inquiryId, guestToken: null }, data: { guestToken: token } });
  if (count === 1) return token;

  // Jemand war schneller – dessen Schlüssel gilt
  const again = await db.inquiry.findUnique({ where: { id: inquiryId }, select: { guestToken: true } });
  if (!again?.guestToken) throw new Error(`Chat-Link für Anfrage ${inquiryId} konnte nicht angelegt werden`);
  return again.guestToken;
}

/* ------------------------------------------------------------------ */
/* Status in Kundensprache                                             */
/* ------------------------------------------------------------------ */

export type CustomerInquiryStatus = {
  label: string;
  tone: BadgeTone;
  /** Ein Satz, was der Stand für den Interessenten bedeutet */
  note: string;
  closed: boolean;
};

/** Interne Status (Neu, Kontaktiert, Angebot, Auftrag, Kein Auftrag) so, wie der Interessent sie sehen soll. */
export function customerInquiryStatus(status: string): CustomerInquiryStatus {
  switch (status) {
    case "NEW":
      return {
        label: "Eingegangen",
        tone: "blue",
        note: "Ihre Anfrage liegt bei uns. Wir melden uns in der Regel innerhalb eines Werktags.",
        closed: false,
      };
    case "CONTACTED":
    case "OFFER_SENT":
      return {
        label: "In Bearbeitung",
        tone: "amber",
        note: "Wir kümmern uns um Ihre Anfrage. Fragen können Sie hier jederzeit stellen.",
        closed: false,
      };
    case "WON":
    case "LOST":
      return {
        label: "Abgeschlossen",
        tone: "gray",
        note: "Diese Anfrage ist abgeschlossen. Sie können uns hier trotzdem weiterhin schreiben.",
        closed: true,
      };
    default:
      return { label: "In Bearbeitung", tone: "amber", note: "Wir kümmern uns um Ihre Anfrage.", closed: false };
  }
}

/* ------------------------------------------------------------------ */
/* Verlauf                                                             */
/* ------------------------------------------------------------------ */

/** Ein Eintrag im Chat-Verlauf. Die ursprüngliche Anfrage ist der erste Eintrag (isOriginal). */
export type InquiryChatEntry = {
  id: string;
  body: string;
  fromStaff: boolean;
  /** Anzeigename: Mitarbeiter bzw. Interessent */
  authorName: string;
  authorId: string | null;
  createdAt: Date;
  isOriginal: boolean;
};

const messageSelect = {
  id: true,
  body: true,
  fromStaff: true,
  authorId: true,
  authorName: true,
  createdAt: true,
  author: { select: { name: true } },
} satisfies Prisma.InquiryMessageSelect;

type MessageRow = Prisma.InquiryMessageGetPayload<{ select: typeof messageSelect }>;

function toEntries(
  inquiry: { id: number; name: string; message: string; createdAt: Date },
  messages: MessageRow[],
  staffFallback: string,
): InquiryChatEntry[] {
  const original: InquiryChatEntry = {
    id: ORIGINAL_ENTRY_ID,
    body: inquiry.message,
    fromStaff: false,
    authorName: inquiry.name,
    authorId: null,
    createdAt: inquiry.createdAt,
    isOriginal: true,
  };
  return [
    original,
    ...messages.map((m) => ({
      id: m.id,
      body: m.body,
      fromStaff: m.fromStaff,
      authorName: m.fromStaff ? (m.author?.name ?? m.authorName ?? staffFallback) : (m.authorName ?? inquiry.name),
      authorId: m.authorId,
      createdAt: m.createdAt,
      isOriginal: false,
    })),
  ];
}

/** Alles, was der Interessent über seinen Link sehen darf. */
const guestInquirySelect = {
  id: true,
  customerType: true,
  name: true,
  topic: true,
  message: true,
  status: true,
  language: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { slug: true, active: true, parent: { select: { slug: true, active: true } } } },
  messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: messageSelect },
} satisfies Prisma.InquirySelect;

export type GuestInquiryChat = {
  id: number;
  customerType: string;
  name: string;
  topic: string;
  status: string;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Kürzel des Kundenportals, falls aus dem Interessenten inzwischen ein aktiver Firmenkunde wurde */
  portalSlug: string | null;
  /** Mitarbeiter, der zuletzt geschrieben hat */
  contactPerson: string | null;
  entries: InquiryChatEntry[];
};

/** Anfrage über den Chat-Link laden. null bei unbekanntem oder offensichtlich falschem Token. */
export async function loadGuestInquiryChat(token: string, staffFallback: string): Promise<GuestInquiryChat | null> {
  if (!isPlausibleInquiryToken(token)) return null;
  const inquiry = await db.inquiry.findUnique({ where: { guestToken: token }, select: guestInquirySelect });
  if (!inquiry) return null;

  const company = inquiry.company;
  const root = company?.parent ?? company;
  const portalSlug = company && company.active && root?.active ? (root.slug ?? null) : null;
  const lastStaff = [...inquiry.messages].reverse().find((m) => m.fromStaff);

  return {
    id: inquiry.id,
    customerType: inquiry.customerType,
    name: inquiry.name,
    topic: inquiry.topic,
    status: inquiry.status,
    language: inquiry.language,
    createdAt: inquiry.createdAt,
    updatedAt: inquiry.updatedAt,
    portalSlug,
    contactPerson: lastStaff ? (lastStaff.author?.name ?? lastStaff.authorName ?? null) : null,
    entries: toEntries(inquiry, inquiry.messages, staffFallback),
  };
}

/** Kleinste Auswahl für Server Actions des Gastes: nur prüfen, ob der Link gilt. */
export async function findInquiryByToken(token: unknown) {
  if (!isPlausibleInquiryToken(token)) return null;
  return db.inquiry.findUnique({
    where: { guestToken: token },
    select: { id: true, name: true, companyName: true, email: true, topic: true, status: true, language: true },
  });
}

export type StaffInquiryChat = {
  id: number;
  name: string;
  companyName: string | null;
  email: string;
  status: string;
  language: string | null;
  guestToken: string | null;
  entries: InquiryChatEntry[];
};

/**
 * Chat einer Anfrage für die Verwaltung. Prüft selbst die Anmeldung (requireStaff),
 * damit die Komponente nicht versehentlich außerhalb der Verwaltung Daten liefert.
 */
export async function loadStaffInquiryChat(inquiryId: number, staffFallback: string): Promise<StaffInquiryChat | null> {
  await requireStaff();
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) return null;
  const inquiry = await db.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      id: true,
      name: true,
      companyName: true,
      email: true,
      message: true,
      status: true,
      language: true,
      guestToken: true,
      createdAt: true,
      messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: messageSelect },
    },
  });
  if (!inquiry) return null;
  return {
    id: inquiry.id,
    name: inquiry.name,
    companyName: inquiry.companyName,
    email: inquiry.email,
    status: inquiry.status,
    language: inquiry.language,
    guestToken: inquiry.guestToken,
    entries: toEntries(inquiry, inquiry.messages, staffFallback),
  };
}

/** Anfrage-ID aus Formularen: nur positive ganze Zahlen. */
export function parseInquiryId(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

import "server-only";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getPortalContext, type PortalContext } from "@/lib/auth";
import {
  customerMessagesWhere,
  customerTicketSelect,
  portalAssignableCompanyIds,
  portalTicketWhere,
} from "@/lib/permissions";
import { parseTicketNumber } from "@/lib/format";
import { isLangCode, type LangCode } from "@/lib/languages";
import { phoneHref } from "@/lib/phone";
import { getSiteSettings } from "@/lib/settings";
import { translationEnabled } from "@/lib/translate";
import { translateForViewer } from "@/lib/chat-translation";

/**
 * Gemeinsame Abfragen für die Kundenportal-Seiten und -Actions (Übersicht, Tickets, Profil).
 * Rechte: Aufrufer holen vorher den PortalContext über requirePortalContext().
 */

export type PortalCompanyOption = {
  id: string;
  name: string;
  /** true = der Firmenkunde selbst, false = Unterkunde */
  isRoot: boolean;
  active: boolean;
};

function sortCompanies(rootId: string, companies: { id: string; name: string; parentId: string | null; active: boolean }[]) {
  return companies
    .map((c) => ({ id: c.id, name: c.name, isRoot: c.id === rootId, active: c.active }))
    .sort((a, b) => (a.isRoot === b.isRoot ? a.name.localeCompare(b.name, "de") : a.isRoot ? -1 : 1));
}

/** Firmen, denen der Benutzer ein neues Ticket zuordnen darf (nur aktive). Firmenkunde zuerst, dann Unterkunden. */
export async function assignableCompanies(ctx: PortalContext): Promise<PortalCompanyOption[]> {
  const companies = await db.company.findMany({
    where: { id: { in: portalAssignableCompanyIds(ctx) }, active: true },
    select: { id: true, name: true, parentId: true, active: true },
  });
  return sortCompanies(ctx.root.id, companies);
}

/** Alle Firmen im Sichtbereich, z. B. für den Filter der Ticketliste (auch deaktivierte Unterkunden mit alten Tickets). */
export async function scopeCompanies(ctx: PortalContext): Promise<PortalCompanyOption[]> {
  const companies = await db.company.findMany({
    where: { id: { in: ctx.scopeCompanyIds } },
    select: { id: true, name: true, parentId: true, active: true },
  });
  return sortCompanies(ctx.root.id, companies);
}

/** Bezeichnung für E-Mails an das Team: Unterkunden mit Firmenkunde davor. */
export function staffCompanyLabel(ctx: PortalContext, company: { name: string; parentId: string | null }): string {
  return company.parentId ? `${ctx.root.name} › ${company.name}` : company.name;
}

/** Ticket-ID aus URL oder Formular. Akzeptiert nur positive ganze Zahlen. */
export function parseTicketId(value: unknown): number | null {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

/** Wie parseTicketId, akzeptiert aber auch die Anzeigeform „T-00042“ (z. B. aus einer abgetippten Adresse). */
export function parseTicketParam(value: string): number | null {
  const direct = parseTicketId(value);
  if (direct) return direct;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const id = parseTicketNumber(decoded);
  return id && id > 0 ? id : null;
}

/** Alle Portalseiten des Firmenkunden neu laden (Ticketzahlen, Listen, Name in der Seitenleiste). */
export function revalidatePortal(ctx: PortalContext): void {
  revalidatePath(`/portal/${ctx.root.slug}`, "layout");
}

/* ------------------------------------------------------------------ */
/* Ticketdetail                                                        */
/* ------------------------------------------------------------------ */

/** Ticket mit Verlauf für Kunden: ohne Kosten, ohne interne Notizen, nur Statuswechsel aus dem Protokoll. */
export const portalTicketDetailSelect = {
  ...customerTicketSelect,
  /** Betreuender Hertlin-Standort – nur für Telefon und Servicezeiten (portalContact) */
  locationId: true,
  messages: {
    where: customerMessagesWhere,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      body: true,
      fromStaff: true,
      authorId: true,
      authorName: true,
      createdAt: true,
      author: { select: { name: true } },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, size: true },
      },
    },
  },
  events: {
    where: { type: "STATUS" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      toValue: true,
      createdAt: true,
      actorId: true,
      actor: { select: { name: true, role: true } },
    },
  },
} satisfies Prisma.TicketSelect;

export type PortalTicketDetail = Prisma.TicketGetPayload<{ select: typeof portalTicketDetailSelect }>;

/** Ticket mit Verlauf im Sichtbereich des angemeldeten Portalbenutzers (pro Anfrage zwischengespeichert). */
export const loadPortalTicket = cache(async (id: number): Promise<PortalTicketDetail | null> => {
  const ctx = await getPortalContext();
  if (!ctx) return null;
  return db.ticket.findFirst({ where: { AND: [{ id }, portalTicketWhere(ctx)] }, select: portalTicketDetailSelect });
});

/**
 * Gibt es das Ticket im Sichtbereich? Schlanke Prüfung für das Layout der Ticketansicht –
 * läuft auch beim Vorladen von Links in der Ticketliste, deshalb ohne Verlauf.
 */
export const portalTicketExists = cache(async (id: number): Promise<boolean> => {
  const ctx = await getPortalContext();
  if (!ctx) return false;
  const ticket = await db.ticket.findFirst({ where: { AND: [{ id }, portalTicketWhere(ctx)] }, select: { id: true } });
  return ticket !== null;
});
export type PortalTicketMessage = PortalTicketDetail["messages"][number];
export type PortalTicketEvent = PortalTicketDetail["events"][number];

/** Ticketzeile für Listen. */
export type PortalTicketRow = Prisma.TicketGetPayload<{ select: typeof customerTicketSelect }>;

/* ------------------------------------------------------------------ */
/* Übersetzung der Nachrichten                                         */
/* ------------------------------------------------------------------ */

/** Nachrichten-ID -> Übersetzung in die Sprache des Lesers (nur Nachrichten, die übersetzt werden mussten). */
export type MessageTranslations = Record<string, { text: string; from: string | null }>;

/** Länger warten wir beim Seitenaufbau nicht auf den Übersetzungsdienst. */
const TRANSLATION_WAIT_MS = 6000;

/** Sprache, in der ein Portalbenutzer Nachrichten liest (Standard Deutsch). */
export function viewerLanguage(language: string | null | undefined): LangCode {
  return isLangCode(language) ? language : "de";
}

/**
 * Übersetzt die Nachrichten eines Tickets in die Sprache des Lesers (User.language).
 * - Eigene Nachrichten bleiben, wie sie geschrieben wurden.
 * - Bei Deutsch als Lesesprache werden nur Nachrichten von Kundenseite geprüft (Hertlin schreibt Deutsch).
 * - Dauert der Dienst zu lange oder fällt aus, bleiben die Originale stehen. Die Übersetzung läuft im
 *   Hintergrund weiter und liegt beim nächsten Laden im Zwischenspeicher.
 */
export async function portalMessageTranslations(
  messages: Pick<PortalTicketMessage, "id" | "body" | "authorId" | "fromStaff">[],
  viewer: { id: string; language: string | null | undefined },
): Promise<MessageTranslations> {
  const lang = viewerLanguage(viewer.language);
  if (!translationEnabled()) return {};
  const items = messages
    .filter((m) => m.authorId !== viewer.id && m.body.trim() !== "" && (lang !== "de" || !m.fromStaff))
    .map((m) => ({ id: m.id, body: m.body }));
  if (items.length === 0) return {};

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<MessageTranslations>((resolve) => {
    timer = setTimeout(() => resolve({}), TRANSLATION_WAIT_MS);
  });
  try {
    return await Promise.race([
      translateForViewer(items, lang).catch((error: unknown) => {
        console.error("[portal] Übersetzung der Nachrichten fehlgeschlagen:", error instanceof Error ? error.message : error);
        return {};
      }),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Kontakt: Telefon und Servicezeiten                                  */
/* ------------------------------------------------------------------ */

export type PortalContact = {
  /** Telefonnummer wie hinterlegt; null = keine echte Nummer vorhanden (dann kein Anruf-Hinweis) */
  phone: string | null;
  /** tel:-Link zur Nummer */
  phoneHref: string | null;
  /** Servicezeiten, z. B. { days: "Mo–Do", hours: "8:00 – 17:00 Uhr" } */
  hours: { days: string; hours: string }[];
  /** Hertlin-Standort, von dem Telefon/Zeiten stammen (null = allgemeine Firmendaten) */
  locationName: string | null;
};

/** Noch nicht ausgefüllte Vorgabe wie „TODO 0000 000000“ – so etwas sehen Kunden nie. */
export function isPlaceholderValue(value: string | null | undefined): boolean {
  return !value || !value.trim() || /\bTODO\b/i.test(value);
}

/** Öffnungszeiten eines Standorts (Freitext, eine Zeile pro Eintrag, „Mo–Do: 8:00 – 17:00 Uhr“). */
function parseLocationHours(text: string | null): { days: string; hours: string }[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !isPlaceholderValue(line))
    .map((line) => {
      const split = line.indexOf(": ");
      return split > 0 ? { days: line.slice(0, split).trim(), hours: line.slice(split + 2).trim() } : { days: line, hours: "" };
    });
}

const contactLocationSelect = { name: true, phone: true, openingHours: true, active: true } as const;

/**
 * Telefon und Servicezeiten für Kunden. Reihenfolge:
 * 1. Standort des Tickets (falls angegeben), sonst der Standort der Firma bzw. ihres Firmenkunden
 * 2. allgemeine Firmendaten (Verwaltung › Website › Firmendaten)
 * 3. Hauptsitz
 * Platzhalter („TODO …“) erscheinen nie – fehlt eine echte Nummer, gibt es keinen Anruf-Hinweis.
 */
export async function portalContact(opts: { companyId: string | null; locationId?: string | null }): Promise<PortalContact> {
  const [site, ticketLocation, company] = await Promise.all([
    getSiteSettings(),
    opts.locationId ? db.location.findUnique({ where: { id: opts.locationId }, select: contactLocationSelect }) : null,
    opts.companyId
      ? db.company.findUnique({
          where: { id: opts.companyId },
          select: {
            location: { select: contactLocationSelect },
            parent: { select: { location: { select: contactLocationSelect } } },
          },
        })
      : null,
  ]);
  const location = [ticketLocation, company?.location, company?.parent?.location].find((l) => l?.active) ?? null;

  const locationPhone = location && !isPlaceholderValue(location.phone) ? location.phone : null;
  const sitePhone = isPlaceholderValue(site.phone) ? null : site.phone;
  let phone = locationPhone ?? sitePhone;
  let link = locationPhone
    ? phoneHref(locationPhone)
    : sitePhone
      ? phoneHref(isPlaceholderValue(site.phoneHref) ? sitePhone : site.phoneHref)
      : null;
  if (!phone) {
    const main = await db.location.findFirst({
      where: { isMain: true, active: true },
      orderBy: { sortOrder: "asc" },
      select: contactLocationSelect,
    });
    if (main?.phone && !isPlaceholderValue(main.phone)) {
      phone = main.phone;
      link = phoneHref(main.phone);
    }
  }

  const locationHours = parseLocationHours(location?.openingHours ?? null);
  const hours =
    locationHours.length > 0
      ? locationHours
      : site.openingHours.filter((entry) => !isPlaceholderValue(entry.days) && !isPlaceholderValue(entry.hours));

  return {
    phone: phone && link ? phone : null,
    phoneHref: phone && link ? link : null,
    hours,
    locationName: location && (locationPhone || locationHours.length > 0) ? location.name : null,
  };
}

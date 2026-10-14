"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/settings";
import { isLangCode, languageLabel } from "@/lib/languages";
import {
  INQUIRY_MESSAGE_MAX,
  ensureInquiryToken,
  findInquiryByToken,
  isPlausibleInquiryToken,
  parseInquiryId,
} from "@/lib/inquiry-chat";
import { notifyProspectStaffMessage, notifyStaffProspectMessage, sendInquiryChatLink } from "@/lib/notifications-chat";
import { isCustomerWatchingInquiry, publish } from "@/realtime/bus";

/**
 * Server Actions für den Anfragen-Chat.
 * - Gast (Interessent): Zugang nur über das Token im versteckten Feld, wird bei jedem Aufruf neu geprüft.
 * - Team: requireStaff(), die Anfrage-ID aus dem Formular wird gegen die Datenbank geprüft.
 */

const TEN_MINUTES = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Bitte schreiben Sie zuerst eine Nachricht.")
    .max(
      INQUIRY_MESSAGE_MAX,
      `Die Nachricht ist zu lang (höchstens ${INQUIRY_MESSAGE_MAX.toLocaleString("de-DE")} Zeichen). Teilen Sie sie gern auf mehrere Nachrichten auf.`,
    ),
});

const languageSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || isLangCode(v), "Bitte eine Sprache aus der Liste wählen.")
  .transform((v) => (v === "" || v === "de" ? null : v));

async function failedMessage(): Promise<string> {
  const site = await getSiteSettings();
  return `Das hat leider nicht geklappt. Bitte versuchen Sie es gleich noch einmal oder rufen Sie uns an: ${site.phone}.`;
}

async function invalidLinkMessage(): Promise<string> {
  const site = await getSiteSettings();
  return `Dieser Chat-Link ist ungültig. Bitte öffnen Sie ihn direkt aus unserer E-Mail oder rufen Sie uns an: ${site.phone}.`;
}

function revalidateInquiry(inquiryId: number, token?: string | null) {
  revalidatePath(`/admin/anfragen/${inquiryId}`);
  revalidatePath("/admin/anfragen");
  if (token) revalidatePath(`/anfrage/${token}`);
}

/* ------------------------------------------------------------------ */
/* Interessent (Gast über /anfrage/<token>)                            */
/* ------------------------------------------------------------------ */

export async function guestInquiryMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  if (!isPlausibleInquiryToken(token)) return errorState(await invalidLinkMessage());

  const parsed = messageSchema.safeParse({ body: text(formData, "body") });
  if (!parsed.success) return fromZodError(parsed.error, formData, parsed.error.issues[0]?.message);

  let inquiry: Awaited<ReturnType<typeof findInquiryByToken>>;
  try {
    inquiry = await findInquiryByToken(token);
  } catch (error) {
    console.error("[anfrage-chat] Anfrage zum Chat-Link konnte nicht geladen werden:", error);
    return errorState(await failedMessage(), formData);
  }
  if (!inquiry) return errorState(await invalidLinkMessage());

  // 30 Nachrichten in 10 Minuten pro Anschluss und Anfrage; zusätzlich eine Obergrenze pro Anfrage
  const ip = await clientIp();
  const perIp = rateLimit(`inquiry-chat:guest:${inquiry.id}:${ip}`, 30, TEN_MINUTES);
  const perInquiry = rateLimit(`inquiry-chat:guest-total:${inquiry.id}`, 60, TEN_MINUTES);
  if (!perIp.ok || !perInquiry.ok) {
    const minutes = Math.max(1, Math.ceil(Math.max(perIp.retryAfterMs, perInquiry.retryAfterMs) / 60_000));
    return errorState(
      `Sie haben gerade sehr viele Nachrichten geschickt. Bitte warten Sie ${minutes === 1 ? "eine Minute" : `${minutes} Minuten`} und versuchen Sie es dann noch einmal.`,
      formData,
    );
  }

  const body = parsed.data.body;
  try {
    await db.$transaction([
      db.inquiryMessage.create({
        data: { inquiryId: inquiry.id, body, authorName: inquiry.name, fromStaff: false },
      }),
      db.inquiry.update({ where: { id: inquiry.id }, data: { updatedAt: new Date() } }),
    ]);
  } catch (error) {
    console.error("[anfrage-chat] Nachricht des Interessenten konnte nicht gespeichert werden:", error);
    return errorState(await failedMessage(), formData);
  }

  publish({ type: "inquiry.message", inquiryId: inquiry.id, fromStaff: false });
  publish({ type: "staff.notice", notice: { kind: "inquiry.message", inquiryId: inquiry.id, name: inquiry.name } });

  const notice = {
    inquiryId: inquiry.id,
    name: inquiry.name,
    companyName: inquiry.companyName,
    email: inquiry.email,
    body,
  };
  // Prüft selbst, ob jemand aus dem Team gerade zusieht (dann keine E-Mail)
  after(() => notifyStaffProspectMessage(notice));

  revalidateInquiry(inquiry.id, token);
  return successState();
}

/** Sprache, in die der Interessent die Nachrichten von Hertlin übersetzt sehen möchte. */
export async function guestInquiryLanguageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = text(formData, "token");
  if (!isPlausibleInquiryToken(token)) return errorState(await invalidLinkMessage());

  const parsed = languageSchema.safeParse(text(formData, "language"));
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Bitte eine Sprache aus der Liste wählen.");

  const ip = await clientIp();
  if (!rateLimit(`inquiry-chat:language:${ip}`, 30, TEN_MINUTES).ok) {
    return errorState("Bitte warten Sie einen Moment und versuchen Sie es dann noch einmal.");
  }

  try {
    const inquiry = await findInquiryByToken(token);
    if (!inquiry) return errorState(await invalidLinkMessage());
    if (inquiry.language !== parsed.data) {
      await db.inquiry.update({ where: { id: inquiry.id }, data: { language: parsed.data } });
      publish({ type: "inquiry.updated", inquiryId: inquiry.id });
    }
    revalidateInquiry(inquiry.id, token);
  } catch (error) {
    console.error("[anfrage-chat] Sprache konnte nicht gespeichert werden:", error);
    return errorState(await failedMessage());
  }

  return successState(
    parsed.data
      ? `Unsere Nachrichten werden jetzt auf ${languageLabel(parsed.data)} angezeigt.`
      : "Unsere Nachrichten werden wieder im Original angezeigt.",
  );
}

/* ------------------------------------------------------------------ */
/* Hertlin-Team (Verwaltung)                                           */
/* ------------------------------------------------------------------ */

export async function staffInquiryMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const inquiryId = parseInquiryId(formData.get("inquiryId"));
  if (!inquiryId) return errorState("Diese Anfrage gibt es nicht. Bitte laden Sie die Seite neu.");

  const parsed = messageSchema.safeParse({ body: text(formData, "body") });
  if (!parsed.success) return fromZodError(parsed.error, formData, parsed.error.issues[0]?.message);

  const inquiry = await db.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, name: true, email: true, guestToken: true, language: true },
  });
  if (!inquiry) return errorState("Diese Anfrage gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const body = parsed.data.body;
  let token = inquiry.guestToken;
  let becomesContacted = false;

  try {
    const [, , statusChange] = await db.$transaction([
      db.inquiryMessage.create({
        data: { inquiryId, body, authorId: user.id, authorName: user.name, fromStaff: true },
      }),
      db.inquiry.update({ where: { id: inquiryId }, data: { updatedAt: new Date() } }),
      // Erste Antwort: aus „Neu“ wird „Kontaktiert“ – nur wenn der Status inzwischen nicht schon jemand geändert hat
      db.inquiry.updateMany({ where: { id: inquiryId, status: "NEW" }, data: { status: "CONTACTED" } }),
    ]);
    becomesContacted = statusChange.count > 0;
  } catch (error) {
    console.error("[anfrage-chat] Antwort konnte nicht gespeichert werden:", error);
    return errorState("Die Nachricht konnte nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  publish({ type: "inquiry.message", inquiryId, fromStaff: true });
  if (becomesContacted) publish({ type: "inquiry.updated", inquiryId });

  // Ist der Interessent nicht live im Chat, bekommt er die Nachricht per E-Mail – mit seinem Link
  let mailed = false;
  if (!isCustomerWatchingInquiry(inquiryId)) {
    try {
      token = await ensureInquiryToken(inquiryId);
      const mail = {
        to: inquiry.email,
        name: inquiry.name,
        inquiryId,
        token,
        staffName: user.name,
        body,
        language: inquiry.language,
      };
      after(() => notifyProspectStaffMessage(mail));
      mailed = true;
    } catch (error) {
      console.error("[anfrage-chat] Chat-Link konnte nicht angelegt werden:", error);
    }
  }

  revalidateInquiry(inquiryId, token);
  if (becomesContacted) revalidatePath("/admin", "layout");
  return successState(undefined, mailed ? { mailed: "1" } : undefined);
}

/** Chat-Link anlegen (falls nötig) und dem Interessenten per E-Mail schicken. */
export async function sendInquiryChatLinkAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStaff();
  const inquiryId = parseInquiryId(formData.get("inquiryId"));
  if (!inquiryId) return errorState("Diese Anfrage gibt es nicht. Bitte laden Sie die Seite neu.");

  const inquiry = await db.inquiry.findUnique({
    where: { id: inquiryId },
    select: { id: true, name: true, email: true, guestToken: true },
  });
  if (!inquiry) return errorState("Diese Anfrage gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  if (!rateLimit(`inquiry-chat:link:${inquiryId}`, 5, HOUR).ok) {
    return errorState("Der Link wurde in der letzten Stunde schon mehrfach verschickt. Bitte versuchen Sie es später noch einmal.");
  }

  let token: string;
  try {
    token = await ensureInquiryToken(inquiryId);
  } catch (error) {
    console.error("[anfrage-chat] Chat-Link konnte nicht angelegt werden:", error);
    return errorState("Der Chat-Link konnte nicht angelegt werden. Bitte versuchen Sie es noch einmal.");
  }

  await sendInquiryChatLink({ to: inquiry.email, name: inquiry.name, inquiryId, token, staffName: user.name });

  if (!inquiry.guestToken) publish({ type: "inquiry.updated", inquiryId });
  revalidateInquiry(inquiryId, token);
  return successState(
    inquiry.guestToken
      ? `Der Chat-Link wurde noch einmal an ${inquiry.email} geschickt.`
      : `Der Chat-Link ist unterwegs an ${inquiry.email}.`,
  );
}

/** Sprache des Interessenten aus der Verwaltung setzen (z. B. wenn er erkennbar Türkisch schreibt). */
export async function staffInquiryLanguageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();
  const inquiryId = parseInquiryId(formData.get("inquiryId"));
  if (!inquiryId) return errorState("Diese Anfrage gibt es nicht. Bitte laden Sie die Seite neu.");

  const parsed = languageSchema.safeParse(text(formData, "language"));
  if (!parsed.success) return errorState(parsed.error.issues[0]?.message ?? "Bitte eine Sprache aus der Liste wählen.");

  const inquiry = await db.inquiry.findUnique({ where: { id: inquiryId }, select: { id: true, language: true, guestToken: true } });
  if (!inquiry) return errorState("Diese Anfrage gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  if (inquiry.language !== parsed.data) {
    await db.inquiry.update({ where: { id: inquiryId }, data: { language: parsed.data } });
    publish({ type: "inquiry.updated", inquiryId });
  }
  revalidateInquiry(inquiryId, inquiry.guestToken);
  return successState(
    parsed.data
      ? `Der Interessent sieht Ihre Nachrichten jetzt auf ${languageLabel(parsed.data)}.`
      : "Der Interessent sieht Ihre Nachrichten jetzt im Original.",
  );
}

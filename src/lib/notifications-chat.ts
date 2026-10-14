import "server-only";
import { getSiteSettings } from "@/lib/settings";
import { sendMail, staffNotificationAddress } from "@/lib/mail";
import { formatInquiryNumber } from "@/lib/format";
import { mainUrl } from "@/lib/hosts";
import { rateLimit } from "@/lib/rate-limit";
import { isLangCode, languageLabel } from "@/lib/languages";
import { translateText, translationEnabled } from "@/lib/translate";
import { isCustomerWatchingInquiry, isStaffWatchingInquiry } from "@/realtime/bus";
import { inquiryChatUrl } from "@/lib/inquiry-chat";

/**
 * E-Mails rund um den Anfragen-Chat (Interessent ↔ Hertlin).
 *
 * Damit bei einem lebhaften Hin und Her nicht jede Zeile eine eigene E-Mail auslöst,
 * geht pro Anfrage und Richtung höchstens alle paar Minuten eine Benachrichtigung raus.
 * Wer den Chat gerade offen hat, bekommt gar keine – er sieht die Nachricht live.
 */

const MAIL_PAUSE_MS = 5 * 60 * 1000;

function excerpt(text: string, max = 1500): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max)} […]` : clean;
}

/** true, wenn für diese Anfrage und Richtung gerade schon eine Benachrichtigung verschickt wurde. */
function recentlyNotified(direction: "prospect" | "staff", inquiryId: number): boolean {
  return !rateLimit(`mail:inquiry-chat:${direction}:${inquiryId}`, 1, MAIL_PAUSE_MS).ok;
}

/**
 * Eingangsbestätigung für eine neue Anfrage – wie sendInquiryConfirmation aus notifications.ts,
 * zusätzlich mit dem persönlichen Chat-Link. Für submitInquiryAction gedacht.
 */
export async function sendInquiryConfirmationWithChat(inquiry: {
  id: number;
  name: string;
  email: string;
  customerType: string;
  token: string;
}) {
  const site = await getSiteSettings();
  const number = formatInquiryNumber(inquiry.id);
  await sendMail({
    to: inquiry.email,
    subject: `Ihre Anfrage bei ${site.name} (${number})`,
    text: [
      `Guten Tag ${inquiry.name},`,
      "",
      "vielen Dank für Ihre Anfrage. Wir lesen jede Nachricht selbst und melden uns innerhalb eines Werktags bei Ihnen – " +
        (inquiry.customerType === "BUSINESS"
          ? "meist mit einem Vorschlag für ein kurzes Kennenlerngespräch."
          : "telefonisch oder per E-Mail, so wie Sie es angegeben haben."),
      "",
      `Ihre Anfrage hat die Nummer ${number}. Über diesen persönlichen Link können Sie uns jederzeit schreiben und lesen unsere Antworten:`,
      inquiryChatUrl(inquiry.token),
      "",
      "Bitte geben Sie den Link nicht weiter. Wer ihn kennt, kann den Chat lesen.",
      "",
      `Bei Rückfragen erreichen Sie uns unter ${site.phone}.`,
    ].join("\n"),
  });
}

/** Einladung in den Chat mit dem persönlichen Link. */
export async function sendInquiryChatLink(opts: {
  to: string;
  name: string;
  inquiryId: number;
  token: string;
  /** Mitarbeiter, der den Link verschickt (für die Anrede im Text) */
  staffName?: string | null;
}) {
  const site = await getSiteSettings();
  const number = formatInquiryNumber(opts.inquiryId);
  await sendMail({
    to: opts.to,
    subject: `Ihr Chat zur Anfrage ${number}`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      `zu Ihrer Anfrage ${number} können Sie uns ab sofort direkt schreiben, ohne Anmeldung. Über diesen persönlichen Link öffnen Sie den Chat:`,
      inquiryChatUrl(opts.token),
      "",
      `Dort sehen Sie Ihre Anfrage und alle Antworten von uns${opts.staffName ? ` – Ihr Ansprechpartner ist ${opts.staffName}` : ""}. ` +
        "Sind wir gerade im Chat, antworten wir sofort. Sonst bekommen Sie eine E-Mail, sobald wir geschrieben haben.",
      "",
      "Bitte geben Sie den Link nicht weiter. Wer ihn kennt, kann den Chat lesen und darin schreiben.",
      "",
      `Lieber telefonisch? Sie erreichen uns unter ${site.phone}.`,
    ].join("\n"),
  });
}

/**
 * Neue Nachricht von Hertlin an den Interessenten.
 * Hat er den Chat gerade offen, entfällt die E-Mail. Ist eine Sprache gewählt,
 * steht unter dem Original eine maschinelle Übersetzung.
 */
export async function notifyProspectStaffMessage(opts: {
  to: string;
  name: string;
  inquiryId: number;
  token: string;
  staffName: string;
  body: string;
  language?: string | null;
}) {
  if (isCustomerWatchingInquiry(opts.inquiryId)) return;
  if (recentlyNotified("prospect", opts.inquiryId)) return;

  const site = await getSiteSettings();
  const number = formatInquiryNumber(opts.inquiryId);
  const text = excerpt(opts.body);

  let translated: string | null = null;
  if (isLangCode(opts.language) && opts.language !== "de" && translationEnabled()) {
    try {
      const result = await translateText(text, opts.language, "Nachricht eines IT-Dienstleisters an einen Interessenten");
      if (!result.unchanged && result.text.trim() !== text) translated = result.text;
    } catch {
      translated = null;
    }
  }

  await sendMail({
    to: opts.to,
    subject: `Neue Nachricht zu Ihrer Anfrage ${number}`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      `${opts.staffName} von ${site.name} hat Ihnen zu Ihrer Anfrage geschrieben:`,
      "",
      text,
      ...(translated && isLangCode(opts.language)
        ? ["", `Maschinelle Übersetzung (${languageLabel(opts.language)}):`, "", translated]
        : []),
      "",
      "Antworten können Sie direkt im Chat:",
      inquiryChatUrl(opts.token),
      "",
      "Bitte geben Sie den Link nicht weiter.",
    ].join("\n"),
  });
}

/** Neue Nachricht des Interessenten an das Team. Entfällt, wenn jemand aus dem Team den Chat gerade offen hat. */
export async function notifyStaffProspectMessage(opts: {
  inquiryId: number;
  name: string;
  companyName?: string | null;
  email: string;
  body: string;
}) {
  if (isStaffWatchingInquiry(opts.inquiryId)) return;
  if (recentlyNotified("staff", opts.inquiryId)) return;

  const number = formatInquiryNumber(opts.inquiryId);
  await sendMail({
    to: await staffNotificationAddress(),
    replyTo: opts.email,
    subject: `[${number}] Nachricht von ${opts.name} im Anfragen-Chat`,
    text: [
      `${opts.name}${opts.companyName ? ` (${opts.companyName})` : ""} hat im Chat zur Anfrage ${number} geschrieben:`,
      "",
      excerpt(opts.body),
      "",
      `Antworten Sie am besten direkt im Chat: ${mainUrl(`/admin/anfragen/${opts.inquiryId}`)}`,
    ].join("\n"),
  });
}

import "server-only";
import { getSiteSettings } from "@/lib/settings";
import { isCustomerWatchingTicket, isStaffWatchingTicket } from "@/realtime/bus";
import { sendMail, staffNotificationAddress } from "@/lib/mail";
import { formatInquiryNumber, formatTicketNumber } from "@/lib/format";
import { mainUrl, portalUrl } from "@/lib/hosts";
import {
  CATEGORY_LABELS,
  CUSTOMER_TYPE_LABELS,
  INQUIRY_TOPIC_LABELS,
  PRIORITY_LABELS,
  TYPE_LABELS,
  labelOf,
} from "@/lib/constants";

/**
 * Alle E-Mails an Kunden und an das Hertlin-Team.
 * Grundsatz: Kundenmails enthalten nie Kosten oder interne Notizen.
 */

type TicketInfo = {
  id: number;
  subject: string;
  type: string;
  category: string;
  priority: string;
  companyName?: string | null;
  contactName?: string | null;
};

function excerpt(text: string, max = 600): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max)} […]` : clean;
}

/* ---------- an das Hertlin-Team ---------- */

export async function notifyStaffNewTicket(ticket: TicketInfo & { body: string; createdByName?: string | null }) {
  const from = [ticket.companyName, ticket.createdByName ?? ticket.contactName].filter(Boolean).join(" – ");
  await sendMail({
    to: await staffNotificationAddress(),
    subject: `[${formatTicketNumber(ticket.id)}] ${labelOf(PRIORITY_LABELS, ticket.priority)}: ${ticket.subject}`,
    text: [
      `Neues Ticket von ${from || "unbekannt"}`,
      "",
      `Art: ${labelOf(TYPE_LABELS, ticket.type)}`,
      `Bereich: ${labelOf(CATEGORY_LABELS, ticket.category)}`,
      `Priorität: ${labelOf(PRIORITY_LABELS, ticket.priority)}`,
      "",
      excerpt(ticket.body),
      "",
      `Ticket öffnen: ${mainUrl(`/admin/tickets/${ticket.id}`)}`,
    ].join("\n"),
  });
}

export async function notifyStaffCustomerReply(ticket: TicketInfo & { body: string; authorName: string }) {
  // Hat gerade jemand aus dem Team das Ticket offen, sieht er die Antwort live – keine zusätzliche Mail
  if (isStaffWatchingTicket(ticket.id)) return;
  await sendMail({
    to: await staffNotificationAddress(),
    subject: `[${formatTicketNumber(ticket.id)}] Antwort von ${ticket.authorName}: ${ticket.subject}`,
    text: [
      `${ticket.authorName} hat auf das Ticket geantwortet${ticket.companyName ? ` (${ticket.companyName})` : ""}:`,
      "",
      excerpt(ticket.body),
      "",
      `Ticket öffnen: ${mainUrl(`/admin/tickets/${ticket.id}`)}`,
    ].join("\n"),
  });
}

export async function notifyStaffNewInquiry(inquiry: {
  id: number;
  customerType: string;
  name: string;
  companyName?: string | null;
  email: string;
  phone?: string | null;
  topic: string;
  message: string;
}) {
  await sendMail({
    to: await staffNotificationAddress(),
    replyTo: inquiry.email,
    subject: `[${formatInquiryNumber(inquiry.id)}] Neue Anfrage: ${inquiry.companyName || inquiry.name}`,
    text: [
      `${labelOf(CUSTOMER_TYPE_LABELS, inquiry.customerType)}: ${inquiry.name}${inquiry.companyName ? `, ${inquiry.companyName}` : ""}`,
      `E-Mail: ${inquiry.email}`,
      inquiry.phone ? `Telefon: ${inquiry.phone}` : null,
      `Thema: ${labelOf(INQUIRY_TOPIC_LABELS, inquiry.topic)}`,
      "",
      excerpt(inquiry.message, 2000),
      "",
      `Anfrage öffnen: ${mainUrl(`/admin/anfragen/${inquiry.id}`)}`,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  });
}

/* ---------- an Kunden ---------- */

/** Eingangsbestätigung für ein Ticket aus dem Kundenportal. */
export async function sendPortalTicketConfirmation(opts: {
  to: string;
  name: string;
  ticketId: number;
  subject: string;
  slug: string;
}) {
  const site = await getSiteSettings();
  await sendMail({
    to: opts.to,
    subject: `Ihr Ticket ${formatTicketNumber(opts.ticketId)} ist eingegangen`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      `vielen Dank für Ihre Meldung „${opts.subject}“. Sie hat die Nummer ${formatTicketNumber(opts.ticketId)}.`,
      "Wir sehen sie uns an und melden uns im Ticket. Sie bekommen eine E-Mail, sobald es Neuigkeiten gibt.",
      "",
      `Zum Ticket: ${portalUrl(opts.slug, `/tickets/${opts.ticketId}`)}`,
      "",
      `Wenn es brennt, rufen Sie uns bitte zusätzlich an: ${site.phone}`,
    ].join("\n"),
  });
}

/** Eingangsbestätigung mit persönlichem Status-Link für Privatkunden. */
export async function sendPrivateTicketConfirmation(opts: {
  to: string;
  name: string;
  ticketId: number;
  subject: string;
  token: string;
}) {
  await sendMail({
    to: opts.to,
    subject: `Ihre Anfrage ${formatTicketNumber(opts.ticketId)} ist bei uns angekommen`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      `danke für Ihre Nachricht zum Thema „${opts.subject}“. Wir melden uns in der Regel innerhalb eines Werktags bei Ihnen.`,
      "",
      "Über diesen persönlichen Link sehen Sie jederzeit den Stand und können uns antworten:",
      mainUrl(`/status/${opts.token}`),
      "",
      "Bitte geben Sie den Link nicht weiter. Wer ihn kennt, kann Ihre Anfrage lesen.",
    ].join("\n"),
  });
}

/** Neue Antwort von Hertlin an den Kunden. link: Portal- oder Status-Link. */
export async function notifyCustomerStaffReply(opts: {
  to: string;
  name: string;
  ticketId: number;
  subject: string;
  body: string;
  link: string;
  waitingForCustomer?: boolean;
}) {
  // Kunde ist gerade im Ticket (Live-Chat) – die Nachricht erscheint dort sofort
  if (isCustomerWatchingTicket(opts.ticketId)) return;
  await sendMail({
    to: opts.to,
    subject: `${opts.waitingForCustomer ? "Rückfrage" : "Neue Antwort"} zu ${formatTicketNumber(opts.ticketId)}: ${opts.subject}`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      opts.waitingForCustomer
        ? "wir haben eine Rückfrage zu Ihrem Ticket und brauchen Ihre Antwort, um weiterzumachen:"
        : "es gibt eine neue Nachricht zu Ihrem Ticket:",
      "",
      excerpt(opts.body, 1500),
      "",
      `Antworten Sie bitte direkt im Ticket: ${opts.link}`,
    ].join("\n"),
  });
}

/** Statusänderung (gelöst/geschlossen) an den Kunden. */
export async function notifyCustomerStatusChange(opts: {
  to: string;
  name: string;
  ticketId: number;
  subject: string;
  statusLabel: string;
  link: string;
}) {
  await sendMail({
    to: opts.to,
    subject: `${formatTicketNumber(opts.ticketId)} ist jetzt „${opts.statusLabel}“`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      `der Status Ihres Tickets „${opts.subject}“ wurde auf „${opts.statusLabel}“ gesetzt.`,
      "Falls das Problem doch noch besteht, antworten Sie einfach im Ticket – es wird dann wieder geöffnet.",
      "",
      opts.link,
    ].join("\n"),
  });
}

export async function sendInquiryConfirmation(inquiry: { id: number; name: string; email: string; customerType: string }) {
  const site = await getSiteSettings();
  await sendMail({
    to: inquiry.email,
    subject: `Ihre Anfrage bei ${site.name} (${formatInquiryNumber(inquiry.id)})`,
    text: [
      `Guten Tag ${inquiry.name},`,
      "",
      "vielen Dank für Ihre Anfrage. Wir lesen jede Nachricht selbst und melden uns innerhalb eines Werktags bei Ihnen – " +
        (inquiry.customerType === "BUSINESS"
          ? "meist mit einem Vorschlag für ein kurzes Kennenlerngespräch."
          : "telefonisch oder per E-Mail, so wie Sie es angegeben haben."),
      "",
      `Bei Rückfragen erreichen Sie uns unter ${site.phone}.`,
    ].join("\n"),
  });
}

export async function sendInviteMail(opts: {
  to: string;
  name: string;
  link: string;
  companyName?: string | null;
  invitedBy?: string | null;
  isStaff?: boolean;
}) {
  const site = await getSiteSettings();
  const where = opts.isStaff ? `die Verwaltung von ${site.name}` : `das Kundenportal${opts.companyName ? ` von ${opts.companyName}` : ""}`;
  await sendMail({
    to: opts.to,
    subject: opts.isStaff ? `Ihr Zugang zur ${site.name}-Verwaltung` : `Ihr Zugang zum ${site.name}-Kundenportal`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      `${opts.invitedBy ? `${opts.invitedBy} hat` : "Wir haben"} für Sie einen Zugang für ${where} eingerichtet.`,
      opts.isStaff ? "" : "Dort melden Sie Störungen, stellen Anfragen und sehen den Stand Ihrer Tickets.",
      "",
      "Bitte legen Sie über diesen Link Ihr Passwort fest (gültig für 7 Tage):",
      opts.link,
    ].join("\n"),
  });
}

export async function sendPasswordResetMail(opts: { to: string; name: string; link: string }) {
  const site = await getSiteSettings();
  await sendMail({
    to: opts.to,
    subject: `Passwort zurücksetzen – ${site.name}`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      "über den folgenden Link können Sie ein neues Passwort festlegen. Der Link ist eine Stunde gültig.",
      opts.link,
      "",
      "Falls Sie das nicht angefordert haben, ignorieren Sie diese E-Mail einfach. Ihr bisheriges Passwort bleibt gültig.",
    ].join("\n"),
  });
}

/** Status-Link erneut zusenden (Privatkunden). */
export async function sendPrivateStatusLink(opts: { to: string; name: string; ticketId: number; subject: string; token: string }) {
  await sendMail({
    to: opts.to,
    subject: `Ihr Link zu ${formatTicketNumber(opts.ticketId)}`,
    text: [
      `Guten Tag ${opts.name},`,
      "",
      `hier ist Ihr persönlicher Link zur Anfrage „${opts.subject}“:`,
      mainUrl(`/status/${opts.token}`),
    ].join("\n"),
  });
}

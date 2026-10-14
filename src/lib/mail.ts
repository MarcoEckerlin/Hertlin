import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { formatFileSize } from "@/lib/format";
import { getSiteSettings } from "@/lib/settings";

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export type MailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
  /** Blindkopie, z. B. Rechnungskopie an die eigene Buchhaltung */
  bcc?: string | string[];
  attachments?: MailAttachment[];
};

export type MailResult = { ok: true; via: "smtp" | "log" } | { ok: false; error: string };

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

function addressList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
}

/** Fehlermeldung des Mailservers für die Oberfläche: kurz und ohne Zugangsdaten. */
function describeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const firstLine = raw.split("\n")[0].replace(/\s+/g, " ").trim();
  return firstLine.slice(0, 200) || "unbekannter Fehler";
}

async function deliver(message: MailMessage): Promise<MailResult> {
  const to = addressList(message.to);
  if (to.length === 0) return { ok: false, error: "Keine Empfängeradresse angegeben." };
  const bcc = addressList(message.bcc);
  const attachments = message.attachments ?? [];
  const site = await getSiteSettings();
  const text = `${message.text}\n\n-- \n${site.legalName}\n${site.phone} · ${site.email}`;
  const from = process.env.MAIL_FROM || `${site.name} <${site.supportEmail}>`;

  const t = getTransporter();
  if (!t) {
    const lines = [
      `=== ${new Date().toISOString()}`,
      `Von: ${from}`,
      `An: ${to.join(", ")}`,
      ...(bcc.length > 0 ? [`Bcc: ${bcc.join(", ")}`] : []),
      `Betreff: ${message.subject}`,
      ...attachments.map((a) => `Anhang: ${a.filename} (${formatFileSize(a.content.length)})`),
    ];
    const entry = `${lines.join("\n")}\n\n${text}\n\n`;
    try {
      const file = process.env.MAIL_LOG_FILE || path.join(process.cwd(), "storage", "mails.log");
      await mkdir(path.dirname(file), { recursive: true });
      await appendFile(file, entry, "utf8");
    } catch {
      // Ohne Schreibrechte reicht die Konsolenausgabe
    }
    if (process.env.NODE_ENV !== "test") console.info(`[mail] an ${to.join(", ")}: ${message.subject}`);
    return { ok: true, via: "log" };
  }

  try {
    await t.sendMail({
      from,
      to,
      bcc: bcc.length > 0 ? bcc : undefined,
      subject: message.subject,
      text,
      replyTo: message.replyTo,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
    return { ok: true, via: "smtp" };
  } catch (error) {
    console.error("[mail] Versand fehlgeschlagen:", message.subject, error);
    return { ok: false, error: describeError(error) };
  }
}

/**
 * Verschickt eine E-Mail. Fehler werden protokolliert, aber nicht geworfen,
 * damit z. B. ein Ticket auch dann angelegt wird, wenn der Mailserver hakt.
 * Ohne SMTP-Konfiguration landen Mails in storage/mails.log (oder MAIL_LOG_FILE).
 */
export async function sendMail(message: MailMessage): Promise<void> {
  await deliver(message);
}

/**
 * Wie sendMail, meldet aber Erfolg oder Fehler zurück – für Versand, bei dem die Oberfläche das Ergebnis zeigen muss
 * (z. B. Rechnungen). Wirft ebenfalls nicht.
 */
export async function sendMailWithResult(message: MailMessage): Promise<MailResult> {
  return deliver(message);
}

/** Empfänger für interne Benachrichtigungen (neue Tickets, Anfragen). */
export async function staffNotificationAddress(): Promise<string> {
  return process.env.STAFF_NOTIFY_EMAIL || (await getSiteSettings()).supportEmail;
}

import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { site } from "@/config/site";

export type MailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  replyTo?: string;
};

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

const SIGNATURE = `\n\n-- \n${site.legalName}\n${site.phone} · ${site.email}`;

/**
 * Verschickt eine E-Mail. Fehler werden protokolliert, aber nicht geworfen,
 * damit z. B. ein Ticket auch dann angelegt wird, wenn der Mailserver hakt.
 * Ohne SMTP-Konfiguration landen Mails in storage/mails.log.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const to = Array.isArray(message.to) ? message.to.filter(Boolean) : [message.to].filter(Boolean);
  if (to.length === 0) return;
  const text = message.text + SIGNATURE;
  const from = process.env.MAIL_FROM || `${site.name} <${site.supportEmail}>`;

  const t = getTransporter();
  if (!t) {
    const entry = `=== ${new Date().toISOString()}\nVon: ${from}\nAn: ${to.join(", ")}\nBetreff: ${message.subject}\n\n${text}\n\n`;
    try {
      const dir = path.join(process.cwd(), "storage");
      await mkdir(dir, { recursive: true });
      await appendFile(path.join(dir, "mails.log"), entry, "utf8");
    } catch {
      // Ohne Schreibrechte reicht die Konsolenausgabe
    }
    if (process.env.NODE_ENV !== "test") console.info(`[mail] an ${to.join(", ")}: ${message.subject}`);
    return;
  }

  try {
    await t.sendMail({ from, to, subject: message.subject, text, replyTo: message.replyTo });
  } catch (error) {
    console.error("[mail] Versand fehlgeschlagen:", message.subject, error);
  }
}

/** Empfänger für interne Benachrichtigungen (neue Tickets, Anfragen). */
export function staffNotificationAddress(): string {
  return process.env.STAFF_NOTIFY_EMAIL || site.supportEmail;
}

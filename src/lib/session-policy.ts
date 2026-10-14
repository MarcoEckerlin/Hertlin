import { appProtocol } from "@/lib/hosts";

/**
 * Regeln für Anmeldesitzungen – ohne server-only, damit auch der WebSocket-Server (server.ts) sie nutzt.
 */

/** Höchstdauer einer Sitzung ab Anmeldung */
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Sitzung endet, wenn so lange keine Seite aufgerufen wurde (Standard 72 Stunden, SESSION_IDLE_HOURS). */
export function sessionIdleMs(): number {
  const hours = Number(process.env.SESSION_IDLE_HOURS);
  return (Number.isFinite(hours) && hours > 0 ? hours : 72) * 60 * 60 * 1000;
}

/**
 * Unter HTTPS mit __Host-Präfix: Der Browser akzeptiert das Cookie dann nur mit Secure, Path=/
 * und ohne Domain – es kann also nicht von einer anderen Subdomain gesetzt oder überschrieben werden.
 */
export function sessionCookieName(): string {
  return appProtocol() === "https" ? "__Host-hertlin_session" : "hertlin_session";
}

export function sessionIsActive(session: { expiresAt: Date; lastSeenAt: Date }, now = Date.now()): boolean {
  return session.expiresAt.getTime() > now && now - session.lastSeenAt.getTime() < sessionIdleMs();
}

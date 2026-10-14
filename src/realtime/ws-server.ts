/**
 * WebSocket-Server für Live-Updates (Ticket-Chats, Anfragen-Chats, Hinweise an das Team).
 * Wird von server.ts an den HTTP-Server gehängt. Läuft außerhalb des Next.js-Bundles,
 * darf deshalb weder "server-only" noch next/* importieren.
 *
 * Sicherheit:
 * - Origin muss zum Host passen (Schutz vor Cross-Site-WebSocket-Hijacking).
 * - Sitzung wie in der App: Cookie -> SHA-256 -> Session, gebunden an den Host.
 * - Jede Kanal-Anmeldung wird gegen die Datenbank geprüft (gleiche Regeln wie im Portal).
 * - Über den Socket gehen nur Signale, keine Inhalte. Interne Notizen lösen bei Kunden nichts aus.
 */
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { WebSocketServer, type WebSocket } from "ws";
import { parseHost, normalizeHost } from "@/lib/hosts";
import { sessionCookieName, sessionIsActive } from "@/lib/session-policy";
import { getPresence, markServerAttached, onBusEvent, setPresence, type BusEvent, type PresenceEntry } from "@/realtime/bus";
import { WS_PATH, type ChannelKey, type ClientMessage, type ServerMessage } from "@/realtime/protocol";

const MAX_CHANNELS_PER_CONNECTION = 20;
const MAX_MESSAGE_BYTES = 2048;
const SESSION_RECHECK_MS = 60_000;

const g = globalThis as unknown as { __hertlinWsPrisma?: PrismaClient };
const prisma = (g.__hertlinWsPrisma ??= new PrismaClient({ log: ["error"] }));

type Identity =
  | { kind: "staff"; userId: string; name: string; sessionHash: string }
  | {
      kind: "customer";
      userId: string;
      name: string;
      sessionHash: string;
      rootCompanyId: string;
      companyId: string;
      isAdmin: boolean;
      isRootAdmin: boolean;
    }
  | { kind: "anonymous" };

type Connection = {
  id: string;
  socket: WebSocket;
  identity: Identity;
  host: string;
  /** Kanäle und die Rolle, mit der der Browser dort zuhört */
  channels: Map<ChannelKey, PresenceEntry>;
  lastTyping: Map<ChannelKey, number>;
  alive: boolean;
};

const connections = new Set<Connection>();

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestHost(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-host"];
  const value = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0] ?? req.headers.host;
  return normalizeHost(value);
}

function readCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function originAllowed(req: IncomingMessage, host: string): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return normalizeHost(new URL(origin).host) === host;
  } catch {
    return false;
  }
}

async function identify(req: IncomingMessage, host: string): Promise<Identity> {
  const token = readCookie(req, sessionCookieName());
  if (!token) return { kind: "anonymous" };
  return loadIdentity(sha256(token), host);
}

/** Identität zu einer Sitzung, jeweils frisch aus der Datenbank (Rolle, Firma, Sperren). */
async function loadIdentity(sessionHash: string, host: string): Promise<Identity> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sessionHash },
    select: {
      host: true,
      expiresAt: true,
      lastSeenAt: true,
      user: {
        select: {
          id: true,
          name: true,
          role: true,
          active: true,
          company: { select: { id: true, slug: true, parentId: true, active: true, parent: { select: { id: true, slug: true, active: true } } } },
        },
      },
    },
  });
  if (!session || !sessionIsActive(session) || session.host !== host || !session.user.active) {
    return { kind: "anonymous" };
  }
  const user = session.user;
  const info = parseHost(host);

  if ((user.role === "ADMIN" || user.role === "TECHNICIAN") && info.kind === "main") {
    return { kind: "staff", userId: user.id, name: user.name, sessionHash };
  }

  if ((user.role === "CUSTOMER_ADMIN" || user.role === "CUSTOMER_USER") && info.kind === "portal" && user.company) {
    const company = user.company;
    const root = company.parent ?? company;
    if (!company.active || !root.active || root.slug !== info.slug) return { kind: "anonymous" };
    const isAdmin = user.role === "CUSTOMER_ADMIN";
    return {
      kind: "customer",
      userId: user.id,
      name: user.name,
      sessionHash,
      rootCompanyId: root.id,
      companyId: company.id,
      isAdmin,
      isRootAdmin: isAdmin && company.parentId === null,
    };
  }
  return { kind: "anonymous" };
}

/** Gleiche Rechte? (Der Name darf sich ändern, alles andere nicht.) */
export function sameRights(a: Identity, b: Identity): boolean {
  if (a.kind === "anonymous" || b.kind === "anonymous") return a.kind === b.kind;
  if (a.kind === "staff" || b.kind === "staff") return a.kind === b.kind && a.userId === b.userId && a.sessionHash === b.sessionHash;
  return (
    a.userId === b.userId &&
    a.sessionHash === b.sessionHash &&
    a.rootCompanyId === b.rootCompanyId &&
    a.companyId === b.companyId &&
    a.isAdmin === b.isAdmin &&
    a.isRootAdmin === b.isRootAdmin
  );
}

/**
 * Identität einer Verbindung neu laden. Sitzung beendet oder Benutzer gesperrt: Verbindung schließen (4401,
 * der Browser verbindet sich nicht neu). Rolle oder Firma geändert: schließen (4403), der Browser verbindet
 * sich neu und meldet seine Kanäle mit den neuen Rechten erneut an.
 * Gibt false zurück, wenn die Verbindung geschlossen wurde.
 */
async function refreshIdentity(conn: Connection): Promise<boolean> {
  const current = conn.identity;
  if (current.kind === "anonymous") return true;
  const fresh = await loadIdentity(current.sessionHash, conn.host);
  if (fresh.kind === "anonymous") {
    conn.socket.close(4401, "Sitzung beendet");
    return false;
  }
  if (!sameRights(current, fresh)) {
    conn.socket.close(4403, "Rechte geändert");
    return false;
  }
  conn.identity = fresh;
  return true;
}

/** Regelmäßige Prüfung: Sitzung und Rechte unverändert? Abonnierte Tickets noch sichtbar? */
async function recheck(conn: Connection): Promise<void> {
  if (!(await refreshIdentity(conn))) return;
  const id = conn.identity;
  if (id.kind !== "customer") return;
  const ticketIds = [...conn.channels.keys()].flatMap((key) => (key.startsWith("ticket:") ? [Number(key.slice(7))] : []));
  if (ticketIds.length === 0) return;
  const tickets = await prisma.ticket.findMany({ where: { id: { in: ticketIds } }, select: customerTicketSelect });
  const visible = new Set(tickets.filter((t) => ticketVisibleTo(id, t)).map((t) => t.id));
  for (const ticketId of ticketIds) {
    if (!visible.has(ticketId)) leaveChannel(conn, `ticket:${ticketId}`);
  }
}

function send(conn: Connection, message: ServerMessage) {
  if (conn.socket.readyState === conn.socket.OPEN) conn.socket.send(JSON.stringify(message));
}

function broadcastPresence(key: ChannelKey) {
  const presence = getPresence(key);
  for (const c of connections) {
    const sub = c.channels.get(key);
    if (!sub) continue;
    // Kunden sehen keine Namen anderer Kunden, nur ob Hertlin da ist
    send(c, {
      t: "presence",
      key,
      presence: sub.staff ? presence : { staff: presence.staff, customers: [] },
    });
  }
}

function joinChannel(conn: Connection, key: ChannelKey, role: PresenceEntry) {
  if (!conn.channels.has(key) && conn.channels.size >= MAX_CHANNELS_PER_CONNECTION) return;
  conn.channels.set(key, role);
  if (key !== "staff") {
    setPresence(key, conn.id, role);
    broadcastPresence(key);
  }
  send(conn, { t: "subscribed", key });
}

function leaveChannel(conn: Connection, key: ChannelKey) {
  if (!conn.channels.delete(key)) return;
  if (key !== "staff") {
    setPresence(key, conn.id, null);
    broadcastPresence(key);
  }
}

const customerTicketSelect = {
  id: true,
  companyId: true,
  createdById: true,
  company: { select: { id: true, parentId: true } },
} as const;

type TicketScope = { companyId: string | null; createdById: string | null; company: { id: string; parentId: string | null } | null };

/** Darf ein Portalbenutzer dieses Ticket sehen? Gleiche Regeln wie portalTicketWhere(). */
export function ticketVisibleTo(id: Extract<Identity, { kind: "customer" }>, ticket: TicketScope): boolean {
  if (!ticket.company) return false;
  const ticketRoot = ticket.company.parentId ?? ticket.company.id;
  if (ticketRoot !== id.rootCompanyId) return false;
  const inScope = id.isRootAdmin ? true : ticket.companyId === id.companyId;
  if (!inScope) return false;
  return id.isAdmin ? true : ticket.createdById === id.userId;
}

async function customerCanSeeTicket(id: Extract<Identity, { kind: "customer" }>, ticketId: number): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: customerTicketSelect });
  return !!ticket && ticketVisibleTo(id, ticket);
}

async function handleSubscribe(conn: Connection, msg: Extract<ClientMessage, { t: "sub" }>) {
  // Rechte frisch prüfen: Wer inzwischen gesperrt, herabgestuft oder umgehängt wurde, abonniert nichts mehr
  if (!(await refreshIdentity(conn))) return;
  const id = conn.identity;

  if (msg.ch === "staff") {
    if (id.kind === "staff") joinChannel(conn, "staff", { staff: true, name: id.name });
    else send(conn, { t: "denied", ch: "staff" });
    return;
  }

  if (msg.ch === "ticket") {
    const ticketId = Number(msg.id);
    if (!Number.isInteger(ticketId) || ticketId <= 0) return send(conn, { t: "denied", ch: "ticket" });
    const key: ChannelKey = `ticket:${ticketId}`;

    if (id.kind === "staff") {
      const exists = await prisma.ticket.count({ where: { id: ticketId } });
      return exists ? joinChannel(conn, key, { staff: true, name: id.name }) : send(conn, { t: "denied", ch: "ticket", id: ticketId });
    }
    // Mit userId: E-Mails an genau diesen Benutzer entfallen, solange er zusieht (isRecipientWatchingTicket)
    if (id.kind === "customer") {
      return (await customerCanSeeTicket(id, ticketId))
        ? joinChannel(conn, key, { staff: false, name: id.name, userId: id.userId })
        : send(conn, { t: "denied", ch: "ticket", id: ticketId });
    }
    // Privatkunde über Status-Link (nur Hauptdomain)
    if (typeof msg.token === "string" && msg.token.length >= 10 && msg.token.length <= 200 && parseHost(conn.host).kind === "main") {
      const ticket = await prisma.ticket.findUnique({ where: { guestToken: msg.token }, select: { id: true, companyId: true, contactName: true } });
      if (ticket && ticket.id === ticketId && ticket.companyId === null) {
        return joinChannel(conn, key, { staff: false, name: ticket.contactName || "Kunde" });
      }
    }
    return send(conn, { t: "denied", ch: "ticket", id: ticketId });
  }

  if (msg.ch === "inquiry") {
    if (id.kind === "staff" && msg.id) {
      const inquiryId = Number(msg.id);
      if (!Number.isInteger(inquiryId) || inquiryId <= 0) return send(conn, { t: "denied", ch: "inquiry" });
      const exists = await prisma.inquiry.count({ where: { id: inquiryId } });
      return exists
        ? joinChannel(conn, `inquiry:${inquiryId}`, { staff: true, name: id.name })
        : send(conn, { t: "denied", ch: "inquiry", id: inquiryId });
    }
    if (typeof msg.token === "string" && msg.token.length >= 10 && msg.token.length <= 200 && parseHost(conn.host).kind === "main") {
      const inquiry = await prisma.inquiry.findUnique({ where: { guestToken: msg.token }, select: { id: true, name: true } });
      if (inquiry) return joinChannel(conn, `inquiry:${inquiry.id}`, { staff: false, name: inquiry.name });
    }
    return send(conn, { t: "denied", ch: "inquiry" });
  }
}

function handleTyping(conn: Connection, key: ChannelKey, internal: boolean) {
  const sub = conn.channels.get(key);
  if (!sub || key === "staff") return;
  const now = Date.now();
  if (now - (conn.lastTyping.get(key) ?? 0) < 1500) return;
  conn.lastTyping.set(key, now);
  // Interne Notizen: nur Kolleginnen und Kollegen sehen, dass geschrieben wird
  const onlyStaff = sub.staff && internal;
  for (const other of connections) {
    if (other === conn) continue;
    const otherSub = other.channels.get(key);
    if (!otherSub) continue;
    if (onlyStaff && !otherSub.staff) continue;
    // Kunden sehen bei Hertlin-Mitarbeitern nur „Hertlin“ und den Namen, Mitarbeiter sehen alles
    send(other, { t: "typing", key, name: sub.name, staff: sub.staff });
  }
}

function dispatch(event: BusEvent) {
  switch (event.type) {
    case "ticket.message": {
      const key: ChannelKey = `ticket:${event.ticketId}`;
      for (const c of connections) {
        const sub = c.channels.get(key);
        if (!sub) continue;
        if (event.internal && !sub.staff) continue;
        send(c, { t: "message", key, fromStaff: event.fromStaff });
      }
      return;
    }
    case "ticket.updated": {
      const key: ChannelKey = `ticket:${event.ticketId}`;
      for (const c of connections) if (c.channels.has(key)) send(c, { t: "update", key });
      return;
    }
    case "inquiry.message": {
      const key: ChannelKey = `inquiry:${event.inquiryId}`;
      for (const c of connections) if (c.channels.has(key)) send(c, { t: "message", key, fromStaff: event.fromStaff });
      return;
    }
    case "inquiry.updated": {
      const key: ChannelKey = `inquiry:${event.inquiryId}`;
      for (const c of connections) if (c.channels.has(key)) send(c, { t: "update", key });
      return;
    }
    case "staff.notice": {
      for (const c of connections) if (c.channels.has("staff")) send(c, { t: "notice", notice: event.notice });
      return;
    }
  }
}

function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  switch (m.t) {
    case "ping":
      return { t: "ping" };
    case "sub":
      if (m.ch === "staff") return { t: "sub", ch: "staff" };
      if (m.ch === "ticket") return { t: "sub", ch: "ticket", id: Number(m.id), token: typeof m.token === "string" ? m.token : undefined };
      if (m.ch === "inquiry")
        return { t: "sub", ch: "inquiry", id: m.id === undefined ? undefined : Number(m.id), token: typeof m.token === "string" ? m.token : undefined };
      return null;
    case "unsub":
    case "typing": {
      const key = typeof m.key === "string" && /^(ticket|inquiry):\d{1,9}$|^staff$/.test(m.key) ? (m.key as ChannelKey) : null;
      if (!key) return null;
      return m.t === "unsub" ? { t: "unsub", key } : { t: "typing", key, internal: m.internal === true };
    }
    default:
      return null;
  }
}

/** Hängt den WebSocket-Server an. nextUpgrade: Upgrade-Handler von Next.js (Hot Reload im Dev-Modus). */
export function attachRealtime(
  server: Server,
  nextUpgrade?: (req: IncomingMessage, socket: Duplex, head: Buffer) => unknown,
): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  markServerAttached();
  onBusEvent(dispatch);

  const isRealtimePath = (url: string | undefined) => (url ?? "").split("?")[0] === WS_PATH;

  // Next.js hängt beim ersten Request selbst einen "upgrade"-Listener an den Server und schließt
  // dort unbekannte WebSocket-Verbindungen. Alle später angemeldeten Listener lassen /_ws deshalb aus.
  const original = server.on.bind(server);
  const guard = ((event: string, listener: (...args: unknown[]) => void) => {
    if (event !== "upgrade") return original(event, listener);
    return original(event, (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (!isRealtimePath(req.url)) listener(req, socket, head);
    });
  }) as typeof server.on;
  server.on = guard;
  server.addListener = guard;

  original("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!isRealtimePath(req.url)) {
      // Andere Upgrades (z. B. Hot Reload im Entwicklungsmodus) gehören Next.js
      if (server.listenerCount("upgrade") > 1) return;
      if (nextUpgrade) void nextUpgrade(req, socket, head);
      else socket.destroy();
      return;
    }
    const host = requestHost(req);
    if (parseHost(host).kind === "invalid" || !originAllowed(req, host)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    identify(req, host)
      .then((identity) => {
        wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, identity, host));
      })
      .catch(() => {
        socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n");
        socket.destroy();
      });
  });

  // Verbindungen ohne Lebenszeichen schließen, Sitzungen regelmäßig neu prüfen
  setInterval(() => {
    for (const conn of connections) {
      if (!conn.alive) {
        conn.socket.terminate();
        continue;
      }
      conn.alive = false;
      conn.socket.ping();
    }
  }, 30_000).unref();

  setInterval(() => {
    for (const conn of connections) recheck(conn).catch(() => undefined);
  }, SESSION_RECHECK_MS).unref();
}

function onConnection(socket: WebSocket, identity: Identity, host: string) {
  const conn: Connection = { id: randomUUID(), socket, identity, host, channels: new Map(), lastTyping: new Map(), alive: true };
  connections.add(conn);

  send(conn, {
    t: "hello",
    role: identity.kind === "staff" ? "staff" : identity.kind === "customer" ? "customer" : "guest",
    name: identity.kind === "anonymous" ? null : identity.name,
  });

  socket.on("pong", () => {
    conn.alive = true;
  });

  socket.on("message", (data) => {
    conn.alive = true;
    let parsed: ClientMessage | null = null;
    try {
      parsed = parseClientMessage(JSON.parse(String(data)));
    } catch {
      parsed = null;
    }
    if (!parsed) return;
    switch (parsed.t) {
      case "ping":
        return send(conn, { t: "pong" });
      case "sub":
        handleSubscribe(conn, parsed).catch((e) => console.error("[realtime] subscribe", e));
        return;
      case "unsub":
        return leaveChannel(conn, parsed.key);
      case "typing":
        return handleTyping(conn, parsed.key, parsed.internal === true);
    }
  });

  socket.on("close", () => {
    connections.delete(conn);
    for (const key of [...conn.channels.keys()]) leaveChannel(conn, key);
  });
  socket.on("error", () => socket.terminate());
}

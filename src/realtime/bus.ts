/**
 * Prozessweiter Ereignis-Bus zwischen Next.js (Server Actions) und dem WebSocket-Server.
 * Beide laufen im selben Node-Prozess (server.ts), teilen sich aber keine Modulinstanzen –
 * deshalb liegt der Zustand auf globalThis.
 *
 * Diese Datei darf nur auf dem Server importiert werden.
 */
import { EventEmitter } from "node:events";
import type { ChannelKey, PresenceInfo, StaffNotice } from "@/realtime/protocol";

export type BusEvent =
  | { type: "ticket.message"; ticketId: number; internal: boolean; fromStaff: boolean }
  | { type: "ticket.updated"; ticketId: number }
  | { type: "inquiry.message"; inquiryId: number; fromStaff: boolean }
  | { type: "inquiry.updated"; inquiryId: number }
  | { type: "staff.notice"; notice: StaffNotice };

type RealtimeGlobal = {
  emitter: EventEmitter;
  /** Kanal -> Verbindung -> Teilnehmer */
  presence: Map<ChannelKey, Map<string, PresenceEntry>>;
  serverAttached: boolean;
};

/** Teilnehmer eines Kanals. userId: angemeldetes Konto (Portal, Verwaltung); fehlt bei Gästen mit Status- oder Chat-Link. */
export type PresenceEntry = { name: string; staff: boolean; userId?: string };

const g = globalThis as unknown as { __hertlinRealtime?: RealtimeGlobal };

function state(): RealtimeGlobal {
  if (!g.__hertlinRealtime) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    g.__hertlinRealtime = { emitter, presence: new Map(), serverAttached: false };
  }
  return g.__hertlinRealtime;
}

/** Ereignis an alle verbundenen Browser verteilen. Ohne WebSocket-Server ein No-op. */
export function publish(event: BusEvent): void {
  try {
    state().emitter.emit("event", event);
  } catch (error) {
    console.error("[realtime] publish fehlgeschlagen", error);
  }
}

export function onBusEvent(listener: (event: BusEvent) => void): () => void {
  const emitter = state().emitter;
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

export function markServerAttached(): void {
  state().serverAttached = true;
}

/* ---------- Anwesenheit ---------- */

export function setPresence(key: ChannelKey, connectionId: string, info: PresenceEntry | null): void {
  const map = state().presence;
  let channel = map.get(key);
  if (!channel) {
    if (!info) return;
    channel = new Map();
    map.set(key, channel);
  }
  if (info) channel.set(connectionId, info);
  else channel.delete(connectionId);
  if (channel.size === 0) map.delete(key);
}

export function getPresence(key: ChannelKey): PresenceInfo {
  const channel = state().presence.get(key);
  const staff = new Set<string>();
  const customers = new Set<string>();
  for (const p of channel?.values() ?? []) (p.staff ? staff : customers).add(p.name);
  return { staff: [...staff], customers: [...customers] };
}

/** Hat gerade irgendein Kunde das Ticket offen? Für E-Mails isRecipientWatchingTicket() nehmen. */
export function isCustomerWatchingTicket(ticketId: number): boolean {
  return getPresence(`ticket:${ticketId}`).customers.length > 0;
}

/**
 * Hat genau der Empfänger der E-Mail das Ticket gerade offen? Nur dann ist die Mail überflüssig.
 * recipientUserId: Portalkonto des Empfängers (siehe customerRecipient). null = Empfänger ohne Konto,
 * z. B. Privatkunde mit Status-Link: Dann zählen nur Gäste im Kanal, nicht andere Portalbenutzer derselben Firma.
 */
export function isRecipientWatchingTicket(ticketId: number, recipientUserId: string | null): boolean {
  return isRecipientPresent(state().presence.get(`ticket:${ticketId}`)?.values() ?? [], recipientUserId);
}

/** Reine Prüfung für isRecipientWatchingTicket (auch für Tests). */
export function isRecipientPresent(entries: Iterable<PresenceEntry>, recipientUserId: string | null): boolean {
  for (const entry of entries) {
    if (entry.staff) continue;
    if (recipientUserId ? entry.userId === recipientUserId : !entry.userId) return true;
  }
  return false;
}

export function isStaffWatchingTicket(ticketId: number): boolean {
  return getPresence(`ticket:${ticketId}`).staff.length > 0;
}

export function isCustomerWatchingInquiry(inquiryId: number): boolean {
  return getPresence(`inquiry:${inquiryId}`).customers.length > 0;
}

export function isStaffWatchingInquiry(inquiryId: number): boolean {
  return getPresence(`inquiry:${inquiryId}`).staff.length > 0;
}

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
  presence: Map<ChannelKey, Map<string, { name: string; staff: boolean }>>;
  serverAttached: boolean;
};

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

export function setPresence(key: ChannelKey, connectionId: string, info: { name: string; staff: boolean } | null): void {
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

/** Hat gerade ein Kunde das Ticket offen? Dann ist eine zusätzliche E-Mail meist überflüssig. */
export function isCustomerWatchingTicket(ticketId: number): boolean {
  return getPresence(`ticket:${ticketId}`).customers.length > 0;
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

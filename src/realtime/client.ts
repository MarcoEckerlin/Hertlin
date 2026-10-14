"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WS_PATH, type ChannelKey, type ClientMessage, type PresenceInfo, type ServerMessage } from "@/realtime/protocol";

/**
 * Eine WebSocket-Verbindung pro Browser-Tab, geteilt von allen Komponenten.
 * Baut sich bei Abbruch mit wachsender Wartezeit neu auf und meldet Kanäle erneut an.
 */

type SubscribeSpec = Extract<ClientMessage, { t: "sub" }>;
type Listener = (message: ServerMessage) => void;

class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private specs = new Map<string, { spec: SubscribeSpec; refs: number }>();
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private statusListeners = new Set<() => void>();
  connected = false;

  private specId(spec: SubscribeSpec): string {
    return JSON.stringify(spec);
  }

  /** Gibt eine Abmeldefunktion zurück; diese liefert true, wenn niemand mehr zuhört. */
  subscribe(spec: SubscribeSpec): () => boolean {
    const id = this.specId(spec);
    const entry = this.specs.get(id);
    if (entry) entry.refs += 1;
    else {
      this.specs.set(id, { spec, refs: 1 });
      this.ensureSocket();
      this.sendRaw(spec);
    }
    return () => {
      const e = this.specs.get(id);
      if (!e) return false;
      e.refs -= 1;
      if (e.refs > 0) return false;
      this.specs.delete(id);
      return true;
    };
  }

  unsubscribeKey(key: ChannelKey) {
    this.sendRaw({ t: "unsub", key });
  }

  onMessage(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  send(message: ClientMessage) {
    this.sendRaw(message);
  }

  private setConnected(value: boolean) {
    if (this.connected === value) return;
    this.connected = value;
    for (const l of this.statusListeners) l();
  }

  private sendRaw(message: ClientMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private ensureSocket() {
    if (typeof window === "undefined") return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    if (this.timer) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}${WS_PATH}`);
    this.socket = socket;

    socket.onopen = () => {
      this.retry = 0;
      this.setConnected(true);
      for (const { spec } of this.specs.values()) this.sendRaw(spec);
    };
    socket.onmessage = (event) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      for (const l of this.listeners) l(message);
    };
    socket.onclose = (event) => {
      this.setConnected(false);
      this.socket = null;
      // 4401 = Sitzung beendet: nicht endlos neu verbinden, Seite neu laden lässt die App zur Anmeldung leiten
      if (event.code === 4401) return;
      if (this.specs.size === 0) return;
      const delay = Math.min(30_000, 1000 * 2 ** this.retry) + Math.round(Math.random() * 500);
      this.retry += 1;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.ensureSocket();
      }, delay);
    };
    socket.onerror = () => socket.close();
  }
}

let client: RealtimeClient | null = null;
function getClient(): RealtimeClient {
  client ??= new RealtimeClient();
  return client;
}

/** Verbindungsstatus (für eine kleine „Live“-Anzeige). */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(
    (cb) => getClient().onStatus(cb),
    () => getClient().connected,
    () => false,
  );
}

export function channelKeyOf(spec: SubscribeSpec): ChannelKey | null {
  if (spec.ch === "staff") return "staff";
  if (spec.ch === "ticket") return `ticket:${spec.id}`;
  if (spec.ch === "inquiry" && spec.id) return `inquiry:${spec.id}`;
  return null;
}

type ChannelState = {
  presence: PresenceInfo;
  /** Wer gerade schreibt (Name -> Zeitstempel) */
  typing: { name: string; staff: boolean }[];
  key: ChannelKey | null;
};

/**
 * Meldet einen Kanal an und ruft onEvent für neue Nachrichten/Änderungen auf.
 * Liefert Anwesenheit und Tipp-Anzeige.
 */
export function useChannel(spec: SubscribeSpec | null, onEvent?: (message: ServerMessage) => void): ChannelState {
  const [key, setKey] = useState<ChannelKey | null>(spec ? channelKeyOf(spec) : null);
  const [presence, setPresence] = useState<PresenceInfo>({ staff: [], customers: [] });
  const [typing, setTyping] = useState<Record<string, { staff: boolean; until: number }>>({});
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  const specJson = spec ? JSON.stringify(spec) : null;

  useEffect(() => {
    if (!specJson) return;
    const parsed = JSON.parse(specJson) as SubscribeSpec;
    const c = getClient();
    let currentKey: ChannelKey | null = channelKeyOf(parsed);

    const off = c.onMessage((message) => {
      if (message.t === "subscribed") {
        // Gäste kennen den Schlüssel erst nach der Anmeldung (Anfrage per Token)
        if (!currentKey && parsed.ch === "inquiry" && message.key.startsWith("inquiry:")) {
          currentKey = message.key;
          setKey(message.key);
        }
        return;
      }
      if (!("key" in message) || message.key !== currentKey) return;
      if (message.t === "presence") setPresence(message.presence);
      else if (message.t === "typing") {
        setTyping((prev) => ({ ...prev, [message.name]: { staff: message.staff, until: Date.now() + 4000 } }));
      } else if (message.t === "message") {
        // Wer eine Nachricht geschickt hat, tippt nicht mehr
        setTyping({});
        onEventRef.current?.(message);
      } else onEventRef.current?.(message);
    });
    const offNotice = parsed.ch === "staff" ? c.onMessage((m) => m.t === "notice" && onEventRef.current?.(m)) : () => undefined;
    const unsubscribe = c.subscribe(parsed);

    return () => {
      off();
      offNotice();
      if (unsubscribe() && currentKey) c.unsubscribeKey(currentKey);
    };
  }, [specJson]);

  // Abgelaufene Tipp-Hinweise entfernen
  useEffect(() => {
    if (Object.keys(typing).length === 0) return;
    const timer = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(Object.entries(prev).filter(([, v]) => v.until > now));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typing]);

  return {
    key,
    presence,
    typing: Object.entries(typing).map(([name, v]) => ({ name, staff: v.staff })),
  };
}

/** Liefert einen Handler für Textfelder, der „schreibt gerade …“ meldet (gedrosselt). */
export function useTypingSignal(key: ChannelKey | null, internal = false) {
  const last = useRef(0);
  return useCallback(() => {
    if (!key) return;
    const now = Date.now();
    if (now - last.current < 2000) return;
    last.current = now;
    getClient().send({ t: "typing", key, internal });
  }, [key, internal]);
}

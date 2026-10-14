"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChannel, useRealtimeConnected } from "@/realtime/client";
import { cn } from "@/lib/cn";

const SPEC = { t: "sub", ch: "staff" } as const;

/**
 * Lädt die Anrufliste bzw. die Anrufseite neu, sobald die Telefonanlage etwas meldet
 * oder ein Kollege einen Anruf bearbeitet. Zeigt dazu den Verbindungsstatus.
 */
export function CallsLiveRefresh({ callId }: { callId?: string }) {
  const router = useRouter();
  const connected = useRealtimeConnected();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useChannel(SPEC, (message) => {
    if (message.t !== "notice") return;
    const n = message.notice;
    if (n.kind !== "call.incoming" && n.kind !== "call.updated") return;
    // Auf der Detailseite nur auf den eigenen Anruf reagieren
    if (callId && n.callId !== callId) return;
    // Mehrere Meldungen kurz hintereinander zusammenfassen
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, 300);
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted" aria-live="polite">
      <span className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-slate-300")} aria-hidden />
      {connected ? "Live – aktualisiert sich selbst" : "Live-Verbindung wird aufgebaut …"}
    </span>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";

type PermissionState = NotificationPermission | "unsupported" | "unknown";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function getServerSnapshot(): PermissionState {
  return "unknown";
}

/**
 * Bittet um Erlaubnis für Desktop-Hinweise. Dann meldet sich der Browser bei einem Anruf
 * auch, wenn die Verwaltung nur im Hintergrund geöffnet ist.
 */
export function NotificationPermission({ compact = false }: { compact?: boolean }) {
  const permission = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (permission === "unknown") return null;
  if (permission === "unsupported") {
    return compact ? null : <p className="text-sm text-ink-muted">Dieser Browser unterstützt keine Desktop-Hinweise.</p>;
  }
  if (permission === "granted") {
    return compact ? null : (
      <p className="text-sm text-ink-soft">
        Desktop-Hinweise sind in diesem Browser erlaubt. Eingehende Anrufe melden sich auch, wenn die Verwaltung im Hintergrund läuft.
      </p>
    );
  }
  if (permission === "denied") {
    return compact ? null : (
      <p className="text-sm text-ink-soft">
        Desktop-Hinweise sind in diesem Browser blockiert. Sie lassen sich in den Website-Einstellungen des Browsers (Schloss-Symbol
        neben der Adresse) wieder erlauben.
      </p>
    );
  }

  return (
    <div className={compact ? "" : "space-y-2"}>
      {compact ? null : (
        <p className="text-sm text-ink-soft">
          Erlauben Sie Desktop-Hinweise, damit sich ein Anruf auch meldet, wenn die Verwaltung nur im Hintergrund geöffnet ist.
        </p>
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          try {
            await Notification.requestPermission();
          } finally {
            for (const l of listeners) l();
          }
        }}
      >
        <BellRing className="size-4" aria-hidden />
        Desktop-Hinweise erlauben
      </Button>
    </div>
  );
}

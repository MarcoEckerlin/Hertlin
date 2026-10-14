"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

/**
 * Kurze Rückmeldungen nach Aktionen („Position gespeichert“). Verschwinden nach einigen Sekunden.
 * Aufruf überall im Browser: showToast("Gespeichert."). Einmal <Toaster /> pro Bereich einbinden (AppShell).
 * Fehler, die man lesen muss, gehören weiter als Alert an das Formular.
 */
type ToastTone = "success" | "info" | "error";
type Toast = { id: number; message: string; tone: ToastTone };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function showToast(message: string, tone: ToastTone = "success") {
  const id = nextId++;
  // Gleiche Meldung nicht doppelt stapeln
  toasts = [...toasts.filter((t) => t.message !== message), { id, message, tone }].slice(-3);
  emit();
  window.setTimeout(() => dismissToast(id), tone === "error" ? 9000 : 5000);
}

const icons = { success: CircleCheck, info: Info, error: CircleAlert };
const tones: Record<ToastTone, string> = {
  success: "text-success-ink",
  info: "text-brand-700",
  error: "text-danger-ink",
};

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => EMPTY,
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2 max-lg:top-auto max-lg:right-4 max-lg:bottom-20 max-lg:left-4 max-lg:mx-auto"
    >
      {list.map((toast) => {
        const Icon = icons[toast.tone];
        return (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-line bg-surface-raised px-4 py-3 text-sm text-ink shadow-lift transition-[opacity,translate] duration-200 starting:translate-y-2 starting:opacity-0"
          >
            <Icon className={cn("mt-0.5 size-4 shrink-0", tones[toast.tone])} aria-hidden />
            <p className="min-w-0 flex-1 leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="-m-1 grid size-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-mist hover:text-ink"
              aria-label="Meldung schließen"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Rückmeldung aus einem Query-Parameter (z. B. ?kosten=gespeichert nach einer Weiterleitung) als Toast zeigen
 * und den Parameter aus der Adresse entfernen, damit Neuladen oder Teilen sie nicht wiederholt.
 * value kommt von der Seite (searchParams), messages ordnet Werte Texten zu.
 */
export function FlashToast({
  param,
  value,
  messages,
  tone = "success",
}: {
  param: string;
  value: string | undefined;
  messages: Record<string, string>;
  tone?: ToastTone;
}) {
  useEffect(() => {
    if (!value) return;
    const message = messages[value];
    if (message) showToast(message, tone);
    const url = new URL(window.location.href);
    if (!url.searchParams.has(param)) return;
    url.searchParams.delete(param);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    // Nur beim ersten Anzeigen der Seite mit diesem Wert
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [param, value]);
  return null;
}

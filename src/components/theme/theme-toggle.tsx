"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { THEME_COOKIE, parseThemeChoice, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/cn";

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Wie Gerät", icon: Monitor },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
];

const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  return parseThemeChoice(document.documentElement.getAttribute("data-theme"));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyChoice(choice: ThemeChoice) {
  const html = document.documentElement;
  const domain = html.getAttribute("data-cookie-domain");
  const domainPart = domain ? `; domain=${domain}` : "";
  if (choice === "system") {
    html.removeAttribute("data-theme");
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax${domainPart}`;
  } else {
    html.setAttribute("data-theme", choice);
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax${domainPart}`;
  }
  listeners.forEach((l) => l());
}

/**
 * Umschalter Wie Gerät / Hell / Dunkel. Liest den aktuellen Stand aus <html data-theme> (vom Server gesetzt).
 * compact: nur Symbole (Kopfzeile), sonst mit Beschriftung (Seitenleiste, Menü).
 */
export function ThemeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  // Auf dem Server ist die Wahl unbekannt („Wie Gerät“); nach dem Laden gilt der Wert aus <html>
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as ThemeChoice);

  return (
    <div
      role="radiogroup"
      aria-label="Farbschema"
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-mist p-0.5 ring-1 ring-inset ring-line", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            onClick={() => applyChoice(value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors",
              compact ? "size-7" : "h-7 px-2.5",
              active ? "bg-surface text-ink shadow-card ring-1 ring-inset ring-line" : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

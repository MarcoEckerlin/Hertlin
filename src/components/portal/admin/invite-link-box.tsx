"use client";

import { CopyButton } from "@/components/ui/copy-button";

/**
 * Einladungslink zum Kopieren – für den Fall, dass die E-Mail im Spam landet oder gar nicht ankommt.
 * Der Link enthält ein Einmal-Token und wird deshalb nur direkt nach dem Erzeugen angezeigt.
 */
export function InviteLinkBox({ link, name }: { link: string; name: string }) {
  return (
    <div className="rounded-xl border border-line bg-mist p-4">
      <p className="text-sm font-semibold text-ink">Einladungslink zum Weitergeben</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Falls die E-Mail nicht ankommt, schicken Sie {name} diesen Link einfach selbst, z. B. per Teams oder SMS. Er ist
        7 Tage gültig und funktioniert nur einmal.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          readOnly
          value={link}
          aria-label={`Einladungslink für ${name}`}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-white px-3 font-mono text-xs text-ink focus:border-brand-500 focus:ring-3 focus:ring-brand-200/70 focus:outline-none"
        />
        <CopyButton value={link} label="Link kopieren" />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Wer diesen Link hat, kann das Passwort für den Zugang festlegen. Geben Sie ihn deshalb nur an {name} weiter.
      </p>
    </div>
  );
}

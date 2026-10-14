"use client";

import { CopyButton } from "@/components/ui/copy-button";

/**
 * Einladungs- oder Passwortlink zum Kopieren, falls die E-Mail nicht ankommt.
 * Der Link enthält ein Einmal-Token und wird deshalb nur direkt nach dem Erzeugen angezeigt.
 */
export function InviteLinkBox({
  link,
  name,
  purpose = "invite",
}: {
  link: string;
  name: string;
  purpose?: "invite" | "reset";
}) {
  const invite = purpose === "invite";
  return (
    <div className="rounded-xl border border-line bg-mist p-4">
      <p className="text-sm font-semibold text-ink">{invite ? "Einladungslink" : "Link zum Zurücksetzen des Passworts"}</p>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Die E-Mail an {name} ist unterwegs. Falls sie nicht ankommt, geben Sie den Link direkt weiter. Er funktioniert
        nur einmal und ist {invite ? "7 Tage" : "eine Stunde"} gültig.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          readOnly
          value={link}
          aria-label={invite ? `Einladungslink für ${name}` : `Passwortlink für ${name}`}
          onFocus={(e) => e.currentTarget.select()}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line-strong bg-white px-3 font-mono text-xs text-ink focus:border-brand-500 focus:ring-3 focus:ring-brand-200/70 focus:outline-none"
        />
        <CopyButton value={link} label="Link kopieren" />
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Wer den Link hat, kann das Passwort für diesen Zugang festlegen. Nur an {name} weitergeben.
      </p>
    </div>
  );
}

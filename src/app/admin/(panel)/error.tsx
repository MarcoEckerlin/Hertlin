"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * Unerwarteter Fehler auf einer Seite der Verwaltung. Navigation und Menü bleiben stehen;
 * „Erneut versuchen“ lädt nur den Inhalt neu.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[verwaltung] Seite konnte nicht angezeigt werden:", error.digest ?? error.message);
  }, [error]);

  return (
    <div role="alert" className="max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
      <h1 className="text-xl font-bold text-ink">Das hat gerade nicht geklappt</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
        Die Seite konnte nicht geladen werden. Meist hilft es, es gleich noch einmal zu versuchen.
        {error.digest ? <span className="mt-2 block text-xs text-ink-muted">Fehlerkennung: {error.digest}</span> : null}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden />
          Erneut versuchen
        </Button>
        <ButtonLink href="/admin" variant="secondary">
          Zur Übersicht
        </ButtonLink>
      </div>
    </div>
  );
}

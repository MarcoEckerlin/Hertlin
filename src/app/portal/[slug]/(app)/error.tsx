"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";

/** Unerwarteter Fehler auf einer Portalseite: Seitenleiste bleibt, Kunde kann es erneut versuchen. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[portal] Seite konnte nicht geladen werden:", error);
  }, [error]);

  return (
    <div className="max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8" role="alert">
      <h1 className="text-xl font-bold text-ink">Das hat gerade nicht geklappt</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
        Die Seite konnte nicht geladen werden. Meist hilft es, es gleich noch einmal zu versuchen.
      </p>
      {error.digest ? <p className="mt-2 text-xs text-ink-muted">Fehlerkennung: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => reset()}>Erneut versuchen</Button>
        <ButtonLink href="/" variant="secondary">
          Zur Übersicht
        </ButtonLink>
      </div>
    </div>
  );
}

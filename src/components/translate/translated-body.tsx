"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { languageLabel } from "@/lib/languages";

/**
 * Text einer Chat-Nachricht, wahlweise übersetzt.
 * translation: übersetzter Text + erkannte Ausgangssprache; ohne translation wird nur das Original gezeigt.
 */
export function TranslatedBody({
  original,
  translation,
  className,
}: {
  original: string;
  translation?: { text: string; from: string | null } | null;
  className?: string;
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  if (!translation) return <div className={className}>{original}</div>;
  // Nachrichtentext nicht vom Website-Übersetzer anfassen lassen, die Schaltfläche schon
  return (
    <div>
      <div className={className} data-no-translate>
        {showOriginal ? original : translation.text}
      </div>
      <button
        type="button"
        onClick={() => setShowOriginal((v) => !v)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"
      >
        <Languages className="size-3.5" aria-hidden />
        {showOriginal
          ? "Übersetzung anzeigen"
          : `Übersetzt aus ${translation.from ? languageLabel(translation.from) : "einer anderen Sprache"} · Original anzeigen`}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatQuantityWithUnit } from "@/lib/cost-catalog";
import { CostAddForm, type CostPick } from "@/components/admin/tickets/cost-add-form";
import type { PresetOption, StaffChoice } from "@/components/admin/tickets/cost-values";

/** So viele häufig benutzte Katalogeinträge stehen als Schnellwahl über dem Formular */
const QUICK_PICKS = 5;

/** Häufig und zuletzt benutzte zuerst; nie benutzte nach der Reihenfolge im Katalog */
function quickPicks(presets: PresetOption[]): PresetOption[] {
  return [...presets]
    .sort(
      (a, b) =>
        b.usageCount - a.usageCount ||
        (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "") ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name, "de"),
    )
    .slice(0, QUICK_PICKS);
}

/**
 * „Position erfassen“ im Ticket: eingeklappt nur ein Knopf und die häufigsten Katalogeinträge als Schnellwahl.
 * Ein Tipp auf einen Eintrag öffnet das Formular vorausgefüllt, „Position hinzufügen“ bestätigt.
 * Das Formular bleibt beim Einklappen erhalten (angefangene Eingaben gehen nicht verloren).
 */
export function CostCapture({
  ticketId,
  presets,
  staff,
  currentUserId,
  canSetPrice,
  laborHint,
  today,
}: {
  ticketId: number;
  presets: PresetOption[];
  staff: StaffChoice[];
  currentUserId: string;
  canSetPrice: boolean;
  laborHint: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<CostPick | null>(null);
  const quick = quickPicks(presets);

  return (
    <div className="rounded-xl bg-mist ring-1 ring-line ring-inset">
      <div className="flex flex-wrap items-center gap-2 p-2.5 sm:px-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="kosten-erfassen"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-semibold text-ink ring-1 ring-line-strong ring-inset transition-colors hover:bg-brand-50 hover:ring-brand-300"
        >
          <Plus className="size-4" aria-hidden />
          Position erfassen
          <ChevronDown
            className={cn("size-4 text-ink-muted transition-transform duration-200", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {quick.length > 0 ? (
          <ul aria-label="Schnellwahl aus dem Katalog" className="flex min-w-0 flex-wrap gap-1.5">
            {quick.map((p) => (
              <li key={p.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(true);
                    setPick((prev) => ({ presetId: p.id, nonce: (prev?.nonce ?? 0) + 1 }));
                  }}
                  title={`${p.name} (${formatQuantityWithUnit(p.defaultQuantityHundredths, p.unit)}) eintragen`}
                  className="inline-flex h-8 max-w-full items-center rounded-full px-3 text-xs font-semibold text-ink-soft ring-1 ring-line ring-inset transition-colors hover:bg-surface hover:text-ink hover:ring-brand-300"
                >
                  <span className="truncate">{p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div
        id="kosten-erfassen"
        hidden={!open}
        className="border-t border-line px-4 py-4 transition-[opacity,translate] duration-200 starting:-translate-y-1 starting:opacity-0 sm:px-5 sm:py-5"
      >
        <CostAddForm
          ticketId={ticketId}
          presets={presets}
          staff={staff}
          currentUserId={currentUserId}
          canSetPrice={canSetPrice}
          laborHint={laborHint}
          today={today}
          pick={pick}
        />
      </div>
    </div>
  );
}

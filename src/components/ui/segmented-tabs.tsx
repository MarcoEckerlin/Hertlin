import Link from "next/link";
import { cn } from "@/lib/cn";

export type SegmentedTab = {
  href: string;
  label: string;
  active: boolean;
  /** Anzahl rechts neben der Beschriftung */
  count?: number;
  /** Anzahl hervorheben (z. B. „Rückfrage an Sie“ mit offenen Rückfragen) */
  highlight?: boolean;
};

/**
 * Einheitliche Filter-Reiter für Listen (Tickets, Kunden, Anfragen, Anrufe, Rechnungen …).
 * Links statt Buttons, damit Filter in der Adresse stehen und der Zurück-Knopf funktioniert.
 * Auf schmalen Bildschirmen brechen die Reiter um, statt seitlich zu scrollen.
 */
export function SegmentedTabs({ label, tabs, className }: { label: string; tabs: SegmentedTab[]; className?: string }) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line ring-inset">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                tab.active ? "bg-brand-100 text-ink" : "text-ink-soft hover:bg-brand-50 hover:text-ink",
              )}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[0.7rem] leading-none font-bold tabular-nums",
                    tab.highlight && tab.count > 0
                      ? "bg-caution-soft text-caution-ink ring-1 ring-caution-line ring-inset"
                      : tab.active
                        ? "bg-surface text-ink"
                        : "bg-mist text-ink-muted",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

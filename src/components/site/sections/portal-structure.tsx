import { Building2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

const subCustomers = [
  { name: "Filiale Nord", detail: "4 Benutzer · eigene Filialleitung" },
  { name: "Filiale Süd", detail: "3 Benutzer" },
  { name: "Lager Hafenstraße", detail: "2 Benutzer" },
  { name: "Homeoffice", detail: "6 Benutzer" },
];

/**
 * Schaubild: ein Firmenkunde mit eigener Portal-Adresse und mehreren Unterkunden.
 * Dekorativ, der Inhalt steht im Text daneben.
 */
export function PortalStructure({ host, className }: { host: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("rounded-3xl border border-line bg-white p-5 shadow-card sm:p-7", className)}>
      <div className="flex items-start gap-3 rounded-2xl bg-brand-100 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-brand-700">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-ink">Ihre Firma GmbH</p>
          <p className="truncate text-sm text-ink-soft">{host}</p>
          <p className="mt-1 text-xs font-semibold text-brand-800">Hauptansprechpartner sehen alle Tickets</p>
        </div>
      </div>

      <ul className="ml-5 space-y-2.5 border-l-2 border-brand-200 pt-4 pl-5">
        {subCustomers.map((s) => (
          <li
            key={s.name}
            className="relative rounded-xl border border-line bg-white px-4 py-3 before:absolute before:top-1/2 before:left-[calc(-1.25rem-1px)] before:h-0.5 before:w-[calc(1.25rem+1px)] before:bg-brand-200"
          >
            <p className="text-[0.9375rem] font-semibold text-ink">{s.name}</p>
            <p className="text-xs text-ink-muted">{s.detail}</p>
          </li>
        ))}
        <li className="relative flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm font-semibold text-ink-soft before:absolute before:top-1/2 before:left-[calc(-1.25rem-1px)] before:h-0.5 before:w-[calc(1.25rem+1px)] before:bg-brand-200 after:absolute after:top-[calc(50%+2px)] after:-bottom-px after:left-[calc(-1.25rem-4px)] after:w-1 after:bg-white">
          {/* after: verdeckt die senkrechte Linie unterhalb des letzten Eintrags */}
          <Plus className="size-4 text-brand-700" />
          Unterkunde anlegen
        </li>
      </ul>
    </div>
  );
}

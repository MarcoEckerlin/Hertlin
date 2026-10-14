import { Lock, Plus } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const tickets = [
  {
    number: "T-00142",
    subject: "VPN trennt sich im Homeoffice nach ein paar Minuten",
    meta: "Homeoffice · J. Becker · heute, 9:12 Uhr",
    status: "IN_PROGRESS",
  },
  {
    number: "T-00139",
    subject: "Arbeitsplatz für neue Auszubildende einrichten",
    meta: "Zentrale · M. Kaya · gestern",
    status: "WAITING_CUSTOMER",
  },
  {
    number: "T-00137",
    subject: "Drucker im Empfang druckt leere Seiten",
    meta: "Filiale Nord · S. Wagner · Mo., 14:30 Uhr",
    status: "RESOLVED",
  },
] as const;

const sideNav = [
  { label: "Übersicht", active: false },
  { label: "Tickets", active: true },
  { label: "Neues Ticket", active: false },
];

/**
 * Nachgebaute Ansicht des Kundenportals für die Startseite.
 * Rein dekorativ: keine Links, keine Fokusziele, für Screenreader ausgeblendet.
 */
export function PortalMockup({ host, companyName, className }: { host: string; companyName: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative select-none", className)}>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-lift">
        {/* Browserleiste */}
        <div className="flex items-center gap-3 border-b border-line bg-mist px-3 py-2.5 sm:px-4">
          <div className="flex shrink-0 gap-1.5">
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs text-ink-muted ring-1 ring-line">
            <Lock className="size-3 shrink-0" />
            <span className="truncate">
              <span className="font-semibold text-ink">{host}</span>/tickets
            </span>
          </div>
        </div>

        <div className="flex">
          {/* Seitenleiste des Portals */}
          <div className="hidden w-44 shrink-0 border-r border-line p-3 sm:block">
            <div className="flex items-center gap-2 px-1.5 pt-1 pb-4">
              <LogoMark className="size-6" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-xs font-extrabold text-ink">Ihre Firma GmbH</span>
                <span className="block truncate text-[0.65rem] text-ink-muted">Kundenportal</span>
              </span>
            </div>
            <ul className="space-y-0.5">
              {sideNav.map((item) => (
                <li
                  key={item.label}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                    item.active ? "bg-brand-100 text-ink" : "text-ink-soft",
                  )}
                >
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="mt-4 mb-1 px-2.5 text-[0.6rem] font-bold tracking-wider text-ink-muted uppercase">Verwaltung</p>
            <ul className="space-y-0.5">
              <li className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft">Unterkunden</li>
              <li className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft">Benutzer</li>
            </ul>
          </div>

          {/* Ticketliste */}
          <div className="min-w-0 flex-1 bg-mist/60 p-3.5 sm:p-5 md:pb-28">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-ink">Tickets</p>
                <p className="text-xs text-ink-muted">Alle Standorte · 2 offen</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-400 px-3 py-1.5 text-xs font-semibold text-ink">
                <Plus className="size-3.5" />
                Neues Ticket
              </span>
            </div>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
              {tickets.map((t) => (
                <li key={t.number} className="px-3.5 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <p className="min-w-0 flex-1 basis-48 text-[0.8125rem] leading-snug font-semibold text-ink">{t.subject}</p>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="mt-1 text-[0.7rem] text-ink-muted">
                    <span className="font-semibold text-ink-soft">{t.number}</span> · {t.meta}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right text-[0.7rem] font-semibold text-brand-700">Erledigte Tickets anzeigen</p>
          </div>
        </div>
      </div>

      {/* Antwort aus dem gelösten Ticket */}
      <div className="absolute -bottom-8 -left-3 hidden w-72 rounded-2xl border border-line bg-white p-4 shadow-lift md:block lg:-left-8">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-7" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-bold text-ink">{companyName} Technik</p>
            <p className="text-[0.65rem] text-ink-muted">Antwort zu T-00137 · Mo., 15:05 Uhr</p>
          </div>
        </div>
        <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
          In der neuen Tonerkartusche steckte noch die Transportsicherung. Ist entfernt, die Testseite sieht gut aus.
        </p>
      </div>
    </div>
  );
}

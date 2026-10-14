import { PriorityBadge } from "@/components/ui/badge";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";

/** "Kritisch – der Betrieb steht" → "Der Betrieb steht" (Priorität steht schon im Badge). */
function describe(label: string): string {
  const parts = label.split(" – ");
  const rest = parts.length > 1 ? parts.slice(1).join(" – ") : label;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * Übersicht der Reaktionszeiten aus der Firmenkonfiguration.
 * Als Beschreibungsliste statt Tabelle, damit die Zeilen auf schmalen Bildschirmen sauber umbrechen.
 */
export function ResponseTimesTable({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-3xl border border-line bg-white shadow-card", className)}>
      <div
        aria-hidden="true"
        className="hidden justify-between border-b border-line bg-mist px-6 py-3 text-xs font-semibold text-ink-muted sm:flex"
      >
        <span>Dringlichkeit</span>
        <span>Wir melden uns</span>
      </div>
      <dl className="divide-y divide-line">
        {site.responseTimes.map((r) => (
          <div
            key={r.priority}
            className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6"
          >
            <dt className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <PriorityBadge priority={r.priority} />
              <span className="text-[0.9375rem] text-ink">{describe(r.label)}</span>
            </dt>
            <dd className="text-[0.9375rem] font-semibold text-ink sm:text-right">
              <span className="font-normal text-ink-soft sm:sr-only">Rückmeldung </span>
              {r.time}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Erläuterung, was eine Reaktionszeit bedeutet und für wen sie gilt. */
export function ResponseTimesNote({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 text-[0.9375rem] leading-relaxed text-ink-soft", className)}>
      <p>
        <span className="font-semibold text-ink">Gilt für Firmenkunden mit Betreuungsvertrag, innerhalb der Servicezeiten.</span>{" "}
        Was nach Ende der Servicezeit eingeht, bearbeiten wir ab Beginn der nächsten, sofern im Vertrag nichts anderes
        vereinbart ist.
      </p>
      <p>
        Reaktionszeit heißt: In dieser Zeit meldet sich ein Techniker bei Ihnen und fängt mit der Arbeit an. Wie lange die
        Behebung dauert, hängt von der Ursache ab – ein defektes Netzteil ist schneller getauscht als ein Server neu
        aufgesetzt.
      </p>
    </div>
  );
}

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

/** Fallback für Einträge ohne eigene 404-Seite (z. B. Anrufe, Website-Seiten), bleibt in der Verwaltung. */
export default function AdminNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Übersicht", href: "/admin" }, { label: "Nicht gefunden" }]}
        title="Diesen Eintrag gibt es nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Vielleicht wurde er gelöscht, oder die Adresse stimmt nicht. Über die Navigation links finden Sie alle Bereiche.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin">Zur Übersicht</ButtonLink>
        </div>
      </div>
    </>
  );
}

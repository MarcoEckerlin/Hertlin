import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function CostsNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kosten pro Konto", href: "/admin/kosten" }, { label: "Nicht gefunden" }]}
        title="Dieses Konto finden wir nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Den Kunden gibt es nicht mehr, oder zu dieser E-Mail-Adresse existiert kein Ticket. Die Übersicht zeigt alle
          Konten mit Kosten.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/kosten?abrechnung=alle">Zur Übersicht</ButtonLink>
        </div>
      </div>
    </>
  );
}

import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function CompanyNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kunden", href: "/admin/kunden" }, { label: "Nicht gefunden" }]}
        title="Diesen Eintrag gibt es nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Der Kunde oder Benutzer existiert nicht oder gehört zu einem anderen Firmenkunden. Suchen Sie ihn über die Kundenliste.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/kunden">Zur Kundenliste</ButtonLink>
        </div>
      </div>
    </>
  );
}

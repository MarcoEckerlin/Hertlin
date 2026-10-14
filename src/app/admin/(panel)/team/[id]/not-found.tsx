import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function StaffNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Team", href: "/admin/team" }, { label: "Nicht gefunden" }]}
        title="Dieses Teammitglied gibt es nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Der Link ist veraltet oder führt zu einem Kundenkonto. Kundenbenutzer finden Sie beim jeweiligen Kunden.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/team">Zur Teamliste</ButtonLink>
        </div>
      </div>
    </>
  );
}

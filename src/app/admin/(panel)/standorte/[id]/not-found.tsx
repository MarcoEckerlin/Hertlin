import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function LocationNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Standorte", href: "/admin/standorte" }, { label: "Nicht gefunden" }]}
        title="Diesen Standort gibt es nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Der Link ist veraltet oder der Standort wurde gelöscht.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/standorte">Zur Standortliste</ButtonLink>
        </div>
      </div>
    </>
  );
}

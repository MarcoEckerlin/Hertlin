import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function InvoiceNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Rechnungen", href: "/admin/rechnungen" }, { label: "Nicht gefunden" }]}
        title="Diese Seite finden wir nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Die Adresse ist unvollständig, oder der Kunde existiert nicht mehr. Rechnungen werden nie gelöscht – in der Liste
          finden Sie alle.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/rechnungen">Zur Rechnungsliste</ButtonLink>
        </div>
      </div>
    </>
  );
}

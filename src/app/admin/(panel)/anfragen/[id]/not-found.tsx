import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function InquiryNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Anfragen", href: "/admin/anfragen" }, { label: "Nicht gefunden" }]}
        title="Diese Anfrage gibt es nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Die Nummer ist falsch oder die Anfrage wurde inzwischen gelöscht. In der Liste finden Sie alle vorhandenen
          Anfragen, auch abgeschlossene.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/anfragen?status=alle">Alle Anfragen</ButtonLink>
        </div>
      </div>
    </>
  );
}

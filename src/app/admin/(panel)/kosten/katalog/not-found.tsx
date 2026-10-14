import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function CatalogNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kostenkatalog", href: "/admin/kosten/katalog" }, { label: "Nicht gefunden" }]}
        title="Diesen Eintrag gibt es nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Vielleicht wurde er inzwischen gelöscht. Im Katalog finden Sie alle Einträge, auch die deaktivierten.
        </p>
        <div className="mt-6">
          <ButtonLink href="/admin/kosten/katalog">Zum Kostenkatalog</ButtonLink>
        </div>
      </div>
    </>
  );
}

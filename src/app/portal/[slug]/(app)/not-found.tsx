import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

/** Seite im Kundenportal gibt es nicht oder sie liegt außerhalb des eigenen Zugangs. Bleibt im Portal statt zur Website zu führen. */
export default function PortalNotFound() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Übersicht", href: "/" }, { label: "Nicht gefunden" }]}
        title="Diese Seite finden wir nicht"
      />
      <div className="max-w-2xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
        <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
          Entweder gibt es die Adresse nicht, oder der Eintrag gehört zu einem Bereich, den Ihr Zugang nicht sieht. Über die
          Übersicht kommen Sie zu Ihren Tickets.
        </p>
        <div className="mt-6">
          <ButtonLink href="/">Zur Übersicht</ButtonLink>
        </div>
      </div>
    </>
  );
}

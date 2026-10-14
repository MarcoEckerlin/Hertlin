import type { Metadata } from "next";
import { requirePortalRootAdmin } from "@/lib/auth";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubCustomerForm } from "@/components/portal/admin/sub-customer-form";

export const metadata: Metadata = { title: "Unterkunde anlegen" };

export default async function NewSubCustomerPage() {
  const ctx = await requirePortalRootAdmin();

  return (
    <>
      <PageHeader
        title="Unterkunde anlegen"
        breadcrumbs={[{ label: "Unterkunden", href: "/unterkunden" }, { label: "Neu" }]}
        description={`Die Unterkunde gehört zu ${ctx.root.name}. Im nächsten Schritt legen Sie die Benutzer an, die dort arbeiten.`}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]">
        <Card className="max-w-2xl">
          <CardHeader title="Stammdaten" description="Pflicht ist nur der Name. Alles andere können Sie später ergänzen." />
          <CardBody>
            <SubCustomerForm mode="create" cancelHref="/unterkunden" />
          </CardBody>
        </Card>

        <aside className="space-y-3 text-sm leading-relaxed text-ink-soft lg:pt-2">
          <h2 className="text-sm font-bold text-ink">Gut zu wissen</h2>
          <p>
            Wählen Sie einen Namen, unter dem alle sofort wissen, was gemeint ist – z. B. den Ort oder die Abteilung.
            Er muss innerhalb von {ctx.root.name} eindeutig sein.
          </p>
          <p>
            Eine eigene Portaladresse bekommt die Unterkunde nicht. Ihre Benutzer melden sich im selben Kundenportal an
            wie Sie und sehen dort nur, was zu ihrer Unterkunde gehört.
          </p>
          <p>Löschen lässt sich eine Unterkunde später nicht, nur deaktivieren. So bleiben ihre Tickets erhalten.</p>
        </aside>
      </div>
    </>
  );
}

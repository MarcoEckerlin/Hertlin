import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { COST_KIND_DEFAULT_UNIT } from "@/lib/constants";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogForm } from "@/components/admin/costs/catalog-form";

export const metadata: Metadata = { title: "Position anlegen" };

/** Neuer Eintrag im Kostenkatalog – nur für Administratoren. */
export default async function NewCatalogEntryPage() {
  await requireAdmin();

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kostenkatalog", href: "/admin/kosten/katalog" }, { label: "Position anlegen" }]}
        title="Position anlegen"
        description="Steht danach im Ticket unter „Aus dem Katalog“ zur Auswahl."
      />
      <Card className="max-w-3xl">
        <CardBody className="sm:px-8 sm:py-7">
          <CatalogForm
            initial={{ name: "", kind: "LABOR", unit: COST_KIND_DEFAULT_UNIT.LABOR, unitPrice: "", defaultQuantity: "1", active: true }}
          />
        </CardBody>
      </Card>
    </>
  );
}

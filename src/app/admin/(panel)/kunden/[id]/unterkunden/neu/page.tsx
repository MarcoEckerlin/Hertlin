import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { cleanId } from "@/components/admin/companies/list-tools";
import { SubCustomerCreateForm } from "@/components/admin/companies/sub-customer-create-form";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { locationOptions } from "@/lib/locations";

export const metadata: Metadata = { title: "Unterkunde anlegen" };

export default async function NewSubCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = cleanId((await params).id);
  if (!id) notFound();

  const company = await db.company.findUnique({ where: { id }, select: { id: true, name: true, parentId: true } });
  if (!company) notFound();
  // Unterkunden haben keine eigenen Unterkunden – zum Firmenkunden wechseln
  if (company.parentId) redirect(`/admin/kunden/${company.parentId}/unterkunden/neu`);

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Kunden", href: "/admin/kunden" },
          { label: company.name, href: `/admin/kunden/${company.id}` },
          { label: "Unterkunde anlegen" },
        ]}
        title="Unterkunde anlegen"
        description={`Für ${company.name}. Unterkunden nutzen das Kundenportal des Firmenkunden mit eigenen Benutzern. Tickets lassen sich so nach Standort oder Firma trennen.`}
      />
      <Card className="max-w-3xl">
        <CardBody className="sm:p-8">
          <SubCustomerCreateForm parentId={company.id} parentName={company.name} locationOptions={await locationOptions()} />
        </CardBody>
      </Card>
    </div>
  );
}

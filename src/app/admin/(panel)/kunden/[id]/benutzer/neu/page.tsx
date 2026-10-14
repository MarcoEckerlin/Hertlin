import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyUserCreate, type CompanyOption } from "@/components/admin/companies/company-user-form";
import { cleanId } from "@/components/admin/companies/list-tools";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Benutzer anlegen" };

const collator = new Intl.Collator("de", { sensitivity: "base", numeric: true });

export default async function NewCompanyUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const id = cleanId((await params).id);
  if (!id) notFound();
  const firma = cleanId((await searchParams).firma);

  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      active: true,
      parentId: true,
      children: { select: { id: true, name: true, active: true } },
    },
  });
  if (!company) notFound();
  // Aufruf über eine Unterkunde: Firmenkunde als Bereich, Unterkunde vorausgewählt
  if (company.parentId) redirect(`/admin/kunden/${company.parentId}/benutzer/neu?firma=${company.id}`);

  const companies: CompanyOption[] = [
    { id: company.id, name: company.name, isRoot: true, active: company.active },
    ...company.children
      .map((c) => ({ id: c.id, name: c.name, isRoot: false, active: c.active }))
      .sort((a, b) => collator.compare(a.name, b.name)),
  ];
  const defaultCompanyId = companies.some((c) => c.id === firma) && firma ? firma : company.id;
  const preselected = companies.find((c) => c.id === defaultCompanyId);
  // Hat die Firma noch keinen aktiven Hauptansprechpartner, schlagen wir diese Rolle vor
  const hasMainContact = await db.user.count({
    where: { companyId: defaultCompanyId, role: "CUSTOMER_ADMIN", active: true },
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Kunden", href: "/admin/kunden" },
          { label: company.name, href: `/admin/kunden/${company.id}` },
          { label: "Benutzer anlegen" },
        ]}
        title="Benutzer anlegen"
        description={`Zugang zum Kundenportal von ${company.name}${companies.length > 1 ? " oder einer Unterkunde" : ""}.`}
      />
      <div className="max-w-3xl space-y-5">
        {!company.active ? (
          <Alert tone="warning" title="Kunde deaktiviert">
            Solange {company.name} gesperrt ist, kann sich niemand anmelden. Aktivieren Sie den Kunden zuerst.
          </Alert>
        ) : preselected && !preselected.active ? (
          <Alert tone="warning" title="Unterkunde deaktiviert">
            {preselected.name} ist gesperrt. Wählen Sie eine aktive Firma oder aktivieren Sie die Unterkunde zuerst.
          </Alert>
        ) : null}
        <Card>
          <CardBody className="sm:p-8">
            <CompanyUserCreate
              rootId={company.id}
              companies={companies}
              defaultCompanyId={defaultCompanyId}
              defaultRole={hasMainContact > 0 ? "CUSTOMER_USER" : "CUSTOMER_ADMIN"}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyEditForm } from "@/components/admin/companies/company-edit-form";
import { CompanyStatusForm } from "@/components/admin/companies/company-status-form";
import { cleanId } from "@/components/admin/companies/list-tools";
import { SlugChangeForm } from "@/components/admin/companies/slug-change-form";
import { requireAdmin } from "@/lib/auth";
import { CUSTOMER_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { portalHost, rootDomain } from "@/lib/hosts";
import { locationOptions } from "@/lib/locations";

export const metadata: Metadata = { title: "Kunde bearbeiten" };

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = cleanId((await params).id);
  if (!id) notFound();

  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      customerNumber: true,
      street: true,
      zip: true,
      city: true,
      phone: true,
      email: true,
      internalNote: true,
      active: true,
      locationId: true,
      location: { select: { id: true, name: true, city: true, active: true } },
      billingEmail: true,
      billingName: true,
      billingStreet: true,
      billingZip: true,
      billingCity: true,
      vatId: true,
      invoiceSeparately: true,
      parent: { select: { id: true, name: true, active: true } },
      children: { select: { id: true } },
    },
  });
  if (!company) notFound();

  // Deaktivierter Standort bleibt auswählbar, solange er zugeordnet ist (sonst ginge er beim Speichern verloren)
  const options = await locationOptions();
  if (company.location && !company.location.active && !options.some((o) => o.value === company.location?.id)) {
    options.push({ value: company.location.id, label: `${company.location.name} (deaktiviert)` });
  }

  const isSub = company.parentId !== null;
  const treeIds = isSub ? [company.id] : [company.id, ...company.children.map((c) => c.id)];
  const activeUsers = await db.user.count({
    where: { companyId: { in: treeIds }, active: true, role: { in: [...CUSTOMER_ROLES] } },
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Kunden", href: "/admin/kunden" },
          ...(company.parent ? [{ label: company.parent.name, href: `/admin/kunden/${company.parent.id}` }] : []),
          { label: company.name, href: `/admin/kunden/${company.id}` },
          { label: "Bearbeiten" },
        ]}
        title={`${company.name} bearbeiten`}
        description={isSub ? `Unterkunde von ${company.parent?.name}` : undefined}
      />

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader title="Stammdaten" />
          <CardBody>
            <CompanyEditForm
              isSub={isSub}
              parentName={company.parent?.name ?? null}
              locationOptions={options}
              company={{
                id: company.id,
                name: company.name,
                customerNumber: company.customerNumber,
                street: company.street,
                zip: company.zip,
                city: company.city,
                phone: company.phone,
                email: company.email,
                internalNote: company.internalNote,
                locationId: company.locationId,
                billingEmail: company.billingEmail,
                billingName: company.billingName,
                billingStreet: company.billingStreet,
                billingZip: company.billingZip,
                billingCity: company.billingCity,
                vatId: company.vatId,
                invoiceSeparately: company.invoiceSeparately,
              }}
            />
          </CardBody>
        </Card>

        {!isSub && company.slug ? (
          <Card id="adresse" className="scroll-mt-24">
            <CardHeader
              title="Adresse des Kundenportals"
              description={`Derzeit ${portalHost(company.slug)}. Nur ändern, wenn es wirklich nötig ist, z. B. nach einer Umfirmierung.`}
            />
            <CardBody>
              <SlugChangeForm
                companyId={company.id}
                currentSlug={company.slug}
                rootDomain={rootDomain()}
                activeUsers={activeUsers}
              />
            </CardBody>
          </Card>
        ) : null}

        <Card id="status" className="scroll-mt-24">
          <CardHeader
            title={company.active ? (isSub ? "Unterkunde sperren" : "Kunden sperren") : "Gesperrt"}
            description={
              company.active
                ? isSub
                  ? "Zum Beispiel, wenn der Standort geschlossen wurde."
                  : "Zum Beispiel bei Vertragsende. Daten bleiben vollständig erhalten."
                : isSub
                  ? "Diese Unterkunde ist deaktiviert."
                  : "Dieser Kunde ist deaktiviert, das Kundenportal ist gesperrt."
            }
          />
          <CardBody>
            <CompanyStatusForm
              companyId={company.id}
              name={company.name}
              active={company.active}
              isSub={isSub}
              userCount={activeUsers}
              parentInactive={company.parent ? !company.parent.active : false}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

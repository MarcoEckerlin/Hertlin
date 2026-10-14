import type { Metadata } from "next";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StaffCreate } from "@/components/admin/team/staff-form";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Person einladen" };

export default async function NewStaffPage() {
  await requireAdmin();
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Team", href: "/admin/team" }, { label: "Person einladen" }]}
        title="Person einladen"
        description="Neuer Zugang zur Verwaltung für jemanden aus dem Hertlin-Team."
      />
      <Card className="max-w-3xl">
        <CardBody className="sm:p-8">
          <StaffCreate />
        </CardBody>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { rootDomain } from "@/lib/hosts";
import { ensureSystemPages } from "@/cms/store";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewPageForm } from "@/components/admin/website/new-page-form";

export const metadata: Metadata = { title: "Neue Seite" };

export default async function NewWebsitePage() {
  await requireAdmin();
  await ensureSystemPages();
  const pages = await db.page.findMany({ select: { slug: true } });

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Website", href: "/admin/website" }, { label: "Neue Seite" }]}
        title="Neue Seite anlegen"
        description="Titel und Adresse festlegen – die Inhalte bearbeiten Sie im nächsten Schritt."
      />
      <Card className="max-w-2xl">
        <CardBody>
          <NewPageForm takenSlugs={pages.map((p) => p.slug)} siteHost={rootDomain()} />
        </CardBody>
      </Card>
    </>
  );
}

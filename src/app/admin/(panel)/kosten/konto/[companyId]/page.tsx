import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CostAccountView } from "@/components/admin/costs/cost-account-view";
import { cleanId } from "@/components/admin/companies/list-tools";
import { getStaffUser, requireAdmin } from "@/lib/auth";
import { costFilterParams, parseCostFilter, resolveCostAccount, withCostFilter } from "@/lib/costs";
import { db } from "@/lib/db";

export async function generateMetadata({ params }: { params: Promise<{ companyId: string }> }): Promise<Metadata> {
  const me = await getStaffUser();
  const companyId = cleanId((await params).companyId);
  const company =
    me?.role === "ADMIN" && companyId
      ? await db.company.findUnique({ where: { id: companyId }, select: { name: true } })
      : null;
  return { title: company ? `Kosten: ${company.name}` : "Kosten eines Kunden" };
}

export default async function CompanyCostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const companyId = cleanId((await params).companyId);
  if (!companyId) notFound();
  const filter = parseCostFilter(await searchParams);

  const resolved = await resolveCostAccount({ kind: "company", companyId });
  if (!resolved) {
    // Unterkunden-ID: Konto ist der Firmenkunde
    const sub = await db.company.findUnique({ where: { id: companyId }, select: { parentId: true } });
    if (sub?.parentId) redirect(withCostFilter(`/admin/kosten/konto/${sub.parentId}`, filter));
    notFound();
  }

  const exportHref = withCostFilter("/admin/kosten/export", filter, { konto: companyId });

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Kosten pro Konto", href: withCostFilter("/admin/kosten", filter) }, { label: resolved.label }]}
        title={<span className="break-words">{resolved.label}</span>}
        description={
          resolved.companyIds.length > 1
            ? `Firmenkunde mit ${resolved.companyIds.length - 1 === 1 ? "einer Unterkunde" : `${resolved.companyIds.length - 1} Unterkunden`}. Alle Positionen nach Ticket.`
            : "Firmenkunde. Alle Positionen nach Ticket."
        }
        meta={resolved.sublabel ? <span className="text-sm text-ink-muted">{resolved.sublabel}</span> : null}
        actions={
          <>
            <ButtonLink href={`/admin/kunden/${companyId}`} variant="ghost">
              Zum Kunden
            </ButtonLink>
            <a href={exportHref} className={buttonClasses("secondary")} download>
              <Download className="size-4" aria-hidden />
              CSV exportieren
            </a>
          </>
        }
      />
      <CostAccountView key={JSON.stringify(costFilterParams(filter))} resolved={resolved} filter={filter} />
    </div>
  );
}

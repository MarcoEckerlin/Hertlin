import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { CostAccountView } from "@/components/admin/costs/cost-account-view";
import { requireAdmin } from "@/lib/auth";
import {
  costAccountParams,
  costFilterParams,
  parseCostAccount,
  parseCostFilter,
  resolveCostAccount,
  withCostFilter,
} from "@/lib/costs";
import { formatTicketNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Kosten eines Privatkunden" };

export default async function PrivateCostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const filter = parseCostFilter(sp);
  const get = (key: string) => {
    const v = sp[key];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };

  const account = parseCostAccount(get);
  if (!account) notFound();
  if (account.kind === "company") redirect(withCostFilter(`/admin/kosten/konto/${account.companyId}`, filter));

  const resolved = await resolveCostAccount(account);
  if (!resolved) notFound();

  const exportHref = withCostFilter("/admin/kosten/export", filter, costAccountParams(account));

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Kosten pro Konto", href: withCostFilter("/admin/kosten", filter) }, { label: resolved.label }]}
        title={<span className="break-words">{resolved.label}</span>}
        description={
          account.kind === "private"
            ? "Privatkunde. Alle Tickets mit dieser E-Mail-Adresse, Positionen nach Ticket."
            : `Privatkunde ohne E-Mail-Adresse, nur Ticket ${formatTicketNumber(account.ticketId)}.`
        }
        meta={resolved.sublabel ? <span className="text-sm break-all text-ink-muted">{resolved.sublabel}</span> : null}
        actions={
          <a href={exportHref} className={buttonClasses("secondary")} download>
            <Download className="size-4" aria-hidden />
            CSV exportieren
          </a>
        }
      />
      <CostAccountView key={JSON.stringify(costFilterParams(filter))} resolved={resolved} filter={filter} />
    </div>
  );
}

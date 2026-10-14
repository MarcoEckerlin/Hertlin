import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatTicketNumber } from "@/lib/format";
import { canRecordCosts, canSeeCostAmounts } from "@/lib/permissions";
import { costBlockMessage, costEditBlock } from "@/lib/cost-catalog";
import { deleteCostAction } from "@/lib/actions/admin-costs";
import { LABOR_BILLING_HINT } from "@/config/pricing";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmitButton } from "@/components/admin/tickets/confirm-submit-button";
import { CostEditForm } from "@/components/admin/tickets/cost-edit-form";
import { costValuesFromEntry } from "@/components/admin/tickets/cost-values";
import { loadStaffOptions, parseTicketIdParam } from "@/components/admin/tickets/data";

export const metadata: Metadata = { title: "Position bearbeiten" };

type Params = Promise<{ id: string; costId: string }>;

const baseSelect = {
  id: true,
  kind: true,
  description: true,
  performedAt: true,
  quantityHundredths: true,
  unit: true,
  billed: true,
  invoiceId: true,
  createdById: true,
  performedById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
  ticket: { select: { id: true, subject: true } },
} as const;

/**
 * Position eines Tickets bearbeiten oder löschen.
 * Techniker: nur eigene, nicht abgerechnete Positionen und ohne Preise. Administratoren: alles außer
 * Positionen auf einer Rechnung. Preise werden für Techniker gar nicht erst geladen.
 */
export default async function EditCostPage({ params }: { params: Params }) {
  const user = await requireStaff();
  if (!canRecordCosts(user.role)) notFound();
  const isAdmin = canSeeCostAmounts(user.role);
  const { id, costId } = await params;

  const ticketId = parseTicketIdParam(id);
  if (!ticketId || !/^[A-Za-z0-9_-]{1,40}$/.test(costId)) notFound();

  const cost = await db.costEntry.findFirst({ where: { id: costId, ticketId }, select: baseSelect });
  if (!cost) notFound();
  // Preise und Abrechnung nur für Administratoren
  const adminData = isAdmin
    ? await db.costEntry.findUnique({
        where: { id: cost.id },
        select: { unitPriceCents: true, needsPrice: true, invoice: { select: { number: true } }, preset: { select: { name: true } } },
      })
    : null;

  const number = formatTicketNumber(cost.ticket.id);
  const ticketHref = `/admin/tickets/${cost.ticket.id}`;
  const block = costEditBlock(user, cost);

  const header = (
    <PageHeader
      breadcrumbs={[
        { label: "Tickets", href: "/admin/tickets" },
        { label: number, href: `${ticketHref}#kosten` },
        { label: "Position" },
      ]}
      title="Position bearbeiten"
      description={
        <>
          {number} · {cost.ticket.subject}
        </>
      }
    />
  );

  if (block) {
    return (
      <>
        {header}
        <div className="max-w-3xl space-y-6">
          <Alert tone="info" title={`${labelOf(COST_KIND_LABELS, cost.kind)}: ${cost.description}`}>
            {costBlockMessage(block, adminData?.invoice?.number)}
          </Alert>
          <ButtonLink href={`${ticketHref}#kosten`} variant="secondary">
            Zurück zum Ticket
          </ButtonLink>
        </div>
      </>
    );
  }

  const staff = await loadStaffOptions({ includeId: cost.performedById });

  return (
    <>
      {header}

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader
            title={cost.description}
            description={`Erfasst ${cost.createdBy ? `von ${cost.createdBy.name} ` : ""}am ${formatDateTime(cost.createdAt)}${
              cost.updatedAt.getTime() - cost.createdAt.getTime() > 1000 ? ` · zuletzt geändert ${formatDateTime(cost.updatedAt)}` : ""
            }`}
          />
          <CardBody>
            <CostEditForm
              ticketId={cost.ticket.id}
              costId={cost.id}
              initial={costValuesFromEntry(
                adminData ? { ...cost, unitPriceCents: adminData.unitPriceCents, needsPrice: adminData.needsPrice } : cost,
              )}
              staff={staff.map((s) => ({ id: s.id, name: s.name, active: s.active }))}
              currentUserId={user.id}
              canSetPrice={isAdmin}
              needsPrice={adminData?.needsPrice ?? false}
              catalogName={adminData?.preset?.name ?? null}
              laborHint={LABOR_BILLING_HINT}
              cancelHref={`${ticketHref}#kosten`}
            />
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white px-5 py-4 sm:px-6">
          <p className="text-sm text-ink-soft">Falsch erfasst? Die Position lässt sich vollständig löschen.</p>
          <form action={deleteCostAction.bind(null, cost.ticket.id, cost.id)}>
            <ConfirmSubmitButton
              variant="danger"
              size="sm"
              pendingText="Wird gelöscht …"
              confirmText={`Position „${cost.description}“ wirklich löschen? Das lässt sich nicht rückgängig machen.`}
            >
              Position löschen
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}

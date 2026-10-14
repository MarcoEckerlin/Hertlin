import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatTicketNumber } from "@/lib/format";
import { deleteCostAction } from "@/lib/actions/admin-costs";
import { COST_DEFAULTS, LABOR_BILLING_HINT } from "@/config/pricing";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmSubmitButton } from "@/components/admin/tickets/confirm-submit-button";
import { CostForm } from "@/components/admin/tickets/cost-form";
import { costValuesFromEntry } from "@/components/admin/tickets/cost-values";
import { parseTicketIdParam } from "@/components/admin/tickets/data";

export const metadata: Metadata = { title: "Kostenposition bearbeiten" };

type Params = Promise<{ id: string; costId: string }>;

/** Kostenposition eines Tickets bearbeiten oder löschen – nur für Administratoren. */
export default async function EditCostPage({ params }: { params: Params }) {
  await requireAdmin();
  const { id, costId } = await params;

  const ticketId = parseTicketIdParam(id);
  if (!ticketId || !/^[A-Za-z0-9_-]{1,40}$/.test(costId)) notFound();

  const cost = await db.costEntry.findFirst({
    where: { id: costId, ticketId },
    select: {
      id: true,
      kind: true,
      description: true,
      performedAt: true,
      quantityHundredths: true,
      unit: true,
      unitPriceCents: true,
      billed: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { name: true } },
      ticket: { select: { id: true, subject: true } },
    },
  });
  if (!cost) notFound();

  const number = formatTicketNumber(cost.ticket.id);
  const ticketHref = `/admin/tickets/${cost.ticket.id}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Tickets", href: "/admin/tickets" },
          { label: number, href: ticketHref },
          { label: "Kostenposition" },
        ]}
        title="Kostenposition bearbeiten"
        description={
          <>
            {number} · {cost.ticket.subject}
          </>
        }
      />

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader
            title={cost.description}
            description={`Erfasst ${cost.createdBy ? `von ${cost.createdBy.name} ` : ""}am ${formatDateTime(cost.createdAt)}${
              cost.updatedAt.getTime() - cost.createdAt.getTime() > 1000 ? ` · zuletzt geändert ${formatDateTime(cost.updatedAt)}` : ""
            }`}
          />
          <CardBody>
            <CostForm
              mode="edit"
              ticketId={cost.ticket.id}
              costId={cost.id}
              initial={costValuesFromEntry(cost)}
              defaults={COST_DEFAULTS}
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

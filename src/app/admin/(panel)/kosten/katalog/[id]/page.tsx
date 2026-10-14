import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, type ReactNode } from "react";
import { db } from "@/lib/db";
import { getStaffUser, requireAdmin } from "@/lib/auth";
import { COST_KIND_LABELS, labelOf } from "@/lib/constants";
import { centsToInput, formatDate, formatDateTime } from "@/lib/format";
import { quantityToInput } from "@/lib/cost-catalog";
import { deletePresetAction } from "@/lib/actions/admin-cost-catalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogForm } from "@/components/admin/costs/catalog-form";
import { ConfirmSubmitButton } from "@/components/admin/tickets/confirm-submit-button";

type Params = Promise<{ id: string }>;

const loadPreset = cache(async (id: string) =>
  /^[A-Za-z0-9_-]{1,40}$/.test(id)
    ? db.costPreset.findUnique({
        where: { id },
        select: {
          id: true,
          kind: true,
          name: true,
          unit: true,
          unitPriceCents: true,
          defaultQuantityHundredths: true,
          active: true,
          usageCount: true,
          lastUsedAt: true,
          createdAt: true,
          createdBy: { select: { name: true } },
          _count: { select: { entries: true } },
        },
      })
    : null,
);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const staff = await getStaffUser();
  const { id } = await params;
  const preset = staff?.role === "ADMIN" ? await loadPreset(id) : null;
  return { title: preset ? `${preset.name} – Kostenkatalog` : "Kostenkatalog" };
}

/** Eintrag im Kostenkatalog bearbeiten, deaktivieren oder (nie benutzt) löschen – nur für Administratoren. */
export default async function CatalogEntryPage({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;
  const preset = await loadPreset(id);
  if (!preset) notFound();

  const used = preset.usageCount > 0 || preset._count.entries > 0;
  const uses = Math.max(preset.usageCount, preset._count.entries);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Kostenkatalog", href: "/admin/kosten/katalog" }, { label: preset.name }]}
        title={<span className="break-words">{preset.name}</span>}
        meta={
          <>
            <Badge tone="blue">{labelOf(COST_KIND_LABELS, preset.kind)}</Badge>
            {preset.active ? <Badge tone="green">aktiv</Badge> : <Badge tone="gray">deaktiviert</Badge>}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Card className="min-w-0">
          <CardBody className="sm:px-8 sm:py-7">
            <CatalogForm
              presetId={preset.id}
              initial={{
                name: preset.name,
                kind: preset.kind,
                unit: preset.unit,
                unitPrice: preset.unitPriceCents === null ? "" : centsToInput(preset.unitPriceCents),
                defaultQuantity: quantityToInput(preset.defaultQuantityHundredths),
                active: preset.active,
              }}
            />
          </CardBody>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Verwendung" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-1">
                <Detail label="Benutzt">
                  {uses === 0 ? "noch nie" : uses === 1 ? "1-mal" : `${uses}-mal`}
                </Detail>
                {preset.lastUsedAt ? <Detail label="Zuletzt benutzt">{formatDate(preset.lastUsedAt)}</Detail> : null}
                <Detail label="Angelegt">
                  {formatDateTime(preset.createdAt)}
                  {preset.createdBy ? ` von ${preset.createdBy.name}` : ""}
                </Detail>
              </dl>
            </CardBody>
          </Card>

          {used ? (
            <p className="rounded-2xl border border-line bg-mist px-5 py-4 text-sm text-ink-soft">
              Der Eintrag wurde schon benutzt und lässt sich deshalb nicht löschen. Wird er nicht mehr gebraucht, nehmen Sie das
              Häkchen bei „Aktiv“ heraus.
            </p>
          ) : (
            <div className="rounded-2xl border border-danger-line bg-surface px-5 py-4">
              <p className="mb-3 text-sm text-ink-soft">Noch nie benutzt – der Eintrag lässt sich vollständig löschen.</p>
              <form action={deletePresetAction.bind(null, preset.id)}>
                <ConfirmSubmitButton
                  variant="danger"
                  size="sm"
                  pendingText="Wird gelöscht …"
                  confirmText={`„${preset.name}“ aus dem Katalog löschen?`}
                >
                  Eintrag löschen
                </ConfirmSubmitButton>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{children}</dd>
    </div>
  );
}

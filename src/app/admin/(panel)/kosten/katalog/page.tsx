import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { cleanName } from "@/lib/cost-catalog";
import { Alert } from "@/components/ui/alert";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { CatalogList, type CatalogRow } from "@/components/admin/costs/catalog-list";

export const metadata: Metadata = { title: "Kostenkatalog" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_FILTERS = { alle: "Alle", aktiv: "Nur aktive", deaktiviert: "Nur deaktivierte" } as const;
type StatusFilter = keyof typeof STATUS_FILTERS;

const FLASH: Record<string, { tone: "success" | "warning"; text: string }> = {
  angelegt: { tone: "success", text: "Der Eintrag steht jetzt im Katalog." },
  gespeichert: { tone: "success", text: "Die Änderungen sind gespeichert." },
  geloescht: { tone: "success", text: "Der Eintrag ist gelöscht." },
  benutzt: { tone: "warning", text: "Dieser Eintrag wurde schon benutzt und lässt sich nicht löschen. Deaktivieren Sie ihn stattdessen." },
};

function first(value: string | string[] | undefined): string {
  return ((Array.isArray(value) ? value[0] : value) ?? "").trim();
}

/** Kostenkatalog: Standardpositionen für die Erfassung im Ticket – nur für Administratoren. */
export default async function CostCatalogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const search = cleanName(first(params.suche)).slice(0, 100);
  const statusParam = first(params.status);
  const status: StatusFilter = statusParam in STATUS_FILTERS ? (statusParam as StatusFilter) : "alle";
  const flash = FLASH[first(params.katalog)];

  const where: Prisma.CostPresetWhereInput = {
    ...(status === "aktiv" ? { active: true } : status === "deaktiviert" ? { active: false } : {}),
    // SQLite vergleicht mit contains ohne Rücksicht auf Groß-/Kleinschreibung (nur ASCII); nameKey ist kleingeschrieben
    ...(search ? { OR: [{ name: { contains: search } }, { nameKey: { contains: search.toLocaleLowerCase("de-DE") } }] } : {}),
  };

  const [presets, total, inactive] = await Promise.all([
    db.costPreset.findMany({
      where,
      orderBy: [{ active: "desc" }, { name: "asc" }],
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
        createdBy: { select: { name: true } },
        _count: { select: { entries: true } },
      },
    }),
    db.costPreset.count(),
    db.costPreset.count({ where: { active: false } }),
  ]);

  const rows: CatalogRow[] = presets.map((p) => ({
    id: p.id,
    kind: p.kind,
    name: p.name,
    unit: p.unit,
    unitPriceCents: p.unitPriceCents,
    defaultQuantityHundredths: p.defaultQuantityHundredths,
    active: p.active,
    usageCount: p.usageCount,
    lastUsedAt: p.lastUsedAt,
    entryCount: p._count.entries,
    createdByName: p.createdBy?.name ?? null,
  }));
  const filtered = Boolean(search) || status !== "alle";

  return (
    <div>
      <PageHeader
        title="Kostenkatalog"
        description="Standardpositionen für Arbeitszeit, Anfahrt, Material und Pauschalen, aus denen Mitarbeiter im Ticket auswählen. Neue Positionen aus Tickets landen automatisch hier."
        meta={
          total > 0 ? (
            <span className="text-sm text-ink-muted">
              {total === 1 ? "1 Eintrag" : `${total} Einträge`}
              {inactive > 0 ? ` · ${inactive} deaktiviert` : ""}
            </span>
          ) : null
        }
        actions={
          <ButtonLink href="/admin/kosten/katalog/neu">
            <Plus className="size-4" aria-hidden />
            Position anlegen
          </ButtonLink>
        }
      />

      <div className="space-y-6">
        {flash ? <Alert tone={flash.tone}>{flash.text}</Alert> : null}

        {total > 0 ? (
          <form
            role="search"
            aria-label="Katalog durchsuchen"
            action="/admin/kosten/katalog"
            className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label htmlFor="katalog-suche" className="mb-1.5 block text-sm font-semibold text-ink">
                Suche
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <Input
                  id="katalog-suche"
                  type="search"
                  name="suche"
                  defaultValue={search}
                  placeholder="Bezeichnung, z. B. Anfahrt"
                  className="h-10 pl-9 text-sm"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <label htmlFor="katalog-status" className="mb-1.5 block text-sm font-semibold text-ink">
                Status
              </label>
              <Select id="katalog-status" name="status" defaultValue={status} className="h-10 text-sm">
                {Object.entries(STATUS_FILTERS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className={buttonClasses("secondary")}>
                Anzeigen
              </button>
              {filtered ? (
                <Link href="/admin/kosten/katalog" className={buttonClasses("ghost")}>
                  Zurücksetzen
                </Link>
              ) : null}
            </div>
          </form>
        ) : null}

        {total === 0 ? (
          <EmptyState
            title="Der Katalog ist noch leer"
            action={
              <ButtonLink href="/admin/kosten/katalog/neu">
                <Plus className="size-4" aria-hidden />
                Position anlegen
              </ButtonLink>
            }
          >
            Legen Sie hier Ihre üblichen Positionen an, z. B. „Arbeitszeit Technik“ oder „Anfahrt Stadtgebiet“. Neue Positionen aus
            Tickets landen automatisch hier.
          </EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nichts gefunden"
            action={
              <ButtonLink href="/admin/kosten/katalog" variant="secondary">
                Alle Einträge anzeigen
              </ButtonLink>
            }
          >
            {search ? `Kein Eintrag passt zu „${search}“.` : "Für diese Auswahl gibt es keine Einträge."}
          </EmptyState>
        ) : (
          <CatalogList rows={rows} />
        )}
      </div>
    </div>
  );
}

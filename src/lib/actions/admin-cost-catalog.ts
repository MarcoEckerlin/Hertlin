"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { COST_KINDS, COST_UNITS } from "@/lib/constants";
import { errorState, fromZodError, type FormState } from "@/lib/forms";
import { checkbox, requiredText } from "@/lib/validation";
import { PRESET_NAME_MAX, cleanName, parsePriceField, parseQuantityField, presetNameKey } from "@/lib/cost-catalog";

/**
 * Kostenkatalog (/admin/kosten/katalog) – nur für Administratoren.
 * Einträge entstehen hier oder automatisch beim Erfassen im Ticket („In den Katalog aufnehmen“).
 * Löschen geht nur, solange ein Eintrag nie benutzt wurde; sonst deaktivieren.
 */

const LIST = "/admin/kosten/katalog";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value);
}

function revalidateCatalog(): void {
  // Katalog und die Auswahl in allen Tickets
  revalidatePath("/admin", "layout");
}

const presetSchema = z.object({
  name: requiredText("eine Bezeichnung", PRESET_NAME_MAX),
  kind: z.enum(COST_KINDS, { error: "Bitte die Art auswählen." }),
  unit: z.enum(COST_UNITS, { error: "Bitte eine Einheit aus der Liste wählen." }),
  active: checkbox,
});

type PresetInput = {
  name: string;
  nameKey: string;
  kind: string;
  unit: string;
  unitPriceCents: number | null;
  defaultQuantityHundredths: number;
  active: boolean;
};

/** Felder prüfen. Preis leer = „wird je Position festgelegt“. */
async function parsePresetForm(
  formData: FormData,
  ownId: string | null,
): Promise<{ ok: true; data: PresetInput } | { ok: false; state: FormState }> {
  const parsed = presetSchema.safeParse({
    name: text(formData, "name"),
    kind: text(formData, "kind"),
    unit: text(formData, "unit"),
    active: ownId ? formData.get("active") : "on",
  });
  const fieldErrors: Record<string, string> = parsed.success ? {} : (fromZodError(parsed.error).fieldErrors ?? {});

  const price = parsePriceField(text(formData, "unitPrice"), { required: false });
  if (!price.ok) fieldErrors.unitPrice = price.error;
  const quantity = parseQuantityField(text(formData, "defaultQuantity"));
  if (!quantity.ok) fieldErrors.defaultQuantity = quantity.error;

  let nameKey = "";
  if (parsed.success) {
    nameKey = presetNameKey(parsed.data.name);
    const duplicate = await db.costPreset.findUnique({ where: { nameKey }, select: { id: true, name: true, active: true } });
    if (duplicate && duplicate.id !== ownId) {
      fieldErrors.name = duplicate.active
        ? `„${duplicate.name}“ steht schon im Katalog.`
        : `„${duplicate.name}“ steht schon im Katalog (deaktiviert). Aktivieren Sie den Eintrag statt eines neuen.`;
    }
  }

  if (!parsed.success || !price.ok || !quantity.ok || Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors) };
  }
  return {
    ok: true,
    data: {
      name: cleanName(parsed.data.name),
      nameKey,
      kind: parsed.data.kind,
      unit: parsed.data.unit,
      unitPriceCents: price.value,
      defaultQuantityHundredths: quantity.value as number,
      active: parsed.data.active,
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createPresetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const result = await parsePresetForm(formData, null);
  if (!result.ok) return result.state;
  const data = result.data;

  try {
    await db.costPreset.create({
      data: {
        kind: data.kind,
        name: data.name,
        nameKey: data.nameKey,
        unit: data.unit,
        unitPriceCents: data.unitPriceCents,
        defaultQuantityHundredths: data.defaultQuantityHundredths,
        active: true,
        createdById: admin.id,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, { name: `„${data.name}“ steht schon im Katalog.` });
    }
    console.error("[katalog] Eintrag konnte nicht angelegt werden:", error instanceof Error ? error.message : error);
    return errorState("Der Eintrag konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  revalidateCatalog();
  redirect(`${LIST}?katalog=angelegt`);
}

export async function updatePresetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = text(formData, "presetId");
  const preset = isId(id) ? await db.costPreset.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!preset) return errorState("Diesen Eintrag gibt es nicht mehr. Vielleicht wurde er inzwischen gelöscht.");

  const result = await parsePresetForm(formData, preset.id);
  if (!result.ok) return result.state;
  const data = result.data;

  try {
    await db.costPreset.update({
      where: { id: preset.id },
      data: {
        kind: data.kind,
        name: data.name,
        nameKey: data.nameKey,
        unit: data.unit,
        unitPriceCents: data.unitPriceCents,
        defaultQuantityHundredths: data.defaultQuantityHundredths,
        active: data.active,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return errorState("Bitte prüfen Sie die markierten Felder.", formData, { name: `„${data.name}“ steht schon im Katalog.` });
    }
    console.error("[katalog] Eintrag konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState("Die Änderung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  revalidateCatalog();
  redirect(`${LIST}?katalog=gespeichert`);
}

/** Aktivieren/Deaktivieren aus der Liste: <form action={togglePresetActiveAction.bind(null, id)}> */
export async function togglePresetActiveAction(presetId: string): Promise<void> {
  await requireAdmin();
  if (!isId(presetId)) return;
  const preset = await db.costPreset.findUnique({ where: { id: presetId }, select: { id: true, active: true } });
  if (!preset) return;
  await db.costPreset.update({ where: { id: preset.id }, data: { active: !preset.active } });
  revalidateCatalog();
}

/** Löschen nur, wenn der Eintrag nie benutzt wurde. */
export async function deletePresetAction(presetId: string): Promise<void> {
  await requireAdmin();
  if (!isId(presetId)) redirect(LIST);
  const preset = await db.costPreset.findUnique({
    where: { id: presetId },
    select: { id: true, usageCount: true, _count: { select: { entries: true } } },
  });
  if (!preset) redirect(LIST);
  if (preset.usageCount > 0 || preset._count.entries > 0) redirect(`${LIST}?katalog=benutzt`);

  await db.costPreset.delete({ where: { id: preset.id } });
  revalidateCatalog();
  redirect(`${LIST}?katalog=geloescht`);
}

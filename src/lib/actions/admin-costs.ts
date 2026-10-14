"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireStaff, type SessionUser } from "@/lib/auth";
import { COST_KINDS, COST_KIND_LABELS, COST_UNITS, STAFF_ROLES } from "@/lib/constants";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { formatMoney, lineTotalCents } from "@/lib/format";
import { canRecordCosts, canSeeCostAmounts } from "@/lib/permissions";
import { checkbox, requiredText } from "@/lib/validation";
import {
  COST_DESCRIPTION_MAX,
  COST_NOTE_MAX,
  PRESET_NAME_MAX,
  cleanName,
  composeCostDescription,
  costBlockMessage,
  costEditBlock,
  formatQuantityWithUnit,
  parsePriceField,
  parseQuantityField,
  presetNameKey,
  resolveUnitPrice,
  toCostKind,
} from "@/lib/cost-catalog";
import { parseTicketIdParam } from "@/components/admin/tickets/data";

/**
 * Leistungen und Material im Ticket (Kostenpositionen).
 *
 * - Erfassen: Administratoren und Techniker (canRecordCosts). Techniker können keinen Preis setzen –
 *   der kommt aus dem Katalog, sonst bleibt die Position „Preis fehlt“, bis die Verwaltung ihn einträgt.
 * - Ändern/Löschen: Techniker nur eigene, nicht abgerechnete Positionen; Administratoren alles außer
 *   Positionen auf einer Rechnung (siehe costEditBlock in @/lib/cost-catalog).
 * - Preise, „abgerechnet“ umschalten: nur Administratoren.
 *
 * Jede Action prüft zuerst die Anmeldung und danach, dass Ticket und Position zusammengehören.
 * Beträge werden immer hier auf dem Server berechnet. Rückmeldungen an Techniker nennen keine Beträge.
 */

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateCosts(): void {
  // Ticketdetail, Ticketliste, Übersicht, Kosten pro Konto und Katalog
  revalidatePath("/admin", "layout");
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value);
}

async function requireCostRecorder(): Promise<SessionUser> {
  const user = await requireStaff();
  // Heute dürfen alle Mitarbeiter erfassen; die Prüfung bleibt, falls Rollen dazukommen
  if (!canRecordCosts(user.role)) redirect("/admin?hinweis=kein-zugriff");
  return user;
}

async function findTicket(rawTicketId: unknown) {
  const ticketId = parseTicketIdParam(rawTicketId);
  if (!ticketId) return null;
  return db.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
}

/** Position nur, wenn sie zum angegebenen Ticket gehört. */
async function findCost(ticketId: number, costId: unknown) {
  if (!isId(costId)) return null;
  return db.costEntry.findFirst({
    where: { id: costId, ticketId },
    select: {
      id: true,
      kind: true,
      description: true,
      unit: true,
      quantityHundredths: true,
      unitPriceCents: true,
      needsPrice: true,
      billed: true,
      billedAt: true,
      invoiceId: true,
      invoice: { select: { number: true } },
      createdById: true,
      performedById: true,
      presetId: true,
      preset: { select: { id: true, unit: true, unitPriceCents: true, active: true } },
    },
  });
}

/** „Erbracht von“: aktive Mitarbeiter; ein bereits eingetragener (inzwischen deaktivierter) darf bleiben. */
async function resolvePerformer(raw: string, fallbackId: string, keepId?: string | null): Promise<string | null> {
  const id = raw.trim() || fallbackId;
  if (!isId(id)) return null;
  if (keepId && id === keepId) return id;
  const user = await db.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] }, active: true }, select: { id: true } });
  return user?.id ?? null;
}

const dateField = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein Datum angeben.")
  .refine((v) => !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()), "Bitte ein gültiges Datum angeben.");

function toPerformedAt(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

const optionalNote = z.string().trim().max(COST_NOTE_MAX, `Höchstens ${COST_NOTE_MAX} Zeichen.`);

const newPositionSchema = z.object({
  description: requiredText("eine Bezeichnung", PRESET_NAME_MAX),
  kind: z.enum(COST_KINDS, { error: "Bitte die Art auswählen." }),
  unit: z.enum(COST_UNITS, { error: "Bitte eine Einheit aus der Liste wählen." }),
  addToCatalog: checkbox,
});

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Kurzbeschreibung für Rückmeldungen ohne Beträge: „Anfahrt Stadtgebiet (1 Pauschale)“ */
function entryLabel(description: string, quantityHundredths: number, unit: string): string {
  const short = description.length > 80 ? `${description.slice(0, 77)} …` : description;
  return `„${short}“ (${formatQuantityWithUnit(quantityHundredths, unit)})`;
}

/* ------------------------------------------------------------------ */
/* Position erfassen                                                   */
/* ------------------------------------------------------------------ */

type CatalogPreset = { id: string; kind: string; name: string; unit: string; unitPriceCents: number | null };

/**
 * Neue Position im Ticket – aus dem Katalog (mode=katalog, presetId + Notiz) oder frei (mode=neu).
 * Freie Positionen landen auf Wunsch (Standard) im Katalog; gibt es die Bezeichnung dort schon,
 * wird der bestehende Eintrag verwendet.
 */
export async function addCostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCostRecorder();
  const isAdmin = canSeeCostAmounts(user.role);

  const ticket = await findTicket(text(formData, "ticketId"));
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const mode = text(formData, "mode") === "neu" ? "neu" : "katalog";
  const fieldErrors: Record<string, string> = {};

  const date = dateField.safeParse(text(formData, "performedAt"));
  if (!date.success) fieldErrors.performedAt = date.error.issues[0]?.message ?? "Bitte ein Datum angeben.";

  const quantity = parseQuantityField(text(formData, "quantity"));
  if (!quantity.ok) fieldErrors.quantity = quantity.error;

  // Preis nur von Administratoren – bei Technikern wird das Feld ignoriert, selbst wenn es mitgeschickt wird
  const price = isAdmin ? parsePriceField(text(formData, "unitPrice"), { required: false }) : { ok: true as const, value: null };
  if (!price.ok) fieldErrors.unitPrice = price.error;

  const performerId = await resolvePerformer(text(formData, "performedById"), user.id);
  if (!performerId) fieldErrors.performedById = "Bitte einen aktiven Mitarbeiter auswählen.";

  let kind: (typeof COST_KINDS)[number] = "LABOR";
  let unit = "";
  let description = "";
  let preset: CatalogPreset | null = null;
  /** Neue Position mit dem Namen eines deaktivierten Katalogeintrags: verknüpfen, aber dessen Preis nicht übernehmen */
  let presetInactive = false;
  let createPreset: { name: string; nameKey: string } | null = null;

  if (mode === "katalog") {
    const presetId = text(formData, "presetId");
    preset = isId(presetId)
      ? await db.costPreset.findFirst({
          where: { id: presetId, active: true },
          select: { id: true, kind: true, name: true, unit: true, unitPriceCents: true },
        })
      : null;
    if (!preset) {
      fieldErrors.presetId = presetId
        ? "Diese Position gibt es im Katalog nicht mehr. Bitte wählen Sie eine andere."
        : "Bitte eine Position aus dem Katalog auswählen.";
    }
    const note = optionalNote.safeParse(text(formData, "note"));
    if (!note.success) fieldErrors.note = note.error.issues[0]?.message ?? "Die Notiz ist zu lang.";
    if (preset && note.success) {
      kind = toCostKind(preset.kind);
      unit = preset.unit;
      description = composeCostDescription(preset.name, note.data).slice(0, COST_DESCRIPTION_MAX);
    }
  } else {
    const parsed = newPositionSchema.safeParse({
      description: text(formData, "description"),
      kind: text(formData, "kind"),
      unit: text(formData, "unit"),
      addToCatalog: formData.get("addToCatalog"),
    });
    if (!parsed.success) Object.assign(fieldErrors, fromZodError(parsed.error).fieldErrors);
    else {
      kind = parsed.data.kind;
      unit = parsed.data.unit;
      description = cleanName(parsed.data.description);
      const nameKey = presetNameKey(description);
      // Gibt es die Bezeichnung schon im Katalog, wird dieser Eintrag verwendet (auch ohne Häkchen)
      const found = await db.costPreset.findUnique({
        where: { nameKey },
        select: { id: true, kind: true, name: true, unit: true, unitPriceCents: true, active: true },
      });
      if (found) {
        const { active, ...rest } = found;
        preset = rest;
        presetInactive = !active;
      }
      if (!preset && parsed.data.addToCatalog) createPreset = { name: description, nameKey };
    }
  }

  if (Object.keys(fieldErrors).length > 0 || !date.success || !quantity.ok || !price.ok || !performerId) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors);
  }

  const quantityHundredths = quantity.value as number;
  // Ein deaktivierter Katalogeintrag hat keinen gültigen Preis mehr: Techniker-Positionen bekommen „Preis fehlt“
  const resolved = resolveUnitPrice({ canSetPrice: isAdmin, inputCents: price.value, preset: presetInactive ? null : preset, unit });
  const totalCents = lineTotalCents(quantityHundredths, resolved.unitPriceCents);
  const now = new Date();

  let createdPreset = false;
  try {
    await db.$transaction(async (tx) => {
      let presetId = preset?.id ?? null;
      if (createPreset) {
        try {
          const created = await tx.costPreset.create({
            data: {
              kind,
              name: createPreset.name,
              nameKey: createPreset.nameKey,
              unit,
              // Preis des Administrators wird Katalogpreis; Techniker legen Einträge ohne Preis an
              unitPriceCents: isAdmin ? price.value : null,
              defaultQuantityHundredths: 100,
              usageCount: 1,
              lastUsedAt: now,
              createdById: user.id,
            },
            select: { id: true },
          });
          presetId = created.id;
          createdPreset = true;
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
          // Gleichzeitig von jemand anderem angelegt: diesen Eintrag verwenden
          const existing = await tx.costPreset.findUnique({ where: { nameKey: createPreset.nameKey }, select: { id: true } });
          presetId = existing?.id ?? null;
        }
      }
      if (presetId && !createdPreset && !presetInactive) {
        await tx.costPreset.update({ where: { id: presetId }, data: { usageCount: { increment: 1 }, lastUsedAt: now } });
      }
      await tx.costEntry.create({
        data: {
          ticketId: ticket.id,
          kind,
          description,
          quantityHundredths,
          unit,
          unitPriceCents: resolved.unitPriceCents,
          totalCents,
          needsPrice: resolved.needsPrice,
          performedAt: toPerformedAt(date.data),
          createdById: user.id,
          performedById: performerId,
          presetId,
        },
      });
    });
  } catch (error) {
    console.error("[kosten] Position konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState("Die Position konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  revalidateCosts();

  const catalogNote = createdPreset ? " Sie steht ab jetzt auch im Katalog." : "";
  if (!isAdmin) {
    return successState(`Hinzugefügt: ${entryLabel(description, quantityHundredths, unit)}.${catalogNote}`);
  }
  if (resolved.needsPrice) {
    return successState(`${COST_KIND_LABELS[kind]} hinzugefügt – der Preis fehlt noch.${catalogNote}`);
  }
  return successState(`${COST_KIND_LABELS[kind]} über ${formatMoney(totalCents)} hinzugefügt.${catalogNote}`);
}

/* ------------------------------------------------------------------ */
/* Position bearbeiten (/admin/tickets/[id]/kosten/[costId])           */
/* ------------------------------------------------------------------ */

const editSchema = z.object({
  kind: z.enum(COST_KINDS, { error: "Bitte die Art auswählen." }),
  description: requiredText("eine Beschreibung", COST_DESCRIPTION_MAX),
  performedAt: dateField,
  unit: z.enum(COST_UNITS, { error: "Bitte eine Einheit aus der Liste wählen." }),
  billed: checkbox,
  savePriceToCatalog: checkbox,
});

export async function updateCostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireCostRecorder();
  const isAdmin = canSeeCostAmounts(user.role);

  const ticket = await findTicket(text(formData, "ticketId"));
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr.");
  const cost = await findCost(ticket.id, text(formData, "costId"));
  if (!cost) return errorState("Diese Position gibt es nicht mehr. Vielleicht wurde sie inzwischen gelöscht.");

  const block = costEditBlock(user, cost);
  if (block) return errorState(costBlockMessage(block, cost.invoice?.number));

  const parsed = editSchema.safeParse({
    kind: text(formData, "kind"),
    description: text(formData, "description"),
    performedAt: text(formData, "performedAt"),
    unit: text(formData, "unit"),
    billed: formData.get("billed"),
    savePriceToCatalog: formData.get("savePriceToCatalog"),
  });
  const fieldErrors: Record<string, string> = parsed.success ? {} : (fromZodError(parsed.error).fieldErrors ?? {});

  const quantity = parseQuantityField(text(formData, "quantity"));
  if (!quantity.ok) fieldErrors.quantity = quantity.error;

  const price = isAdmin ? parsePriceField(text(formData, "unitPrice"), { required: false }) : { ok: true as const, value: null };
  if (!price.ok) fieldErrors.unitPrice = price.error;

  const performerId = await resolvePerformer(text(formData, "performedById"), cost.performedById ?? user.id, cost.performedById);
  if (!performerId) fieldErrors.performedById = "Bitte einen aktiven Mitarbeiter auswählen.";

  if (!parsed.success || !quantity.ok || !price.ok || !performerId || Object.keys(fieldErrors).length > 0) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors);
  }
  const data = parsed.data;
  const quantityHundredths = quantity.value as number;

  // Preis: Administratoren setzen ihn (leer = steht noch nicht fest). Techniker ändern ihn nie –
  // nur wenn sie die Einheit ändern, passt der alte Preis nicht mehr: dann Katalogpreis oder „Preis fehlt“.
  let unitPriceCents = cost.unitPriceCents;
  let needsPrice = cost.needsPrice;
  if (isAdmin) {
    const resolved = resolveUnitPrice({ canSetPrice: true, inputCents: price.value, preset: cost.preset, unit: data.unit });
    unitPriceCents = resolved.unitPriceCents;
    needsPrice = resolved.needsPrice;
  } else if (data.unit !== cost.unit) {
    const resolved = resolveUnitPrice({
      canSetPrice: false,
      inputCents: null,
      preset: cost.preset?.active ? cost.preset : null,
      unit: data.unit,
    });
    unitPriceCents = resolved.unitPriceCents;
    needsPrice = resolved.needsPrice;
  }

  // „Abgerechnet“ setzen nur Administratoren, und nur mit Preis
  const billed = isAdmin ? data.billed : cost.billed;
  if (billed && needsPrice) {
    return errorState("Bitte prüfen Sie die markierten Felder.", formData, {
      billed: "Ohne Preis kann die Position nicht als abgerechnet gelten. Tragen Sie zuerst den Preis ein.",
    });
  }

  const savePrice = isAdmin && data.savePriceToCatalog && !needsPrice && cost.preset !== null && cost.preset.unit === data.unit;
  // Häkchen „auch im Katalog“ gesetzt, aber die Einheit weicht ab: Katalog bleibt, das wird gemeldet
  const catalogSkipped = isAdmin && data.savePriceToCatalog && !needsPrice && cost.preset !== null && cost.preset.unit !== data.unit;

  let locked = false;
  try {
    await db.$transaction(async (tx) => {
      // Nur ändern, solange die Position auf keiner Rechnung steht (eine Rechnung kann gerade erstellt worden sein)
      const changed = await tx.costEntry.updateMany({
        where: { id: cost.id, invoiceId: null, ...(isAdmin ? {} : { billed: false, createdById: user.id }) },
        data: {
          kind: data.kind,
          description: cleanName(data.description),
          quantityHundredths,
          unit: data.unit,
          unitPriceCents,
          totalCents: lineTotalCents(quantityHundredths, unitPriceCents),
          needsPrice,
          performedAt: toPerformedAt(data.performedAt),
          performedById: performerId,
          billed,
          // Abrechnungsdatum bleibt erhalten, solange die Position abgerechnet bleibt
          billedAt: billed ? (cost.billedAt ?? new Date()) : null,
        },
      });
      if (changed.count !== 1) {
        locked = true;
        return;
      }
      if (savePrice && cost.preset) {
        await tx.costPreset.update({ where: { id: cost.preset.id }, data: { unitPriceCents } });
      }
    });
  } catch (error) {
    console.error("[kosten] Position konnte nicht geändert werden:", error instanceof Error ? error.message : error);
    return errorState("Die Änderung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  revalidateCosts();
  if (locked) redirect(`/admin/tickets/${ticket.id}?kosten=gesperrt#kosten`);
  redirect(`/admin/tickets/${ticket.id}?kosten=${catalogSkipped ? "preis-einheit" : "gespeichert"}#kosten`);
}

/* ------------------------------------------------------------------ */
/* Fehlenden Preis nachtragen (nur Administratoren)                    */
/* ------------------------------------------------------------------ */

export async function setCostPriceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const ticket = await findTicket(text(formData, "ticketId"));
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr.");
  const cost = await findCost(ticket.id, text(formData, "costId"));
  if (!cost) return errorState("Diese Position gibt es nicht mehr. Vielleicht wurde sie inzwischen gelöscht.");
  if (cost.invoiceId) return errorState(costBlockMessage("invoice", cost.invoice?.number));

  const price = parsePriceField(text(formData, "unitPrice"), { required: true });
  if (!price.ok || price.value === null) {
    return errorState("Bitte prüfen Sie den Preis.", formData, { unitPrice: price.ok ? "Bitte einen Einzelpreis angeben." : price.error });
  }
  const unitPriceCents = price.value;
  const saveToCatalog = checkbox.safeParse(formData.get("saveToCatalog")).data === true;
  const totalCents = lineTotalCents(cost.quantityHundredths, unitPriceCents);

  // Rückmeldung nach dem Speichern (Query-Parameter „kosten“ im Ticket)
  let flash: "preis" | "preis-katalog" | "preis-einheit" = "preis";
  try {
    await db.$transaction(async (tx) => {
      let presetId = cost.presetId;
      if (saveToCatalog) {
        if (cost.preset) {
          if (cost.preset.unit !== cost.unit) {
            flash = "preis-einheit";
          } else {
            await tx.costPreset.update({ where: { id: cost.preset.id }, data: { unitPriceCents } });
            flash = "preis-katalog";
          }
        } else {
          // Position ohne Katalogeintrag: mit diesem Preis in den Katalog aufnehmen (oder vorhandenen Eintrag nutzen)
          const name = cleanName(cost.description).slice(0, PRESET_NAME_MAX);
          const nameKey = presetNameKey(name);
          const existing = await tx.costPreset.findUnique({ where: { nameKey }, select: { id: true, unit: true } });
          if (existing) {
            presetId = existing.id;
            if (existing.unit === cost.unit) {
              await tx.costPreset.update({ where: { id: existing.id }, data: { unitPriceCents } });
              flash = "preis-katalog";
            } else {
              flash = "preis-einheit";
            }
          } else {
            const created = await tx.costPreset.create({
              data: {
                kind: toCostKind(cost.kind),
                name,
                nameKey,
                unit: cost.unit,
                unitPriceCents,
                defaultQuantityHundredths: 100,
                usageCount: 1,
                lastUsedAt: new Date(),
                createdById: admin.id,
              },
              select: { id: true },
            });
            presetId = created.id;
            flash = "preis-katalog";
          }
        }
      }
      await tx.costEntry.update({
        where: { id: cost.id },
        data: { unitPriceCents, totalCents, needsPrice: false, presetId },
      });
    });
  } catch (error) {
    console.error("[kosten] Preis konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState("Der Preis konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  revalidateCosts();
  // Die Zeile „Preis fehlt“ verschwindet danach – die Rückmeldung zeigt der Abschnitt
  redirect(`/admin/tickets/${ticket.id}?kosten=${flash}#kosten`);
}

/* ------------------------------------------------------------------ */
/* Schnellaktionen (gebunden: action={xyAction.bind(null, ticketId, costId)}) */
/* ------------------------------------------------------------------ */

export async function deleteCostAction(rawTicketId: number, costId: string): Promise<void> {
  const user = await requireCostRecorder();
  const ticket = await findTicket(rawTicketId);
  if (!ticket) redirect("/admin/tickets");
  const cost = await findCost(ticket.id, costId);
  if (cost) {
    if (costEditBlock(user, cost)) redirect(`/admin/tickets/${ticket.id}?kosten=gesperrt#kosten`);
    let deleted = 0;
    await db.$transaction(async (tx) => {
      // Nur löschen, solange die Position auf keiner Rechnung steht (eine Rechnung kann gerade erstellt worden sein)
      ({ count: deleted } = await tx.costEntry.deleteMany({
        where: { id: cost.id, invoiceId: null, ...(user.role === "ADMIN" ? {} : { billed: false, createdById: user.id }) },
      }));
      // Versehentlich erfasst: Zähler im Katalog zurücknehmen, damit unbenutzte Einträge wieder löschbar sind
      if (deleted === 1 && cost.presetId) {
        await tx.costPreset.updateMany({ where: { id: cost.presetId, usageCount: { gt: 0 } }, data: { usageCount: { decrement: 1 } } });
      }
    });
    revalidateCosts();
    if (deleted !== 1) redirect(`/admin/tickets/${ticket.id}?kosten=gesperrt#kosten`);
  }
  redirect(`/admin/tickets/${ticket.id}?kosten=geloescht#kosten`);
}

export async function toggleCostBilledAction(rawTicketId: number, costId: string): Promise<void> {
  await requireAdmin();
  const ticket = await findTicket(rawTicketId);
  if (!ticket) redirect("/admin/tickets");
  const cost = await findCost(ticket.id, costId);
  if (!cost) redirect(`/admin/tickets/${ticket.id}#kosten`);
  // Positionen auf einer Rechnung werden nur über die Rechnung (Storno) wieder offen
  if (cost.invoiceId) redirect(`/admin/tickets/${ticket.id}?kosten=gesperrt#kosten`);
  if (!cost.billed && cost.needsPrice) redirect(`/admin/tickets/${ticket.id}?kosten=preis-fehlt#kosten`);

  await db.costEntry.updateMany({
    where: { id: cost.id, invoiceId: null },
    data: cost.billed ? { billed: false, billedAt: null } : { billed: true, billedAt: new Date() },
  });
  revalidateCosts();
}

export async function markAllCostsBilledAction(rawTicketId: number): Promise<void> {
  await requireAdmin();
  const ticket = await findTicket(rawTicketId);
  if (!ticket) redirect("/admin/tickets");

  await db.costEntry.updateMany({
    where: { ticketId: ticket.id, billed: false, invoiceId: null, needsPrice: false },
    data: { billed: true, billedAt: new Date() },
  });
  revalidateCosts();
}

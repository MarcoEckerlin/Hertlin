"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { COST_KINDS, COST_KIND_LABELS, COST_UNITS } from "@/lib/constants";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { formatMoney, lineTotalCents, parseMoney, parseQuantity } from "@/lib/format";
import { checkbox, requiredText } from "@/lib/validation";
import { parseTicketIdParam } from "@/components/admin/tickets/data";

/**
 * Kosten zu Tickets – ausschließlich für Administratoren.
 * Jede Action ruft zuerst requireAdmin() auf (Techniker landen auf der Übersicht) und prüft danach,
 * dass das Ticket existiert und die Position wirklich zu diesem Ticket gehört.
 * Der Gesamtbetrag wird immer hier auf dem Server berechnet.
 */

const MAX_QUANTITY = 9_999_999; // 99.999,99
const MAX_UNIT_PRICE = 100_000_000; // 1.000.000,00 €

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateCosts(): void {
  // Ticketdetail, Ticketliste (Spalte Kosten), Übersicht und „Kosten pro Konto“
  revalidatePath("/admin", "layout");
}

function isCostId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value);
}

const costSchema = z.object({
  kind: z.enum(COST_KINDS, { error: "Bitte die Art auswählen." }),
  description: requiredText("eine Beschreibung", 300),
  performedAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein Datum angeben.")
    .refine((v) => !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()), "Bitte ein gültiges Datum angeben."),
  unit: z.enum(COST_UNITS, { error: "Bitte eine Einheit aus der Liste wählen." }),
  billed: checkbox,
});

type ParsedCost = {
  kind: (typeof COST_KINDS)[number];
  description: string;
  performedAt: Date;
  unit: string;
  quantityHundredths: number;
  unitPriceCents: number;
  totalCents: number;
  billed: boolean;
};

/** Liest und prüft die Felder des Kostenformulars. Menge und Preis in deutscher Schreibweise („1,25“, „89,90“). */
function parseCostForm(formData: FormData): { ok: true; data: ParsedCost } | { ok: false; state: FormState } {
  const parsed = costSchema.safeParse({
    kind: text(formData, "kind"),
    description: text(formData, "description"),
    performedAt: text(formData, "performedAt"),
    unit: text(formData, "unit"),
    billed: formData.get("billed"),
  });
  const fieldErrors: Record<string, string> = parsed.success ? {} : (fromZodError(parsed.error).fieldErrors ?? {});

  const quantityRaw = text(formData, "quantity");
  const quantity = parseQuantity(quantityRaw);
  if (!quantityRaw.trim()) fieldErrors.quantity = "Bitte eine Menge angeben.";
  else if (quantity === null) fieldErrors.quantity = "Bitte eine Zahl mit höchstens zwei Nachkommastellen eingeben, z. B. 1,25.";
  else if (quantity <= 0) fieldErrors.quantity = "Die Menge muss größer als 0 sein.";
  else if (quantity > MAX_QUANTITY) fieldErrors.quantity = "Die Menge ist zu groß.";

  const priceRaw = text(formData, "unitPrice");
  const unitPrice = parseMoney(priceRaw);
  if (!priceRaw.trim()) fieldErrors.unitPrice = "Bitte einen Einzelpreis angeben (0 für kostenlos).";
  else if (unitPrice === null) fieldErrors.unitPrice = "Bitte einen Betrag wie 95 oder 89,90 eingeben.";
  else if (unitPrice > MAX_UNIT_PRICE) fieldErrors.unitPrice = "Der Betrag ist zu hoch.";

  if (!parsed.success || Object.keys(fieldErrors).length > 0 || quantity === null || unitPrice === null) {
    return { ok: false, state: errorState("Bitte prüfen Sie die markierten Felder.", formData, fieldErrors) };
  }

  return {
    ok: true,
    data: {
      kind: parsed.data.kind,
      description: parsed.data.description,
      performedAt: new Date(`${parsed.data.performedAt}T12:00:00Z`),
      unit: parsed.data.unit,
      quantityHundredths: quantity,
      unitPriceCents: unitPrice,
      totalCents: lineTotalCents(quantity, unitPrice),
      billed: parsed.data.billed,
    },
  };
}

async function findTicket(rawTicketId: unknown) {
  const ticketId = parseTicketIdParam(rawTicketId);
  if (!ticketId) return null;
  return db.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
}

/** Position nur, wenn sie zum angegebenen Ticket gehört. */
async function findCost(ticketId: number, costId: unknown) {
  if (!isCostId(costId)) return null;
  return db.costEntry.findFirst({ where: { id: costId, ticketId }, select: { id: true, billed: true, billedAt: true } });
}

/* ------------------------------------------------------------------ */
/* Position hinzufügen                                                 */
/* ------------------------------------------------------------------ */

export async function addCostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const ticket = await findTicket(text(formData, "ticketId"));
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const result = parseCostForm(formData);
  if (!result.ok) return result.state;
  const data = result.data;

  try {
    await db.costEntry.create({
      data: {
        ticketId: ticket.id,
        kind: data.kind,
        description: data.description,
        quantityHundredths: data.quantityHundredths,
        unit: data.unit,
        unitPriceCents: data.unitPriceCents,
        totalCents: data.totalCents,
        performedAt: data.performedAt,
        billed: data.billed,
        billedAt: data.billed ? new Date() : null,
        createdById: admin.id,
      },
    });
  } catch (error) {
    console.error("[kosten] Position konnte nicht gespeichert werden:", error instanceof Error ? error.message : error);
    return errorState("Die Position konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  revalidateCosts();
  return successState(`${COST_KIND_LABELS[data.kind]} über ${formatMoney(data.totalCents)} hinzugefügt.`);
}

/* ------------------------------------------------------------------ */
/* Position bearbeiten (/admin/tickets/[id]/kosten/[costId])           */
/* ------------------------------------------------------------------ */

export async function updateCostAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const ticket = await findTicket(text(formData, "ticketId"));
  if (!ticket) return errorState("Dieses Ticket gibt es nicht mehr.");
  const cost = await findCost(ticket.id, text(formData, "costId"));
  if (!cost) return errorState("Diese Position gibt es nicht mehr. Vielleicht wurde sie inzwischen gelöscht.");

  const result = parseCostForm(formData);
  if (!result.ok) return result.state;
  const data = result.data;

  try {
    await db.costEntry.update({
      where: { id: cost.id },
      data: {
        kind: data.kind,
        description: data.description,
        quantityHundredths: data.quantityHundredths,
        unit: data.unit,
        unitPriceCents: data.unitPriceCents,
        totalCents: data.totalCents,
        performedAt: data.performedAt,
        billed: data.billed,
        // Abrechnungsdatum bleibt erhalten, solange die Position abgerechnet bleibt
        billedAt: data.billed ? (cost.billedAt ?? new Date()) : null,
      },
    });
  } catch (error) {
    console.error("[kosten] Position konnte nicht geändert werden:", error instanceof Error ? error.message : error);
    return errorState("Die Änderung konnte gerade nicht gespeichert werden. Bitte versuchen Sie es noch einmal.", formData);
  }

  revalidateCosts();
  redirect(`/admin/tickets/${ticket.id}?kosten=gespeichert#kosten`);
}

/* ------------------------------------------------------------------ */
/* Schnellaktionen (gebunden: action={xyAction.bind(null, ticketId, costId)}) */
/* ------------------------------------------------------------------ */

export async function deleteCostAction(rawTicketId: number, costId: string): Promise<void> {
  await requireAdmin();
  const ticket = await findTicket(rawTicketId);
  if (!ticket) redirect("/admin/tickets");
  const cost = await findCost(ticket.id, costId);
  if (cost) {
    await db.costEntry.delete({ where: { id: cost.id } });
    revalidateCosts();
  }
  redirect(`/admin/tickets/${ticket.id}?kosten=geloescht#kosten`);
}

export async function toggleCostBilledAction(rawTicketId: number, costId: string): Promise<void> {
  await requireAdmin();
  const ticket = await findTicket(rawTicketId);
  if (!ticket) redirect("/admin/tickets");
  const cost = await findCost(ticket.id, costId);
  if (!cost) redirect(`/admin/tickets/${ticket.id}#kosten`);

  await db.costEntry.update({
    where: { id: cost.id },
    data: cost.billed ? { billed: false, billedAt: null } : { billed: true, billedAt: new Date() },
  });
  revalidateCosts();
}

export async function markAllCostsBilledAction(rawTicketId: number): Promise<void> {
  await requireAdmin();
  const ticket = await findTicket(rawTicketId);
  if (!ticket) redirect("/admin/tickets");

  await db.costEntry.updateMany({ where: { ticketId: ticket.id, billed: false }, data: { billed: true, billedAt: new Date() } });
  revalidateCosts();
}

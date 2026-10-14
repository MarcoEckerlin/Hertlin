"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { INQUIRY_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { formatInquiryNumber } from "@/lib/format";
import { optionalText } from "@/lib/validation";
import { publish } from "@/realtime/bus";

/**
 * Anfragen von Interessenten bearbeiten.
 * Status und interne Notiz: alle Hertlin-Mitarbeiter. Löschen: nur Administratoren.
 */

function inquiryId(formData: FormData): number | null {
  const raw = formData.get("id");
  if (typeof raw !== "string" || !/^\d{1,9}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

const NOT_FOUND = "Diese Anfrage gibt es nicht mehr. Bitte laden Sie die Seite neu.";

const updateSchema = z.object({
  status: z.enum(INQUIRY_STATUSES, { error: "Bitte einen Status auswählen." }),
  internalNote: optionalText(4000),
});

export async function updateInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireStaff();

  const id = inquiryId(formData);
  const inquiry = id ? await db.inquiry.findUnique({ where: { id }, select: { id: true, status: true } }) : null;
  if (!inquiry) return errorState(NOT_FOUND);

  const parsed = updateSchema.safeParse({
    status: formData.get("status"),
    internalNote: formData.get("internalNote") ?? undefined,
  });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  await db.inquiry.update({
    where: { id: inquiry.id },
    data: { status: parsed.data.status, internalNote: parsed.data.internalNote ?? null },
  });

  publish({ type: "inquiry.updated", inquiryId: inquiry.id });
  revalidatePath("/admin", "layout");
  return successState("Gespeichert.");
}

/** Anfrage endgültig löschen (Datenschutz: Daten nicht länger aufbewahren als nötig). */
export async function deleteInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = inquiryId(formData);
  const inquiry = id ? await db.inquiry.findUnique({ where: { id }, select: { id: true } }) : null;
  if (!inquiry) return errorState(NOT_FOUND);

  if (formData.get("confirm") !== "on") {
    return errorState("Bitte bestätigen Sie, dass die Anfrage endgültig gelöscht werden soll.", undefined, {
      confirm: "Bitte bestätigen.",
    });
  }

  await db.inquiry.delete({ where: { id: inquiry.id } });

  revalidatePath("/admin", "layout");
  redirect(`/admin/anfragen?geloescht=${encodeURIComponent(formatInquiryNumber(inquiry.id))}`);
}

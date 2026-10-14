"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { accountCostWhere, parseCostAccount, resolveCostAccount } from "@/lib/costs";
import { db } from "@/lib/db";
import { errorState, successState, type FormState } from "@/lib/forms";

/**
 * Abrechnungsstand von Kostenpositionen ändern (nur Administratoren).
 * Es werden ausschließlich Positionen geändert, die zum angegebenen Konto gehören –
 * IDs aus dem Formular werden dafür erneut gegen das Konto gefiltert.
 */

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const MAX_IDS = 2000;

function positions(count: number): string {
  return count === 1 ? "1 Position" : `${count} Positionen`;
}

export async function setCostsBilledAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  const intent = get("intent");
  if (intent !== "billed" && intent !== "open") {
    return errorState("Die Aktion ist unklar. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.");
  }

  const account = parseCostAccount(get);
  const resolved = account ? await resolveCostAccount(account) : null;
  if (!resolved) return errorState("Dieses Konto gibt es nicht mehr. Bitte laden Sie die Seite neu.");

  const ids = [
    ...new Set(
      formData
        .getAll("ids")
        .filter((v): v is string => typeof v === "string" && ID_PATTERN.test(v)),
    ),
  ].slice(0, MAX_IDS);
  if (ids.length === 0) return errorState("Bitte wählen Sie mindestens eine Position aus.");

  const markBilled = intent === "billed";
  const result = await db.costEntry.updateMany({
    // Nur Positionen dieses Kontos, die den Stand tatsächlich ändern
    where: { ...accountCostWhere(resolved, ids), billed: !markBilled },
    data: markBilled ? { billed: true, billedAt: new Date() } : { billed: false, billedAt: null },
  });

  revalidatePath("/admin/kosten", "layout");
  revalidatePath("/admin/kunden", "layout");

  const skipped = ids.length - result.count;
  if (result.count === 0) {
    return successState(
      markBilled
        ? "Die ausgewählten Positionen waren bereits als abgerechnet markiert."
        : "Die ausgewählten Positionen waren bereits offen.",
    );
  }
  const done = markBilled
    ? `${positions(result.count)} als abgerechnet markiert.`
    : `${positions(result.count)} wieder als offen markiert.`;
  return successState(
    skipped > 0 ? `${done} ${positions(skipped)} hatte${skipped === 1 ? "" : "n"} diesen Stand schon.` : done,
  );
}

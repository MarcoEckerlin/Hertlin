"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { accountCostWhere, parseCostAccount, resolveCostAccount } from "@/lib/costs";
import { db } from "@/lib/db";
import { errorState, successState, type FormState } from "@/lib/forms";

/**
 * Abrechnungsstand von Kostenpositionen von Hand ändern (nur Administratoren), z. B. für Leistungen, die außerhalb
 * dieser Verwaltung abgerechnet wurden. Es werden ausschließlich Positionen geändert, die zum angegebenen Konto
 * gehören – IDs aus dem Formular werden dafür erneut gegen das Konto gefiltert.
 * Positionen auf einer Rechnung bleiben unangetastet (wieder offen nur über „Stornieren“), Positionen ohne Preis
 * können nicht als abgerechnet markiert werden.
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

  const ids = [...new Set(formData.getAll("ids").filter((v): v is string => typeof v === "string" && ID_PATTERN.test(v)))].slice(
    0,
    MAX_IDS,
  );
  if (ids.length === 0) return errorState("Bitte wählen Sie mindestens eine Position aus.");

  const markBilled = intent === "billed";
  const scope = accountCostWhere(resolved, ids);
  const [onInvoice, unpriced] = await Promise.all([
    // Positionen einer Rechnung sind immer abgerechnet – nur beim Zurücksetzen erwähnenswert
    markBilled ? Promise.resolve(0) : db.costEntry.count({ where: { ...scope, invoiceId: { not: null } } }),
    markBilled ? db.costEntry.count({ where: { ...scope, needsPrice: true, billed: false } }) : Promise.resolve(0),
  ]);

  const result = await db.costEntry.updateMany({
    // Nur Positionen dieses Kontos, die den Stand tatsächlich ändern; nie Positionen einer Rechnung
    where: { ...scope, billed: !markBilled, invoiceId: null, ...(markBilled ? { needsPrice: false } : {}) },
    data: markBilled ? { billed: true, billedAt: new Date() } : { billed: false, billedAt: null },
  });

  revalidatePath("/admin/kosten", "layout");
  revalidatePath("/admin/kunden", "layout");

  const notes: string[] = [];
  if (onInvoice > 0) {
    notes.push(
      `${positions(onInvoice)} ${onInvoice === 1 ? "steht" : "stehen"} auf einer Rechnung und ${onInvoice === 1 ? "bleibt" : "bleiben"} unverändert – wieder offen nur über „Stornieren“ in der Rechnung.`,
    );
  }
  if (unpriced > 0) {
    notes.push(`${positions(unpriced)} ohne Preis ${unpriced === 1 ? "bleibt" : "bleiben"} offen, bis der Preis eingetragen ist.`);
  }

  if (result.count === 0) {
    if (notes.length > 0) return errorState(notes.join(" "));
    return successState(
      markBilled
        ? "Die ausgewählten Positionen waren bereits als abgerechnet markiert."
        : "Die ausgewählten Positionen waren bereits offen.",
    );
  }
  const done = markBilled
    ? `${positions(result.count)} als abgerechnet markiert.`
    : `${positions(result.count)} wieder als offen markiert.`;
  const skipped = ids.length - result.count - onInvoice - unpriced;
  if (skipped > 0) notes.unshift(`${positions(skipped)} hatte${skipped === 1 ? "" : "n"} diesen Stand schon.`);
  return successState([done, ...notes].join(" "));
}

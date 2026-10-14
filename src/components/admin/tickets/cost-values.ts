import { centsToInput, toDateInput } from "@/lib/format";
import { quantityToInput } from "@/lib/cost-catalog";

/**
 * Werte für die Formulare „Leistungen und Material“ (Server und Browser).
 * Preise nur füllen, wenn die Seite für einen Administrator gerendert wird.
 */

/** Katalogeintrag für „Aus dem Katalog“. unitPriceCents ist nur für Administratoren gesetzt. */
export type PresetOption = {
  id: string;
  kind: string;
  name: string;
  unit: string;
  defaultQuantityHundredths: number;
  usageCount: number;
  /** ISO-Zeitpunkt */
  lastUsedAt: string | null;
  sortOrder: number;
  unitPriceCents?: number | null;
};

/** Mitarbeiter für „Erbracht von“ */
export type StaffChoice = { id: string; name: string; active: boolean };

export type CostFormValues = {
  kind: string;
  description: string;
  /** YYYY-MM-DD */
  performedAt: string;
  /** deutsche Schreibweise, z. B. "1,25" */
  quantity: string;
  unit: string;
  /** deutsche Schreibweise, z. B. "95,00"; leer = Preis fehlt (nur Administratoren) */
  unitPrice: string;
  performedById: string;
  billed: boolean;
};

/** Heute als Vorgabe für das Leistungsdatum */
export function todayInput(): string {
  return toDateInput();
}

/** Formularwerte aus einer gespeicherten Position. Ohne Preisangaben (Techniker) bleibt unitPrice leer. */
export function costValuesFromEntry(entry: {
  kind: string;
  description: string;
  performedAt: Date;
  quantityHundredths: number;
  unit: string;
  performedById: string | null;
  billed: boolean;
  unitPriceCents?: number;
  needsPrice?: boolean;
}): CostFormValues {
  return {
    kind: entry.kind,
    description: entry.description,
    performedAt: toDateInput(entry.performedAt),
    quantity: quantityToInput(entry.quantityHundredths),
    unit: entry.unit,
    unitPrice: entry.unitPriceCents === undefined || entry.needsPrice ? "" : centsToInput(entry.unitPriceCents),
    performedById: entry.performedById ?? "",
    billed: entry.billed,
  };
}

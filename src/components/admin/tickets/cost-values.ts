import type { CostKind } from "@/lib/constants";
import { centsToInput, toDateInput } from "@/lib/format";

/**
 * Werte für das Kostenformular (Server und Browser). Nur auf Seiten nach requireAdmin() verwenden.
 */

/** Vorschlagswerte je Art (aus src/config/pricing.ts, vom Server übergeben). */
export type CostDefaults = Record<CostKind, { unit: string; unitPriceCents: number | null; quantityHundredths: number }>;

export type CostFormValues = {
  kind: string;
  description: string;
  /** YYYY-MM-DD */
  performedAt: string;
  /** deutsche Schreibweise, z. B. "1,25" */
  quantity: string;
  unit: string;
  /** deutsche Schreibweise, z. B. "95,00" */
  unitPrice: string;
  billed: boolean;
};

/** Menge für das Eingabefeld: 125 -> "1,25" (ohne Tausenderpunkte, damit sie wieder eingelesen werden kann) */
function quantityToInput(hundredths: number): string {
  return (hundredths / 100).toString().replace(".", ",");
}

/** Startwerte für eine neue Position der gewählten Art (Datum: heute). */
export function newCostValues(defaults: CostDefaults, kind: CostKind = "LABOR"): CostFormValues {
  const d = defaults[kind];
  return {
    kind,
    description: "",
    performedAt: toDateInput(),
    quantity: quantityToInput(d.quantityHundredths),
    unit: d.unit,
    unitPrice: d.unitPriceCents === null ? "" : centsToInput(d.unitPriceCents),
    billed: false,
  };
}

/** Formularwerte aus einer gespeicherten Position. */
export function costValuesFromEntry(entry: {
  kind: string;
  description: string;
  performedAt: Date;
  quantityHundredths: number;
  unit: string;
  unitPriceCents: number;
  billed: boolean;
}): CostFormValues {
  return {
    kind: entry.kind,
    description: entry.description,
    performedAt: toDateInput(entry.performedAt),
    quantity: quantityToInput(entry.quantityHundredths),
    unit: entry.unit,
    unitPrice: centsToInput(entry.unitPriceCents),
    billed: entry.billed,
  };
}

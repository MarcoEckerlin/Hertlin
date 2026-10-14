import type { CostKind } from "@/lib/constants";

/**
 * Standardsätze für das Kostenformular im Ticket (nur für Administratoren sichtbar).
 *
 * Die Werte sind Vorschläge: Wählt man im Formular eine Art aus, werden Einheit und
 * Einzelpreis damit vorbelegt. Jede Position kann beim Erfassen abweichen.
 *
 * ANPASSEN: Beträge an die eigene Preisliste anpassen (alle Preise netto, in Cent).
 * null = kein Preisvorschlag, das Feld bleibt leer (z. B. bei Material).
 */
export type CostDefault = {
  /** Einheit aus COST_UNITS */
  unit: string;
  /** Vorgeschlagener Einzelpreis in Cent oder null */
  unitPriceCents: number | null;
  /** Vorgeschlagene Menge in Hundertsteln (100 = 1) */
  quantityHundredths: number;
};

export const COST_DEFAULTS: Record<CostKind, CostDefault> = {
  // Stundensatz Technik – anpassen
  LABOR: { unit: "Std.", unitPriceCents: 9500, quantityHundredths: 100 },
  // Anfahrtspauschale im Einzugsgebiet – anpassen
  TRAVEL: { unit: "Pauschale", unitPriceCents: 3500, quantityHundredths: 100 },
  // Material wird nach Beleg erfasst – kein Vorschlag
  MATERIAL: { unit: "Stk.", unitPriceCents: null, quantityHundredths: 100 },
  // Pauschalen werden je Auftrag vereinbart – kein Vorschlag
  FLAT: { unit: "Pauschale", unitPriceCents: null, quantityHundredths: 100 },
};

/** Abrechnungstakt für Arbeitszeit als Hinweis im Formular (z. B. „angefangene Viertelstunde“) – anpassen. */
export const LABOR_BILLING_HINT = "Abrechnung je angefangene Viertelstunde: 0,25 · 0,5 · 0,75 · 1";

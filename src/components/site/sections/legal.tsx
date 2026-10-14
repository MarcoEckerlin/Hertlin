import { Alert } from "@/components/ui/alert";

/** true, wenn ein Wert aus den Firmendaten noch ein Platzhalter ist (beginnt mit "TODO"). */
export function isPlaceholder(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().toUpperCase().startsWith("TODO");
}

/**
 * Hinweis, solange Pflichtangaben in den Firmendaten noch Platzhalter sind.
 * Verschwindet automatisch, sobald alle übergebenen Werte ausgefüllt sind.
 */
export function PlaceholderNotice({ values, className }: { values: Array<string | null | undefined>; className?: string }) {
  if (!values.some(isPlaceholder)) return null;
  return (
    <Alert tone="warning" title="Angaben noch unvollständig" className={className}>
      Einige Firmenangaben auf dieser Seite sind noch Platzhalter (mit „TODO“ markiert). Bitte vor der Veröffentlichung in der
      Verwaltung unter „Website“ → „Firmendaten“ vollständig ergänzen und den Text rechtlich prüfen lassen.
    </Alert>
  );
}

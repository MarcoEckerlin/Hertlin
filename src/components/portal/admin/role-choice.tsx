import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { FieldError, Hint } from "@/components/ui/field";
import type { PortalRole } from "@/components/portal/admin/types";

/** Beschreibung der Rolle „Hauptansprechpartner“ – beim Firmenkunden reicht sie weiter als bei einer Unterkunde. */
export function adminRoleDescription(scope: { isRoot: boolean; companyName?: string }): string {
  if (scope.isRoot) return ROLE_DESCRIPTIONS.CUSTOMER_ADMIN;
  return scope.companyName
    ? `Sieht alle Tickets von ${scope.companyName} und verwaltet die Benutzer dort, aber nicht den Rest der Firma.`
    : "Sieht alle Tickets dieser Unterkunde und verwaltet die Benutzer dort, aber nicht den Rest der Firma.";
}

const ORDER: PortalRole[] = ["CUSTOMER_USER", "CUSTOMER_ADMIN"];

/**
 * Auswahl der Rolle als zwei Karten mit Erklärung.
 * Bleibt eine echte Radio-Gruppe (Pfeiltasten, sichtbarer Fokus).
 */
export function RoleChoice({
  name = "role",
  defaultValue,
  adminDescription,
  disabled,
  error,
  hint,
}: {
  name?: string;
  defaultValue: PortalRole;
  adminDescription: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
}) {
  const id = `${name}-group`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <fieldset aria-describedby={describedBy} aria-invalid={error ? true : undefined} disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-ink">Rolle</legend>
      <div className="grid gap-3 @md:grid-cols-2">
        {ORDER.map((role) => (
          <label
            key={role}
            className={cn(
              "relative flex cursor-pointer gap-3 rounded-xl border border-line-strong bg-surface p-4 transition-colors",
              "hover:border-brand-300 has-checked:border-brand-400 has-checked:bg-brand-50",
              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-600",
              "has-disabled:cursor-not-allowed has-disabled:opacity-70 has-disabled:hover:border-line-strong",
              error && "border-danger-solid",
            )}
          >
            <input
              type="radio"
              name={name}
              value={role}
              defaultChecked={defaultValue === role}
              className="mt-0.5 size-[1.125rem] shrink-0 cursor-pointer accent-brand-600 disabled:cursor-not-allowed"
            />
            <span className="min-w-0">
              <span className="block text-[0.9375rem] font-semibold text-ink">{ROLE_LABELS[role]}</span>
              <span className="mt-0.5 block text-sm leading-snug text-ink-muted">
                {role === "CUSTOMER_ADMIN" ? adminDescription : ROLE_DESCRIPTIONS.CUSTOMER_USER}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : <Hint id={`${id}-hint`}>{hint}</Hint>}
    </fieldset>
  );
}

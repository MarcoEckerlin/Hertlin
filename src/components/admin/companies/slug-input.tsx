"use client";

import { FieldError, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { RESERVED_SLUGS, isValidSlug } from "@/lib/hosts";
import { normalizeSlugInput } from "@/components/admin/companies/slug";

/** Prüfung im Browser – die verbindliche Prüfung (inkl. Eindeutigkeit) macht der Server. */
function slugHint(slug: string): { tone: "muted" | "warn"; text: string } | null {
  if (!slug) return null;
  if (RESERVED_SLUGS.has(slug)) return { tone: "warn", text: `„${slug}“ ist für eigene Dienste reserviert.` };
  if (slug.length < 2) return { tone: "warn", text: "Mindestens 2 Zeichen." };
  if (!isValidSlug(slug)) return { tone: "warn", text: "Darf nicht mit einem Bindestrich beginnen oder enden." };
  return null;
}

/**
 * Eingabe für das Subdomain-Kürzel mit Live-Vorschau der Portal-Adresse.
 * Kontrolliert: Der Aufrufer hält den Wert (z. B. um ihn aus dem Firmennamen vorzuschlagen).
 */
export function SlugInput({
  id,
  label,
  value,
  onChange,
  rootDomain,
  error,
  hint,
  action,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rootDomain: string;
  error?: string;
  hint?: string;
  /** z. B. Button „Vorschlag übernehmen“ */
  action?: React.ReactNode;
}) {
  const check = slugHint(value);
  const describedBy = error ? `${id}-error` : `${id}-preview`;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      <div
        className={cn(
          "flex h-11 items-stretch overflow-hidden rounded-xl border bg-white shadow-[inset_0_1px_1px_rgb(16_36_58/0.03)] transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600",
          error
            ? "border-red-400"
            : "border-line-strong hover:border-brand-300 focus-within:border-brand-600",
        )}
      >
        <input
          id={id}
          name="slug"
          value={value}
          onChange={(e) => onChange(normalizeSlugInput(e.currentTarget.value))}
          required
          minLength={2}
          maxLength={40}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-muted/80 focus:outline-none"
          placeholder="kuerzel"
        />
        <span
          className="flex items-center border-l border-line bg-mist px-3 text-sm whitespace-nowrap text-ink-muted"
          aria-hidden
        >
          .{rootDomain}
        </span>
      </div>
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : (
        <p
          id={`${id}-preview`}
          className={cn("mt-1.5 text-sm", check?.tone === "warn" ? "font-medium text-amber-800" : "text-ink-muted")}
        >
          {check ? (
            check.text
          ) : value ? (
            <>
              Portal-Adresse: <span className="font-semibold break-all text-ink">{`${value}.${rootDomain}`}</span>
            </>
          ) : (
            (hint ?? "Kleinbuchstaben, Ziffern und Bindestrich, z. B. „mueller-bau“.")
          )}
        </p>
      )}
    </div>
  );
}

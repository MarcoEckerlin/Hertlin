import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import type { FormState } from "@/lib/forms";
import { Checkbox, FieldError, Hint } from "@/components/ui/field";

/**
 * Gemeinsame Bausteine der öffentlichen Formulare.
 * Werden nur in Client-Formularen verwendet, enthalten selbst aber keine Hooks.
 */

/** id, aria-invalid und aria-describedby passend zur Field-Komponente. */
export function a11yProps(id: string, error?: string, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}

/**
 * Überschrift + Inhalt einer Formulargruppe, mit Trennlinie zur vorherigen Gruppe.
 * level: Überschriftenebene passend zur Seite (h3 unter einem Abschnitt mit h2, h2 direkt unter der h1).
 */
export function FormSection({
  id,
  title,
  description,
  first = false,
  level = 3,
  children,
}: {
  id: string;
  title: string;
  description?: ReactNode;
  first?: boolean;
  level?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div role="group" aria-labelledby={id} className={cn("space-y-5", !first && "border-t border-line pt-7")}>
      <div>
        <Heading id={id} className="text-base font-bold text-ink">
          {title}
        </Heading>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string };

/**
 * Radio-Gruppe als Umschalter („Segmented Control“).
 * Bleibt eine echte Radio-Gruppe: Pfeiltasten wechseln die Auswahl, der Fokus ist sichtbar.
 */
export function SegmentedControl<T extends string>({
  id,
  name,
  legend,
  options,
  defaultValue,
  onChange,
  error,
  hint,
}: {
  id: string;
  name: string;
  legend: string;
  options: readonly SegmentOption<T>[];
  defaultValue?: T;
  onChange?: (value: T) => void;
  error?: string;
  hint?: ReactNode;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <fieldset aria-describedby={describedBy} aria-invalid={error ? true : undefined} className="min-w-0">
      <legend className="mb-1.5 text-sm font-semibold text-ink">{legend}</legend>
      <div
        className={cn(
          "grid gap-1 rounded-full bg-mist p-1 ring-1 ring-inset",
          error ? "ring-danger-line" : "ring-line-strong",
        )}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <label key={option.value} className="relative block min-w-0 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              onChange={onChange ? () => onChange(option.value) : undefined}
              className="peer sr-only"
            />
            <span className="flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-center text-sm leading-tight font-semibold text-ink-soft transition-colors peer-checked:bg-primary peer-checked:text-on-primary peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 peer-[:not(:checked)]:hover:text-ink">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : <Hint id={`${id}-hint`}>{hint}</Hint>}
    </fieldset>
  );
}

/**
 * Unsichtbares Feld gegen Spam-Bots. Menschen sehen es nicht und füllen es nicht aus;
 * ist es befüllt, tut die Action so, als wäre alles in Ordnung, speichert aber nichts.
 */
export function Honeypot({ idPrefix }: { idPrefix: string }) {
  return (
    <div aria-hidden="true" className="absolute top-0 -left-[10000px] h-px w-px overflow-hidden">
      <label htmlFor={`${idPrefix}-website`}>Website (bitte frei lassen)</label>
      <input id={`${idPrefix}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

/** Pflicht-Einwilligung zur Datenverarbeitung mit Link zur Datenschutzerklärung. */
export function PrivacyConsent({ idPrefix, state }: { idPrefix: string; state: FormState }) {
  const id = `${idPrefix}-privacy`;
  const error = state.fieldErrors?.privacy;
  return (
    <div>
      <Checkbox
        id={id}
        name="privacy"
        defaultChecked={state.values?.privacy === "on"}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        label={
          <>
            Ich bin einverstanden, dass {site.name} meine Angaben speichert, um mein Anliegen zu bearbeiten und mich dazu
            zu kontaktieren. Details stehen in der{" "}
            <Link
              href="/datenschutz"
              target="_blank"
              className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Datenschutzerklärung
            </Link>
            .
          </>
        }
        hint="Die Einwilligung können Sie jederzeit per E-Mail widerrufen."
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

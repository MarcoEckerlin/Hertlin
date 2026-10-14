"use client";

import { startTransition, useActionState, useState } from "react";
import { Languages } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/forms";
import { LANGUAGES, languageLabel } from "@/lib/languages";
import { cn } from "@/lib/cn";
import { Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

type LanguageAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Auswahl, in welche Sprache die Nachrichten übersetzt angezeigt werden (Inquiry.language).
 * Speichert direkt beim Wechsel. "" = keine Übersetzung (Deutsch).
 * Bewusst ohne <form action>: React setzt Formulare nach einer Action zurück, und eine
 * kontrollierte Auswahlliste zeigt danach sonst die falsche Sprache an.
 */
export function ChatLanguageSelect({
  action,
  hidden,
  current,
  id,
  label,
  sublabel,
  sublabelLang,
  emptyLabel,
  className,
}: {
  action: LanguageAction;
  hidden: Record<string, string>;
  current: string | null;
  id: string;
  label: string;
  /** zweite Zeile unter dem Label, z. B. auf Englisch (dann sublabelLang="en") */
  sublabel?: string;
  sublabelLang?: string;
  emptyLabel: string;
  className?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, initialFormState);
  const [value, setValue] = useState(current ?? "");
  const [lastCurrent, setLastCurrent] = useState(current);
  const [lastState, setLastState] = useState(state);

  // Ändert jemand anderes die Sprache (z. B. das Team), die Auswahl nachziehen
  if (current !== lastCurrent) {
    setLastCurrent(current);
    setValue(current ?? "");
  }
  // Speichern fehlgeschlagen: wieder die gespeicherte Sprache anzeigen
  if (state !== lastState) {
    setLastState(state);
    if (state.status === "error") setValue(current ?? "");
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <label htmlFor={id} className="flex items-start gap-2 text-sm font-semibold text-ink">
          <Languages className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          <span>
            {label}
            {sublabel ? (
              <span className="block text-xs font-normal text-ink-muted" lang={sublabelLang}>
                {sublabel}
              </span>
            ) : null}
          </span>
        </label>
        <div className="sm:w-64">
          <Select
            id={id}
            name="language"
            value={value}
            aria-describedby={`${id}-status`}
            onChange={(event) => {
              const next = event.target.value;
              setValue(next);
              const formData = new FormData();
              for (const [name, v] of Object.entries(hidden)) formData.set(name, v);
              formData.set("language", next);
              startTransition(() => dispatch(formData));
            }}
          >
            <option value="">{emptyLabel}</option>
            {LANGUAGES.filter((l) => l.code !== "de").map((l) => (
              <option key={l.code} value={l.code}>
                {`${l.native} (${l.label})`}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <p
        id={`${id}-status`}
        aria-live="polite"
        className={cn("text-xs", state.status === "error" ? "font-medium text-danger-ink" : "text-ink-muted")}
      >
        {pending ? "Wird gespeichert …" : state.status !== "idle" ? state.message : null}
      </p>
    </div>
  );
}

/** Ein-Klick-Knopf: Sprache des Interessenten auf die erkannte Sprache setzen (Verwaltung). */
export function SuggestLanguageButton({
  action,
  inquiryId,
  language,
}: {
  action: LanguageAction;
  inquiryId: number;
  language: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-3">
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="language" value={language} />
      <button type="submit" disabled={pending} className={buttonClasses("secondary", "sm")}>
        {pending ? "Wird umgestellt …" : `Auf ${languageLabel(language)} umstellen`}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="text-sm font-medium text-danger-ink">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

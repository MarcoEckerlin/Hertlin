"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { detailsAnimationClass } from "@/components/admin/companies/disclosure";
import { cn } from "@/lib/cn";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";
import { updatePageSettingsAction } from "@/lib/actions/admin-website";

export type PageSettingsValues = {
  id: string;
  slug: string;
  title: string;
  navLabel: string | null;
  showInNav: boolean;
  showInFooter: boolean;
  navOrder: number;
  published: boolean;
  system: boolean;
  /** Wurde die Seite schon einmal veröffentlicht? */
  everPublished: boolean;
};

/** Kurzfassung der aktuellen Einstellungen für die eingeklappte Zeile */
function summary(page: PageSettingsValues): string {
  const linked = [page.showInNav ? "Hauptmenü" : null, page.showInFooter ? "Fußzeile" : null].filter(Boolean);
  const parts = [
    linked.length > 0 ? `im ${linked.join(" und in der ")}` : "nicht verlinkt",
    linked.length > 0 ? `Reihenfolge ${page.navOrder}` : null,
    !page.system && page.everPublished && !page.published ? "ausgeblendet" : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Menü, Reihenfolge, Sichtbarkeit und Adresse einer Seite – wirkt sofort, ohne Veröffentlichen.
 * Eingeklappt, damit es nicht mit dem Entwurf (Speichern/Veröffentlichen oben) verwechselt wird.
 */
export function PageSettingsForm({ page, siteHost }: { page: PageSettingsValues; siteHost: string }) {
  const [state, formAction] = useActionState(updatePageSettingsAction.bind(null, page.id), initialFormState);
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors ?? {};
  const checked = (name: string, fallback: boolean) => (v ? v[name] === "on" : fallback);

  return (
    <details
      id="seiteneinstellungen"
      className={cn("group scroll-mt-32 rounded-2xl border border-line bg-surface shadow-card", detailsAnimationClass)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 select-none hover:bg-brand-50/50 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-ink">Menü und Sichtbarkeit</span>
            <Badge tone="amber">gilt sofort</Badge>
          </span>
          <span className="mt-0.5 block text-sm text-ink-muted">{summary(page)}</span>
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-line px-5 py-5 sm:px-6">
        <p className="mb-5 text-sm text-ink-soft">
          Diese Einstellungen gelten sofort nach „Einstellungen übernehmen“ – unabhängig vom Entwurf.
        </p>
        {/* Neu aufbauen, wenn sich der Stand von außen ändert (z. B. erstes Veröffentlichen im Editor):
            defaultChecked/defaultValue wirken nur beim ersten Rendern. Sonst bliebe „Seite anzeigen“
            leer und „Einstellungen übernehmen“ würde die gerade veröffentlichte Seite wieder ausblenden. */}
        <form
          key={`${page.everPublished}-${page.published}-${page.slug}`}
          action={formAction}
          className="space-y-5"
          noValidate
        >
          {!page.system ? (
            <Field
              label="Adresse"
              htmlFor="settings-slug"
              error={e.slug}
              hint="Nur Kleinbuchstaben, Ziffern und Bindestriche. Achtung: Bestehende Links auf die alte Adresse funktionieren danach nicht mehr."
            >
              <div className="flex items-stretch overflow-hidden rounded-xl border border-line-strong bg-surface focus-within:border-brand-600 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-600">
                <span className="hidden items-center border-r border-line bg-mist px-3 text-sm text-ink-muted sm:flex">{siteHost}/</span>
                <input
                  id="settings-slug"
                  name="slug"
                  defaultValue={v?.slug ?? page.slug}
                  maxLength={60}
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-invalid={e.slug ? true : undefined}
                  aria-describedby={e.slug ? "settings-slug-error" : "settings-slug-hint"}
                  className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-[0.9375rem] text-ink focus:outline-none"
                />
              </div>
            </Field>
          ) : null}

          <Field
            label="Bezeichnung im Menü"
            htmlFor="settings-navLabel"
            optional
            error={e.navLabel}
            hint={`Kurzform für Menü und Fußzeile. Leer lassen, um den Seitentitel „${page.title}“ zu verwenden.`}
          >
            <Input
              id="settings-navLabel"
              name="navLabel"
              defaultValue={v?.navLabel ?? page.navLabel ?? ""}
              maxLength={40}
              aria-invalid={e.navLabel ? true : undefined}
              aria-describedby={e.navLabel ? "settings-navLabel-error" : "settings-navLabel-hint"}
            />
          </Field>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-semibold text-ink">Wo ist die Seite verlinkt?</legend>
            <Checkbox
              name="showInNav"
              label="Hauptmenü"
              hint="Oben in der Kopfzeile der Website."
              defaultChecked={checked("showInNav", page.showInNav)}
            />
            <Checkbox
              name="showInFooter"
              label="Fußzeile"
              hint="Unten auf jeder Seite, z. B. für Impressum und AGB."
              defaultChecked={checked("showInFooter", page.showInFooter)}
            />
          </fieldset>

          <Field
            label="Reihenfolge"
            htmlFor="settings-navOrder"
            error={e.navOrder}
            hint="Zahl von 0 bis 999. Kleinere Zahlen stehen im Menü weiter vorne."
            className="max-w-48"
          >
            <Input
              id="settings-navOrder"
              name="navOrder"
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              step={1}
              defaultValue={v?.navOrder ?? String(page.navOrder)}
              aria-invalid={e.navOrder ? true : undefined}
              aria-describedby={e.navOrder ? "settings-navOrder-error" : "settings-navOrder-hint"}
            />
          </Field>

          {page.system ? (
            <p className="rounded-xl bg-mist px-4 py-3 text-sm text-ink-soft ring-1 ring-line ring-inset">
              Kernseiten sind immer erreichbar. Adresse und Sichtbarkeit lassen sich nicht ändern.
            </p>
          ) : (
            <>
              {/* Nur wenn das Kästchen beim Anzeigen bedienbar war, übernimmt der Server „published“
                  (ein gesperrtes Kästchen wird nicht mitgeschickt und sähe sonst wie „aus“ aus). */}
              {page.everPublished ? <input type="hidden" name="publishedEditable" value="1" /> : null}
              <Checkbox
                name="published"
                label="Seite auf der Website anzeigen"
                disabled={!page.everPublished}
                hint={
                  page.everPublished
                    ? "Ausgeblendete Seiten sind nicht erreichbar und verschwinden aus Menü und Fußzeile. Der Inhalt bleibt erhalten."
                    : "Wird beim ersten Veröffentlichen automatisch eingeschaltet."
                }
                defaultChecked={page.everPublished ? checked("published", page.published) : false}
              />
            </>
          )}

          <FormMessage state={state} />
          <div>
            <SubmitButton variant="secondary" pendingText="Wird übernommen …">
              Einstellungen übernehmen
            </SubmitButton>
          </div>
        </form>
      </div>
    </details>
  );
}

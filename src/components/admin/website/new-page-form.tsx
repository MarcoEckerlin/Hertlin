"use client";

import { useActionState, useState } from "react";
import { PAGE_SLUG_PATTERN, RESERVED_PAGE_SLUGS, SYSTEM_PAGE_SLUGS } from "@/cms/schema";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";
import { createPageAction } from "@/lib/actions/admin-website";
import { slugify } from "@/components/admin/website/slug";

const SYSTEM = new Set<string>(SYSTEM_PAGE_SLUGS);

/** Sofortige Rückmeldung zur Adresse (der Server prüft trotzdem). */
function slugProblem(slug: string, taken: Set<string>): string | null {
  if (!slug) return null;
  if (!PAGE_SLUG_PATTERN.test(slug)) return "Nur Kleinbuchstaben, Ziffern und Bindestriche (nicht am Anfang oder Ende).";
  if (RESERVED_PAGE_SLUGS.has(slug)) return "Diese Adresse wird von der Anwendung selbst verwendet.";
  if (SYSTEM.has(slug) || taken.has(slug)) return "Unter dieser Adresse gibt es schon eine Seite.";
  return null;
}

export function NewPageForm({ takenSlugs, siteHost }: { takenSlugs: string[]; siteHost: string }) {
  const [state, formAction] = useActionState(createPageAction, initialFormState);
  const [title, setTitle] = useState(state.values?.title ?? "");
  const [slug, setSlug] = useState(state.values?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const taken = new Set(takenSlugs);
  const effectiveSlug = slugTouched ? slug : slugify(title);
  const liveProblem = slugProblem(effectiveSlug, taken);
  const e = state.fieldErrors ?? {};
  const slugError = e.slug ?? liveProblem ?? undefined;
  const v = state.values;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Field
        label="Seitentitel"
        htmlFor="new-title"
        error={e.title}
        hint="Erscheint als Überschrift, im Browser-Tab und in Suchergebnissen, z. B. „Stellenangebote“."
      >
        <Input
          id="new-title"
          name="title"
          value={title}
          maxLength={120}
          required
          autoFocus
          aria-invalid={e.title ? true : undefined}
          aria-describedby={e.title ? "new-title-error" : "new-title-hint"}
          onChange={(ev) => setTitle(ev.target.value)}
        />
      </Field>

      <Field
        label="Adresse"
        htmlFor="new-slug"
        error={slugError}
        hint="Wird aus dem Titel vorgeschlagen. Nur Kleinbuchstaben, Ziffern und Bindestriche – Umlaute werden zu ae, oe, ue."
      >
        <div className="flex items-stretch overflow-hidden rounded-xl border border-line-strong bg-white focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-200/70">
          <span className="flex items-center border-r border-line bg-mist px-3 text-sm whitespace-nowrap text-ink-muted">{siteHost}/</span>
          <input
            id="new-slug"
            name="slug"
            value={effectiveSlug}
            maxLength={60}
            required
            autoCapitalize="off"
            spellCheck={false}
            aria-invalid={slugError ? true : undefined}
            aria-describedby={slugError ? "new-slug-error" : "new-slug-hint"}
            onChange={(ev) => {
              setSlugTouched(true);
              setSlug(ev.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
            className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-[0.9375rem] text-ink focus:outline-none"
          />
        </div>
      </Field>
      {slugTouched && title ? (
        <button
          type="button"
          className="-mt-3 text-sm font-semibold text-brand-700 underline underline-offset-2"
          onClick={() => setSlugTouched(false)}
        >
          Adresse wieder aus dem Titel vorschlagen
        </button>
      ) : null}

      <Field
        label="Bezeichnung im Menü"
        htmlFor="new-navLabel"
        optional
        error={e.navLabel}
        hint="Kurzform für Menü und Footer. Leer lassen, um den Seitentitel zu verwenden."
      >
        <Input
          id="new-navLabel"
          name="navLabel"
          defaultValue={v?.navLabel ?? ""}
          maxLength={40}
          aria-describedby={e.navLabel ? "new-navLabel-error" : "new-navLabel-hint"}
        />
      </Field>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold text-ink">Verlinken im …</legend>
        <Checkbox name="showInNav" label="Hauptmenü" hint="Oben in der Kopfzeile der Website." defaultChecked={v?.showInNav === "on"} />
        <Checkbox
          name="showInFooter"
          label="Footer"
          hint="Unten auf jeder Seite. Passend z. B. für AGB oder Stellenangebote."
          defaultChecked={v?.showInFooter === "on"}
        />
      </fieldset>

      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100 ring-inset">
        Die Seite wird mit einem Kopfbereich und einem Textabschnitt angelegt und ist erst nach dem Veröffentlichen auf der Website zu
        sehen.
      </p>

      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingText="Wird angelegt …" disabled={!title.trim() || !!liveProblem || !effectiveSlug}>
          Seite anlegen und bearbeiten
        </SubmitButton>
        <ButtonLink href="/admin/website" variant="secondary">
          Abbrechen
        </ButtonLink>
      </div>
    </form>
  );
}

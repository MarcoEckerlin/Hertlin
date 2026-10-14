"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { site } from "@/config/site";
import { initialFormState, type FormState } from "@/lib/forms";
import { submitPrivateTicketAction } from "@/lib/actions/public";
import { ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { AttachmentInput, type UploadRules } from "@/components/forms/attachment-input";
import { FormSection, Honeypot, PrivacyConsent, a11yProps } from "@/components/forms/controls";
import { PRIVATE_CATEGORY_LABELS, PRIVATE_TICKET_CATEGORIES } from "@/components/forms/form-options";
import { useFormFeedback } from "@/components/forms/use-form-feedback";

const ID = "hilfe";

const DESCRIPTION_PLACEHOLDER = [
  "Was ist passiert und seit wann?",
  "Gibt es eine Fehlermeldung? Am besten wörtlich abschreiben.",
  "Um welches Gerät geht es (z. B. Windows-Notebook, iPad, FritzBox)?",
].join("\n");

export function PrivateSupportFormClient({ uploadRules }: { uploadRules: UploadRules }) {
  const [state, action] = useActionState(submitPrivateTicketAction, initialFormState);
  const { formRef, successRef } = useFormFeedback(state);

  if (state.status === "success") {
    return <PrivateSupportSuccess state={state} boxRef={successRef} />;
  }

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={action} noValidate className="relative space-y-7">
      <Honeypot idPrefix={ID} />
      <FormMessage state={state} />
      <p className="text-sm text-ink-muted">Felder ohne den Zusatz „optional“ brauchen wir für die Bearbeitung.</p>

      <FormSection id={`${ID}-problem`} title="Was ist passiert?" first>
        <Field label="Worum geht es?" htmlFor={`${ID}-category`} error={errors.category}>
          <Select {...a11yProps(`${ID}-category`, errors.category)} name="category" defaultValue={values.category ?? ""}>
            <option value="" disabled>
              Bitte auswählen
            </option>
            {PRIVATE_TICKET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PRIVATE_CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Betreff" htmlFor={`${ID}-subject`} error={errors.subject}>
          <Input
            {...a11yProps(`${ID}-subject`, errors.subject)}
            name="subject"
            maxLength={150}
            placeholder="z. B. Drucker druckt nur noch leere Seiten"
            defaultValue={values.subject}
          />
        </Field>

        <Field
          label="Beschreibung"
          htmlFor={`${ID}-description`}
          hint="Je genauer Sie es beschreiben, desto eher können wir per Fernwartung helfen, ohne vorbeizukommen."
          error={errors.description}
        >
          <Textarea
            {...a11yProps(`${ID}-description`, errors.description, true)}
            name="description"
            rows={7}
            maxLength={5000}
            placeholder={DESCRIPTION_PLACEHOLDER}
            defaultValue={values.description}
          />
        </Field>

        <AttachmentInput
          id={`${ID}-attachments`}
          label="Fotos oder Screenshots"
          hint="Ein Foto der Fehlermeldung sagt oft mehr als eine lange Beschreibung."
          error={errors.attachments}
          rules={uploadRules}
        />
      </FormSection>

      <FormSection id={`${ID}-kontakt`} title="Wie erreichen wir Sie?">
        <Field label="Ihr Name" htmlFor={`${ID}-name`} error={errors.name}>
          <Input
            {...a11yProps(`${ID}-name`, errors.name)}
            name="name"
            autoComplete="name"
            maxLength={120}
            defaultValue={values.name}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="E-Mail-Adresse"
            htmlFor={`${ID}-email`}
            hint="Hierhin schicken wir die Bestätigung und Ihren Status-Link."
            error={errors.email}
          >
            <Input
              {...a11yProps(`${ID}-email`, errors.email, true)}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              defaultValue={values.email}
            />
          </Field>
          <Field
            label="Telefon"
            htmlFor={`${ID}-phone`}
            hint="Für Rückfragen rufen wir meistens kurz an."
            error={errors.phone}
          >
            <Input
              {...a11yProps(`${ID}-phone`, errors.phone, true)}
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={40}
              defaultValue={values.phone}
            />
          </Field>
        </div>

        <Field
          label="Anschrift"
          htmlFor={`${ID}-address`}
          optional
          hint="Nur nötig, wenn wir zu Ihnen nach Hause kommen sollen."
          error={errors.address}
        >
          <Input
            {...a11yProps(`${ID}-address`, errors.address, true)}
            name="address"
            autoComplete="street-address"
            maxLength={300}
            placeholder="Straße und Hausnummer, PLZ, Ort"
            defaultValue={values.address}
          />
        </Field>

        <Field
          label="Wann erreichen wir Sie am besten?"
          htmlFor={`${ID}-availability`}
          optional
          error={errors.availability}
        >
          <Input
            {...a11yProps(`${ID}-availability`, errors.availability)}
            name="availability"
            maxLength={200}
            placeholder="z. B. werktags ab 17:00 Uhr oder Dienstagvormittag"
            defaultValue={values.availability}
          />
        </Field>
      </FormSection>

      <div className="space-y-6 border-t border-line pt-7">
        <PrivacyConsent idPrefix={ID} state={state} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <SubmitButton size="lg" pendingText="Wird gesendet …" className="w-full sm:w-auto">
            Anfrage absenden
          </SubmitButton>
          <p className="text-sm text-ink-muted">Sie bekommen sofort eine Ticketnummer.</p>
        </div>
      </div>
    </form>
  );
}

function PrivateSupportSuccess({ state, boxRef }: { state: FormState; boxRef: React.Ref<HTMLDivElement> }) {
  const data = state.data ?? {};

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      className="scroll-mt-28 rounded-3xl border border-brand-200 bg-brand-50 p-6 focus:outline-none sm:p-8"
    >
      <CircleCheck className="size-8 text-brand-600" aria-hidden />
      <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink">Danke, wir haben Ihre Anfrage.</h3>
      {data.number ? (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
          Ihre Ticketnummer lautet <strong className="font-semibold text-ink">{data.number}</strong>.
          {data.email ? (
            <>
              {" "}
              Die Bestätigung mit Ihrem Status-Link ist unterwegs an{" "}
              <span className="font-semibold break-all text-ink">{data.email}</span>.
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
          Wir melden uns in der Regel innerhalb eines Werktags bei Ihnen.
        </p>
      )}

      {data.statusUrl && data.statusPath ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-5">
          <p className="font-semibold text-ink">Ihr persönlicher Status-Link</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Darüber sehen Sie jederzeit, wie weit wir sind, können uns antworten und Fotos nachreichen. Speichern Sie ihn
            am besten als Lesezeichen.
          </p>
          <p className="mt-3 rounded-xl bg-mist px-3.5 py-2.5 font-mono text-sm break-all text-ink">{data.statusUrl}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={data.statusPath} size="sm">
              Status ansehen
            </ButtonLink>
            <CopyButton value={data.statusUrl} label="Link kopieren" />
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            Bitte geben Sie den Link nicht weiter: Wer ihn kennt, kann Ihre Anfrage lesen und darauf antworten.
          </p>
        </div>
      ) : null}

      {data.number ? (
        <p className="mt-6 text-[0.9375rem] leading-relaxed text-ink-soft">
          Wir sehen uns Ihr Anliegen an und melden uns in der Regel innerhalb eines Werktags, meistens mit einem kurzen
          Anruf. Es eilt?{" "}
          <a href={`tel:${site.phoneHref}`} className="font-semibold whitespace-nowrap text-brand-700 hover:underline">
            {site.phone}
          </a>
        </p>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CircleCheck, MessagesSquare } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/forms";
import { WORKPLACE_LABELS, WORKPLACE_RANGES, type CustomerType, type InquiryTopic } from "@/lib/constants";
import { submitInquiryAction } from "@/lib/actions/public";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormSection, Honeypot, PrivacyConsent, SegmentedControl, a11yProps } from "@/components/forms/controls";
import { inquiryTopicLabel, inquiryTopicsFor } from "@/components/forms/form-options";
import { useFormFeedback } from "@/components/forms/use-form-feedback";

const ID = "anfrage";

const CUSTOMER_TYPE_OPTIONS = [
  { value: "BUSINESS", label: "Unternehmen" },
  { value: "PRIVATE", label: "Privatperson" },
] as const;

const CONTACT_OPTIONS = [
  { value: "EMAIL", label: "Per E-Mail" },
  { value: "PHONE", label: "Telefonisch" },
] as const;

type ContactPreference = (typeof CONTACT_OPTIONS)[number]["value"];

const MESSAGE_PLACEHOLDER: Record<CustomerType, string> = {
  BUSINESS:
    "z. B. Wir sind acht Leute im Büro. Bisher kümmert sich ein Kollege nebenbei um die IT, das klappt nicht mehr. Wir suchen jemanden für Wartung, Datensicherung und Hilfe, wenn etwas nicht geht.",
  PRIVATE:
    "z. B. Ich bekomme ein neues Notebook und möchte, dass Fotos, E-Mails und der Drucker vom alten Rechner übernommen werden.",
};

const MESSAGE_HINT: Record<CustomerType, string> = {
  BUSINESS: "Stichpunkte reichen. Hilfreich ist: was vorhanden ist, was gerade nicht gut läuft und bis wann etwas fertig sein soll.",
  PRIVATE: "Stichpunkte reichen. Schreiben Sie kurz, um welche Geräte es geht und was Sie sich wünschen.",
};

/**
 * Anfrageformular für Neukunden (Unternehmen oder Privatpersonen).
 * defaultType/defaultTopic kommen aus ?typ= und ?thema= der Kontaktseite.
 */
export function InquiryForm({
  defaultType,
  defaultTopic,
  contact,
}: {
  defaultType?: CustomerType;
  defaultTopic?: InquiryTopic;
  contact: { phone: string; phoneHref: string };
}) {
  const [state, action] = useActionState(submitInquiryAction, initialFormState);
  const { formRef, successRef, formKey } = useFormFeedback(state);
  const [customerType, setCustomerType] = useState<CustomerType>(defaultType ?? "BUSINESS");
  const [contactPreference, setContactPreference] = useState<ContactPreference>("EMAIL");

  if (state.status === "success") {
    return <InquirySuccess state={state} boxRef={successRef} contact={contact} />;
  }

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const isBusiness = customerType === "BUSINESS";
  const phoneRequired = contactPreference === "PHONE";

  const topics = inquiryTopicsFor(customerType);
  const presetTopic = values.topic ?? defaultTopic;
  const topicDefault =
    presetTopic && (topics as readonly string[]).includes(presetTopic) ? presetTopic : isBusiness ? "" : "PRIVAT_HILFE";

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="relative space-y-7">
      <Honeypot idPrefix={ID} />
      <FormMessage state={state} />

      <FormSection id={`${ID}-wer`} title="Wer fragt an?" first>
        <SegmentedControl
          id={`${ID}-customerType`}
          name="customerType"
          legend="Sie fragen an als"
          options={CUSTOMER_TYPE_OPTIONS}
          defaultValue={customerType}
          onChange={setCustomerType}
          error={errors.customerType}
        />

        {!isBusiness ? (
          <Alert tone="info" title="Ihr Gerät streikt gerade?">
            Dann nutzen Sie besser das{" "}
            <Link href="/privatkunden#hilfe-anfordern" className="font-semibold underline underline-offset-2">
              Hilfe-Formular für Privatkunden
            </Link>
            . Dort bekommt Ihr Problem sofort eine Ticketnummer, und Sie sehen jederzeit, wie weit wir sind.
          </Alert>
        ) : null}

        <Field label="Ihr Name" htmlFor={`${ID}-name`} error={errors.name}>
          <Input
            {...a11yProps(`${ID}-name`, errors.name)}
            name="name"
            autoComplete="name"
            maxLength={120}
            defaultValue={values.name}
          />
        </Field>

        {/* Bleibt beim Wechsel auf „Privatperson“ erhalten, wird dann aber nicht mitgeschickt. */}
        <fieldset disabled={!isBusiness} hidden={!isBusiness} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <Field label="Firma" htmlFor={`${ID}-companyName`} error={errors.companyName}>
            <Input
              {...a11yProps(`${ID}-companyName`, errors.companyName)}
              name="companyName"
              autoComplete="organization"
              maxLength={160}
              defaultValue={values.companyName}
            />
          </Field>
          <Field
            label="Anzahl Arbeitsplätze"
            htmlFor={`${ID}-workplaces`}
            optional
            hint="Eine grobe Schätzung reicht."
            error={errors.workplaces}
          >
            <Select
              {...a11yProps(`${ID}-workplaces`, errors.workplaces, true)}
              name="workplaces"
              defaultValue={values.workplaces ?? ""}
            >
              <option value="">Bitte auswählen</option>
              {WORKPLACE_RANGES.map((range) => (
                <option key={range} value={range}>
                  {WORKPLACE_LABELS[range]}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>
      </FormSection>

      <FormSection id={`${ID}-kontakt`} title="Wie erreichen wir Sie?">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="E-Mail-Adresse" htmlFor={`${ID}-email`} error={errors.email}>
            <Input
              {...a11yProps(`${ID}-email`, errors.email)}
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
            optional={!phoneRequired}
            hint={phoneRequired ? "Unter dieser Nummer rufen wir Sie zurück." : "Für kurze Rückfragen."}
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
          label="PLZ und Ort"
          htmlFor={`${ID}-zipCity`}
          optional
          hint="Damit wir einschätzen können, ob wir für Termine zu Ihnen kommen."
          error={errors.zipCity}
          className="sm:max-w-sm"
        >
          <Input
            {...a11yProps(`${ID}-zipCity`, errors.zipCity, true)}
            name="zipCity"
            autoComplete="off"
            maxLength={120}
            placeholder="z. B. 12345 Musterstadt"
            defaultValue={values.zipCity}
          />
        </Field>

        <SegmentedControl
          id={`${ID}-preferredContact`}
          name="preferredContact"
          legend="Wie sollen wir uns melden?"
          options={CONTACT_OPTIONS}
          defaultValue={contactPreference}
          onChange={setContactPreference}
          error={errors.preferredContact}
        />
      </FormSection>

      <FormSection id={`${ID}-anliegen`} title="Worum geht es?">
        <Field label="Thema" htmlFor={`${ID}-topic`} error={errors.topic}>
          {/* Neu aufbauen, wenn sich der Kundentyp ändert – die Themenliste ist eine andere. */}
          <Select key={customerType} {...a11yProps(`${ID}-topic`, errors.topic)} name="topic" defaultValue={topicDefault}>
            {isBusiness ? (
              <option value="" disabled>
                Bitte auswählen
              </option>
            ) : null}
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {inquiryTopicLabel(topic, customerType)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ihre Nachricht" htmlFor={`${ID}-message`} hint={MESSAGE_HINT[customerType]} error={errors.message}>
          <Textarea
            {...a11yProps(`${ID}-message`, errors.message, true)}
            name="message"
            rows={7}
            maxLength={5000}
            placeholder={MESSAGE_PLACEHOLDER[customerType]}
            defaultValue={values.message}
          />
        </Field>
      </FormSection>

      <div className="space-y-6 border-t border-line pt-7">
        <PrivacyConsent idPrefix={ID} state={state} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <SubmitButton size="lg" pendingText="Wird gesendet …" className="w-full sm:w-auto">
            Anfrage senden
          </SubmitButton>
          <p className="text-sm text-ink-muted">Sie bekommen sofort eine Bestätigung per E-Mail.</p>
        </div>
      </div>
    </form>
  );
}

function InquirySuccess({
  state,
  boxRef,
  contact,
}: {
  state: FormState;
  boxRef: React.Ref<HTMLDivElement>;
  contact: { phone: string; phoneHref: string };
}) {
  const data = state.data ?? {};
  const isBusiness = data.customerType === "BUSINESS";
  const byPhone = data.preferredContact === "PHONE";
  const chatHref = data.chatPath ?? data.chatUrl;

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      className="scroll-mt-28 rounded-3xl border border-brand-200 bg-brand-50 p-6 focus:outline-none sm:p-8"
    >
      <CircleCheck className="size-8 text-brand-600" aria-hidden />
      <h3 className="mt-4 text-2xl font-bold tracking-tight text-ink">Danke, Ihre Anfrage ist angekommen.</h3>
      {data.number ? (
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">
          Sie hat die Nummer <strong className="font-semibold text-ink">{data.number}</strong>. Wenn Sie uns anrufen, hilft
          uns die Nummer, Ihre Anfrage schnell zu finden.
        </p>
      ) : null}

      {chatHref ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <MessagesSquare className="size-4 shrink-0 text-brand-700" aria-hidden />
            Ihr persönlicher Chat zur Anfrage
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Dort können Sie uns jederzeit schreiben, Fragen nachreichen und unsere Antworten lesen – ohne Konto. Sind wir
            gerade im Chat, antworten wir sofort. Den Link schicken wir Ihnen auch per E-Mail.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={chatHref} size="sm">
              Chat öffnen
            </ButtonLink>
            {data.chatUrl ? <CopyButton value={data.chatUrl} label="Link kopieren" /> : null}
          </div>
          <p className="mt-4 text-sm text-ink-muted">
            Bitte geben Sie den Link nicht weiter: Wer ihn kennt, kann den Chat lesen und darin schreiben.
          </p>
        </div>
      ) : null}

      <h4 className="mt-6 text-sm font-bold text-ink">So geht es weiter</h4>
      <ol className="mt-2 space-y-2 text-[0.9375rem] leading-relaxed text-ink-soft">
        {data.email ? (
          <li className="flex gap-3">
            <StepNumber n={1} />
            <span>
              {chatHref ? "Eine Bestätigung mit dem Link zu Ihrem Chat" : "Eine Bestätigung"} ist unterwegs an{" "}
              <span className="font-semibold break-all text-ink">{data.email}</span>.
            </span>
          </li>
        ) : null}
        <li className="flex gap-3">
          <StepNumber n={data.email ? 2 : 1} />
          <span>
            In der Regel melden wir uns innerhalb eines Werktags {byPhone ? "telefonisch" : "per E-Mail"} bei Ihnen.
          </span>
        </li>
        <li className="flex gap-3">
          <StepNumber n={data.email ? 3 : 2} />
          <span>
            {isBusiness
              ? "Meistens schlagen wir dabei einen Termin für ein erstes Gespräch vor. Dort klären wir, was vorhanden ist und was Sie brauchen."
              : "Wir klären mit Ihnen, ob wir aus der Ferne helfen können oder besser vorbeikommen, und nennen Ihnen vorher die Kosten."}
          </span>
        </li>
      </ol>

      <p className="mt-6 text-sm text-ink-soft">
        Es eilt? Rufen Sie uns an:{" "}
        <a href={`tel:${contact.phoneHref}`} className="font-semibold text-brand-700 hover:underline">
          {contact.phone}
        </a>
      </p>
      <div className="mt-6">
        <ButtonLink href="/" variant="secondary">
          Zur Startseite
        </ButtonLink>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold text-brand-700 ring-1 ring-brand-200"
      aria-hidden
    >
      {n}
    </span>
  );
}

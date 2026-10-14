"use client";

import { useActionState, useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { saveBillingSettingsAction } from "@/lib/actions/admin-invoices";
import { initialFormState } from "@/lib/forms";
import { INVOICE_PLACEHOLDERS, formatInvoiceNumber, isValidIban, normalizeIban } from "@/lib/invoices/calc";

export type BillingSettingsFormValues = {
  taxNumber: string;
  smallBusiness: boolean;
  /** „19“ */
  taxRate: string;
  paymentTermDays: string;
  numberPrefix: string;
  bankAccountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
  introText: string;
  paymentNote: string;
  emailSubject: string;
  emailText: string;
  bccEmail: string;
};

function PlaceholderList() {
  return (
    <details className="rounded-xl bg-mist px-4 py-3 text-sm text-ink-soft">
      <summary className="cursor-pointer font-semibold text-ink">Platzhalter für die Texte</summary>
      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr]">
        {Object.entries(INVOICE_PLACEHOLDERS).map(([key, label]) => (
          <div key={key} className="contents">
            <dt className="font-mono text-xs leading-5 text-ink">{`{${key}}`}</dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** Rechnungseinstellungen: Steuer, Nummern, Bankverbindung, Texte und E-Mail. Nur für Administratoren. */
export function BillingSettingsForm({
  initial,
  year,
  issuerName,
}: {
  initial: BillingSettingsFormValues;
  /** Aktuelles Jahr für das Nummernbeispiel */
  year: number;
  /** Firmierung aus den Firmendaten (Vorschlag für den Kontoinhaber) */
  issuerName: string;
}) {
  const [state, formAction] = useActionState(saveBillingSettingsAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const sv = state.values;
  const v = (key: Exclude<keyof BillingSettingsFormValues, "smallBusiness">) => sv?.[key] ?? initial[key];

  const [prefix, setPrefix] = useState(v("numberPrefix"));
  const [iban, setIban] = useState(v("iban"));
  const [smallBusiness, setSmallBusiness] = useState(sv ? sv.smallBusiness === "on" : initial.smallBusiness);

  const ibanOk = iban.trim() !== "" && isValidIban(iban);
  const ibanHint = iban.trim() === "" ? "Ohne IBAN können keine Rechnungen erstellt werden." : ibanOk ? "Prüfziffer stimmt." : undefined;
  const examplePrefix = /^[A-Za-z0-9]{1,8}$/.test(prefix.trim()) ? prefix.trim().toUpperCase() : "RE";

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-6">
      <FormMessage state={state} />

      <Card>
        <CardHeader title="Steuer" description="Auf jeder Rechnung muss Ihre Steuernummer oder Ihre USt-IdNr. stehen." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Steuernummer"
            htmlFor="billing-taxNumber"
            error={errors.taxNumber}
            optional
            hint="Vom Finanzamt, z. B. 12/345/67890. Die USt-IdNr. pflegen Sie in den Firmendaten."
          >
            <Input
              {...fieldProps("billing-taxNumber", errors.taxNumber, true)}
              name="taxNumber"
              maxLength={40}
              autoComplete="off"
              defaultValue={v("taxNumber")}
            />
          </Field>
          <Field
            label="Umsatzsteuersatz (%)"
            htmlFor="billing-taxRate"
            error={errors.taxRate}
            hint={smallBusiness ? "Wird als Kleinunternehmer nicht berechnet." : "Regelsatz 19 %."}
          >
            <Input
              {...fieldProps("billing-taxRate", errors.taxRate, true)}
              name="taxRate"
              inputMode="decimal"
              maxLength={6}
              autoComplete="off"
              defaultValue={v("taxRate")}
              className="max-w-32"
            />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox
              name="smallBusiness"
              checked={smallBusiness}
              onChange={(e) => setSmallBusiness(e.currentTarget.checked)}
              label="Kleinunternehmer nach § 19 UStG"
              hint="Dann weisen Rechnungen keine Umsatzsteuer aus und tragen den Hinweis „Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.“"
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Nummern und Zahlungsziel"
          description="Rechnungsnummern laufen je Jahr fortlaufend und lückenlos. Rechnungen werden nie gelöscht, nur storniert."
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Kürzel vor der Nummer"
            htmlFor="billing-numberPrefix"
            error={errors.numberPrefix}
            hint={`Nächste Rechnung z. B. ${formatInvoiceNumber(examplePrefix, year, 1)}`}
          >
            <Input
              {...fieldProps("billing-numberPrefix", errors.numberPrefix, true)}
              name="numberPrefix"
              maxLength={8}
              autoComplete="off"
              value={prefix}
              onChange={(e) => setPrefix(e.currentTarget.value.toUpperCase())}
              className="max-w-40 uppercase"
            />
          </Field>
          <Field
            label="Zahlungsziel in Tagen"
            htmlFor="billing-paymentTermDays"
            error={errors.paymentTermDays}
            hint="Ab Rechnungsdatum. 0 = sofort fällig."
          >
            <Input
              {...fieldProps("billing-paymentTermDays", errors.paymentTermDays, true)}
              name="paymentTermDays"
              type="number"
              min={0}
              max={365}
              inputMode="numeric"
              defaultValue={v("paymentTermDays")}
              className="max-w-32"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Bankverbindung" description="Steht in der Fußzeile jeder Rechnung." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Kontoinhaber"
            htmlFor="billing-bankAccountHolder"
            error={errors.bankAccountHolder}
            optional
            hint={issuerName ? `Leer = ${issuerName}` : undefined}
          >
            <Input
              {...fieldProps("billing-bankAccountHolder", errors.bankAccountHolder, Boolean(issuerName))}
              name="bankAccountHolder"
              maxLength={120}
              autoComplete="off"
              defaultValue={v("bankAccountHolder")}
            />
          </Field>
          <Field label="Bank" htmlFor="billing-bankName" error={errors.bankName} optional>
            <Input
              {...fieldProps("billing-bankName", errors.bankName)}
              name="bankName"
              maxLength={120}
              autoComplete="off"
              defaultValue={v("bankName")}
            />
          </Field>
          <Field label="IBAN" htmlFor="billing-iban" error={errors.iban} hint={ibanHint}>
            <Input
              {...fieldProps("billing-iban", errors.iban, Boolean(ibanHint))}
              name="iban"
              maxLength={42}
              autoComplete="off"
              spellCheck={false}
              value={iban}
              onChange={(e) => setIban(e.currentTarget.value)}
              onBlur={() => {
                if (isValidIban(iban)) setIban(normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim());
              }}
              className="font-mono"
            />
          </Field>
          <Field label="BIC" htmlFor="billing-bic" error={errors.bic} optional>
            <Input
              {...fieldProps("billing-bic", errors.bic)}
              name="bic"
              maxLength={11}
              autoComplete="off"
              spellCheck={false}
              defaultValue={v("bic")}
              className="max-w-48 font-mono uppercase"
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Texte auf der Rechnung" />
        <CardBody className="space-y-5">
          <Field
            label="Einleitung"
            htmlFor="billing-introText"
            error={errors.introText}
            optional
            hint="Steht über den Positionen. Lässt sich beim Erstellen einer Rechnung anpassen."
          >
            <Textarea
              {...fieldProps("billing-introText", errors.introText, true)}
              name="introText"
              rows={2}
              maxLength={1000}
              defaultValue={v("introText")}
            />
          </Field>
          <Field
            label="Zahlungshinweis"
            htmlFor="billing-paymentNote"
            error={errors.paymentNote}
            optional
            hint="Steht unter den Summen, z. B. „Bitte überweisen Sie {betrag} bis zum {faellig} …“"
          >
            <Textarea
              {...fieldProps("billing-paymentNote", errors.paymentNote, true)}
              name="paymentNote"
              rows={3}
              maxLength={1000}
              defaultValue={v("paymentNote")}
            />
          </Field>
          <PlaceholderList />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="E-Mail an den Kunden"
          description="Vorlage für „Per E-Mail senden“. Das PDF hängt automatisch an; vor dem Senden können Sie den Text noch ändern."
        />
        <CardBody className="space-y-5">
          <Field label="Betreff" htmlFor="billing-emailSubject" error={errors.emailSubject}>
            <Input
              {...fieldProps("billing-emailSubject", errors.emailSubject)}
              name="emailSubject"
              maxLength={200}
              autoComplete="off"
              defaultValue={v("emailSubject")}
            />
          </Field>
          <Field label="Text" htmlFor="billing-emailText" error={errors.emailText}>
            <Textarea
              {...fieldProps("billing-emailText", errors.emailText)}
              name="emailText"
              rows={9}
              maxLength={4000}
              defaultValue={v("emailText")}
            />
          </Field>
          <Field
            label="Kopie an (BCC)"
            htmlFor="billing-bccEmail"
            error={errors.bccEmail}
            optional
            hint="Jede Rechnungs-E-Mail geht als Blindkopie auch an diese Adresse, z. B. an Ihre Buchhaltung."
          >
            <Input
              {...fieldProps("billing-bccEmail", errors.bccEmail, true)}
              name="bccEmail"
              type="email"
              maxLength={200}
              autoComplete="off"
              defaultValue={v("bccEmail")}
            />
          </Field>
          <PlaceholderList />
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Wird gespeichert …">Einstellungen speichern</SubmitButton>
      </div>
    </form>
  );
}

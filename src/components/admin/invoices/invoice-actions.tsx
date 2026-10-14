"use client";

import { useActionState, useState } from "react";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { cancelInvoiceAction, invoicePaymentAction, sendInvoiceAction } from "@/lib/actions/admin-invoices";
import { initialFormState } from "@/lib/forms";

/** Formulare auf der Rechnungsseite: senden, Zahlung, Storno. Nur für Administratoren. */

export function InvoiceSendForm({
  invoiceId,
  defaultTo,
  defaultSubject,
  defaultText,
  alreadySent,
  attachmentName,
}: {
  invoiceId: string;
  defaultTo: string;
  defaultSubject: string;
  defaultText: string;
  alreadySent: boolean;
  attachmentName: string;
}) {
  const [state, formAction] = useActionState(sendInvoiceAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const values = state.values;
  const [showText, setShowText] = useState(false);

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="id" value={invoiceId} />
      <FormMessage state={state} />
      <Field label="An" htmlFor="send-to" error={errors.to}>
        <Input
          {...fieldProps("send-to", errors.to)}
          name="to"
          type="email"
          maxLength={200}
          autoComplete="off"
          defaultValue={values?.to ?? defaultTo}
        />
      </Field>
      <Field label="Betreff" htmlFor="send-subject" error={errors.subject}>
        <Input
          {...fieldProps("send-subject", errors.subject)}
          name="subject"
          maxLength={200}
          autoComplete="off"
          defaultValue={values?.subject ?? defaultSubject}
        />
      </Field>
      {/* Text standardmäßig eingeklappt, damit die Seite übersichtlich bleibt; Fehler klappen ihn auf */}
      <div className={showText || errors.text ? "" : "hidden"}>
        <Field label="Text" htmlFor="send-text" error={errors.text}>
          <Textarea
            {...fieldProps("send-text", errors.text)}
            name="text"
            rows={10}
            maxLength={8000}
            defaultValue={values?.text ?? defaultText}
          />
        </Field>
      </div>
      {!showText && !errors.text ? (
        <button
          type="button"
          className="text-sm font-semibold text-brand-700 hover:underline"
          onClick={() => setShowText(true)}
          aria-controls="send-text"
        >
          Text der E-Mail ansehen und ändern
        </button>
      ) : null}
      <p className="text-xs text-ink-muted">Anhang: {attachmentName}</p>
      <SubmitButton pendingText="Wird gesendet …" className="w-full sm:w-auto">
        {alreadySent ? "Erneut senden" : "Per E-Mail senden"}
      </SubmitButton>
    </form>
  );
}

/**
 * Zahlungseingang festhalten bzw. zurücknehmen. Bleibt beim Umschalten dieselbe Komponente,
 * damit die Bestätigung sichtbar bleibt.
 */
export function InvoicePaymentForm({
  invoiceId,
  paid,
  today,
  issueDate,
}: {
  invoiceId: string;
  paid: boolean;
  today: string;
  issueDate: string;
}) {
  const [state, formAction] = useActionState(invoicePaymentAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="id" value={invoiceId} />
      <input type="hidden" name="intent" value={paid ? "unpaid" : "paid"} />
      <FormMessage state={state} />
      {paid ? (
        <SubmitButton variant="ghost" size="sm" pendingText="Wird gespeichert …">
          Zahlung zurücknehmen
        </SubmitButton>
      ) : (
        <>
          <Field label="Zahlungseingang am" htmlFor="paid-at" error={errors.paidAt}>
            <Input
              {...fieldProps("paid-at", errors.paidAt)}
              name="paidAt"
              type="date"
              min={issueDate}
              max={today}
              defaultValue={state.values?.paidAt ?? today}
              className="w-44"
            />
          </Field>
          <SubmitButton variant="secondary" pendingText="Wird gespeichert …">
            Als bezahlt markieren
          </SubmitButton>
        </>
      )}
    </form>
  );
}

export function InvoiceCancelForm({ invoiceId, number, paid }: { invoiceId: string; number: string; paid: boolean }) {
  const [state, formAction] = useActionState(cancelInvoiceAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="id" value={invoiceId} />
      <FormMessage state={state} />
      <div>
        <Checkbox
          name="confirm"
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={errors.confirm ? "cancel-confirm-error" : undefined}
          label={`Stornorechnung zu ${number} erstellen`}
          hint={
            paid
              ? "Die Rechnung ist bereits bezahlt – eine Rückzahlung veranlassen Sie bitte selbst."
              : "Die Positionen sind danach wieder offen und können neu abgerechnet werden."
          }
        />
        {errors.confirm ? (
          <p id="cancel-confirm-error" className="mt-1.5 text-sm font-medium text-danger-ink">
            {errors.confirm}
          </p>
        ) : null}
      </div>
      <SubmitButton variant="danger" pendingText="Wird storniert …">
        Rechnung stornieren
      </SubmitButton>
    </form>
  );
}

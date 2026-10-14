"use client";

import { useActionState, useState } from "react";
import { Field, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldProps, useFormFocus } from "@/components/admin/companies/form-helpers";
import { updateInquiryAction } from "@/lib/actions/admin-inquiries";
import { INQUIRY_STATUSES, INQUIRY_STATUS_LABELS } from "@/lib/constants";
import { initialFormState } from "@/lib/forms";

const STATUS_HINTS: Record<string, string> = {
  NEW: "Noch niemand hat sich gemeldet.",
  CONTACTED: "Erstes Gespräch oder erste Antwort ist erfolgt.",
  OFFER_SENT: "Ein Angebot liegt beim Interessenten.",
  WON: "Der Auftrag ist erteilt.",
  LOST: "Es kommt kein Auftrag zustande.",
};

/** Status und interne Notiz einer Anfrage (für alle Mitarbeiter). */
export function InquiryUpdateForm({ id, status, internalNote }: { id: number; status: string; internalNote: string | null }) {
  const [state, formAction] = useActionState(updateInquiryAction, initialFormState);
  const formRef = useFormFocus(state);
  const errors = state.fieldErrors ?? {};
  const defaultStatus = state.values?.status ?? status;

  // Hinweis zum gewählten Status mitführen; nach dem Speichern auf den gespeicherten Wert zurücksetzen
  const [selected, setSelected] = useState(defaultStatus);
  const [prevDefault, setPrevDefault] = useState(defaultStatus);
  if (prevDefault !== defaultStatus) {
    setPrevDefault(defaultStatus);
    setSelected(defaultStatus);
  }

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <FormMessage state={state} />
      <Field label="Status" htmlFor="inquiry-status" error={errors.status} hint={STATUS_HINTS[selected]}>
        <Select
          {...fieldProps("inquiry-status", errors.status, true)}
          name="status"
          defaultValue={defaultStatus}
          onChange={(e) => setSelected(e.currentTarget.value)}
        >
          {INQUIRY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INQUIRY_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Interne Notiz"
        htmlFor="inquiry-note"
        error={errors.internalNote}
        hint="Nur für Hertlin sichtbar, z. B. „Termin vor Ort am 21.10. um 10:00 Uhr vereinbart“."
        optional
      >
        <Textarea
          {...fieldProps("inquiry-note", errors.internalNote, true)}
          name="internalNote"
          rows={5}
          maxLength={4000}
          defaultValue={state.values?.internalNote ?? internalNote ?? ""}
        />
      </Field>
      <SubmitButton variant="secondary" pendingText="Wird gespeichert …">
        Speichern
      </SubmitButton>
    </form>
  );
}

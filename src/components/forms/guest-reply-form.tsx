"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/forms";
import { replyAsGuestAction } from "@/lib/actions/public";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { AttachmentInput, type UploadRules } from "@/components/forms/attachment-input";
import { a11yProps } from "@/components/forms/controls";
import { useFormFeedback } from "@/components/forms/use-form-feedback";

const ID = "antwort";

const PLACEHOLDER: Record<string, string> = {
  WAITING_CUSTOMER: "Ihre Antwort auf unsere Rückfrage",
  RESOLVED: "Was funktioniert noch nicht? Beschreiben Sie kurz, was Ihnen aufgefallen ist.",
};

/**
 * Antwort eines Privatkunden über den Status-Link.
 * Das Token steckt im versteckten Feld und wird in der Action erneut geprüft.
 */
export function GuestReplyForm({ token, status, uploadRules }: { token: string; status: string; uploadRules: UploadRules }) {
  const [state, action] = useActionState(replyAsGuestAction, initialFormState);
  const { formRef } = useFormFeedback(state);
  const errors = state.fieldErrors ?? {};

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field label="Ihre Nachricht" htmlFor={`${ID}-body`} error={errors.body}>
        <Textarea
          {...a11yProps(`${ID}-body`, errors.body)}
          name="body"
          rows={5}
          maxLength={5000}
          placeholder={PLACEHOLDER[status] ?? "Schreiben Sie uns, was es Neues gibt oder was Sie wissen möchten."}
          defaultValue={state.status === "error" ? state.values?.body : undefined}
        />
      </Field>
      <AttachmentInput
        id={`${ID}-attachments`}
        label="Fotos oder Dateien"
        error={errors.attachments}
        rules={uploadRules}
      />
      <SubmitButton pendingText="Wird gesendet …" className="w-full sm:w-auto">
        Nachricht senden
      </SubmitButton>
    </form>
  );
}

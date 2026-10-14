"use client";

import { useActionState } from "react";
import { initialFormState } from "@/lib/forms";
import { replyPortalTicketAction } from "@/lib/actions/portal-tickets";
import { useTypingSignal } from "@/realtime/client";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { AttachmentInput, type UploadRules } from "@/components/forms/attachment-input";
import { fieldA11y, usePortalForm } from "@/components/portal/use-portal-form";

const ID = "antwort";

const PLACEHOLDER: Record<string, string> = {
  WAITING_CUSTOMER: "Ihre Antwort auf unsere Rückfrage",
  RESOLVED: "Was funktioniert noch nicht? Beschreiben Sie kurz, was Ihnen aufgefallen ist.",
};

const AFTER_SEND: Record<string, string> = {
  WAITING_CUSTOMER: "Mit Ihrer Antwort geht das Ticket zurück in die Bearbeitung.",
  RESOLVED: "Mit Ihrer Nachricht öffnen Sie das Ticket wieder.",
};

/** Antwort eines Portalbenutzers im Ticket. Die Ticket-ID prüft die Action erneut gegen den Sichtbereich. */
export function ReplyForm({ ticketId, status, uploadRules }: { ticketId: number; status: string; uploadRules: UploadRules }) {
  const [state, action] = useActionState(replyPortalTicketAction, initialFormState);
  const { formRef, formKey } = usePortalForm(state);
  const signalTyping = useTypingSignal(`ticket:${ticketId}`);
  const errors = state.fieldErrors ?? {};

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      <FormMessage state={state} />
      <Field label="Ihre Nachricht" htmlFor={`${ID}-body`} error={errors.body}>
        <Textarea
          {...fieldA11y(`${ID}-body`, errors.body)}
          name="body"
          rows={5}
          maxLength={10000}
          placeholder={PLACEHOLDER[status] ?? "Was gibt es Neues? Ergänzungen, Rückfragen oder ein kurzes „Danke, läuft wieder“."}
          defaultValue={state.status === "error" ? state.values?.body : undefined}
          onInput={signalTyping}
        />
      </Field>
      <AttachmentInput
        id={`${ID}-attachments`}
        label="Dateien anhängen"
        hint={`Screenshots, Fotos oder Protokolle. Erlaubt sind ${uploadRules.allowedLabel}.`}
        error={errors.attachments}
        rules={uploadRules}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <SubmitButton pendingText="Wird gesendet …" className="w-full sm:w-auto">
          Nachricht senden
        </SubmitButton>
        {AFTER_SEND[status] ? <p className="text-sm text-ink-muted">{AFTER_SEND[status]}</p> : null}
      </div>
    </form>
  );
}

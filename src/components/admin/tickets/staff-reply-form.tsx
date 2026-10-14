"use client";

import { useActionState, useState, type KeyboardEvent } from "react";
import { Lock, MessageSquare } from "lucide-react";
import { staffReplyAction } from "@/lib/actions/admin-tickets";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/cn";
import { STATUS_LABELS_STAFF, type TicketStatus } from "@/lib/constants";
import { useTypingSignal } from "@/realtime/client";
import { Field, Label, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { AttachmentInput, type UploadRules } from "@/components/forms/attachment-input";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";

type Mode = "reply" | "internal";

/** Statuswerte, die nach einer Antwort typischerweise gesetzt werden */
const AFTER_OPTIONS: TicketStatus[] = ["IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"];

/**
 * Antwort an den Kunden oder interne Notiz – mit deutlich sichtbarem Umschalter.
 * Die gewählte Art bleibt nach dem Absenden erhalten, damit eine zweite Notiz nicht
 * versehentlich als Antwort beim Kunden landet.
 */
export function StaffReplyForm({
  ticketId,
  status,
  recipient,
  customerChannel,
  uploadRules,
}: {
  ticketId: number;
  status: string;
  /** Empfänger der E-Mail-Benachrichtigung oder null */
  recipient: { name: string; email: string } | null;
  /** Wo der Kunde die Antwort sieht, z. B. „im Kundenportal“ oder „über seinen Status-Link“ */
  customerChannel: string;
  uploadRules: UploadRules;
}) {
  const [state, action] = useActionState(staffReplyAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const [mode, setMode] = useState<Mode>("reply");
  const internal = mode === "internal";
  const signalTyping = useTypingSignal(`ticket:${ticketId}`, internal);
  const errors = state.fieldErrors ?? {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  // Vorschlag „Status danach“: Antwort auf ein neues Ticket -> In Bearbeitung, sonst unverändert
  const suggested = internal ? status : status === "NEW" ? "IN_PROGRESS" : status;
  const options: string[] = AFTER_OPTIONS.includes(status as TicketStatus) ? AFTER_OPTIONS : [status, ...AFTER_OPTIONS];

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <section
      aria-labelledby="antwort-titel"
      className={cn(
        "rounded-2xl border shadow-card transition-colors",
        internal ? "border-amber-300 bg-amber-50/70" : "border-line bg-white",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 sm:px-6",
          internal ? "border-amber-200" : "border-line",
        )}
      >
        <h2 id="antwort-titel" className="text-base font-bold text-ink">
          {internal ? "Interne Notiz schreiben" : "Antwort schreiben"}
        </h2>
        <span className="hidden text-xs text-ink-muted sm:inline">Strg + Enter sendet ab</span>
      </div>

      <form key={formKey} ref={formRef} action={action} noValidate className="space-y-5 px-5 py-5 sm:px-6">
        <input type="hidden" name="ticketId" value={ticketId} />

        <fieldset>
          <legend className="sr-only">Art der Nachricht</legend>
          <div className="grid grid-cols-2 gap-1 rounded-full bg-mist p-1 ring-1 ring-line-strong ring-inset">
            <label className="relative block min-w-0 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="reply"
                checked={!internal}
                onChange={() => setMode("reply")}
                className="peer sr-only"
              />
              <span className="flex min-h-10 items-center justify-center gap-2 rounded-full px-3 py-2 text-center text-sm font-semibold text-ink-soft transition-colors peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-card peer-checked:ring-1 peer-checked:ring-brand-300 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:text-ink">
                <MessageSquare className="size-4 shrink-0" aria-hidden />
                Antwort an Kunden
              </span>
            </label>
            <label className="relative block min-w-0 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="internal"
                checked={internal}
                onChange={() => setMode("internal")}
                className="peer sr-only"
              />
              <span className="flex min-h-10 items-center justify-center gap-2 rounded-full px-3 py-2 text-center text-sm font-semibold text-ink-soft transition-colors peer-checked:bg-amber-200 peer-checked:text-amber-950 peer-checked:shadow-card peer-checked:ring-1 peer-checked:ring-amber-400 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:text-ink">
                <Lock className="size-4 shrink-0" aria-hidden />
                Interne Notiz
              </span>
            </label>
          </div>
          <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
            {internal ? (
              <>
                <span className="font-semibold text-amber-900">Nur für das Hertlin-Team sichtbar.</span> Es wird keine E-Mail
                verschickt.
              </>
            ) : recipient ? (
              <>
                Der Kunde sieht die Antwort {customerChannel} und bekommt eine E-Mail an{" "}
                <span className="font-semibold text-ink">{recipient.email}</span>.
              </>
            ) : (
              <>Der Kunde sieht die Antwort {customerChannel}. Eine E-Mail-Adresse ist nicht hinterlegt.</>
            )}
          </p>
        </fieldset>

        <FormMessage state={state} />

        <Field label={internal ? "Notiz" : "Nachricht"} htmlFor="antwort-body" error={errors.body}>
          <Textarea
            {...fieldA11y("antwort-body", errors.body)}
            name="body"
            rows={6}
            maxLength={10000}
            placeholder={
              internal
                ? "z. B. Ersatzteil bestellt, Lieferung Donnerstag. Kunde möchte vorher angerufen werden."
                : "Guten Tag …"
            }
            defaultValue={values.body ?? ""}
            onInput={signalTyping}
            onKeyDown={onKeyDown}
            className={internal ? "border-amber-300 focus:border-amber-500 focus:ring-amber-200/70" : undefined}
          />
        </Field>

        <AttachmentInput
          id="antwort-attachments"
          label="Dateien anhängen"
          hint={
            internal
              ? `Bleiben intern wie die Notiz. Erlaubt sind ${uploadRules.allowedLabel}.`
              : `Der Kunde kann sie im Ticket herunterladen. Erlaubt sind ${uploadRules.allowedLabel}.`
          }
          error={errors.attachments}
          rules={uploadRules}
        />

        <div
          className={cn(
            "flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-end sm:justify-between",
            internal ? "border-amber-200" : "border-line",
          )}
        >
          <div className="sm:w-64">
            <Label htmlFor="antwort-status" className="mb-1.5">
              Status danach
            </Label>
            <Select
              key={mode}
              id="antwort-status"
              name="statusAfter"
              defaultValue={values.statusAfter ?? suggested}
              className="h-10 text-sm"
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {s === status
                    ? `${STATUS_LABELS_STAFF[s as TicketStatus] ?? s} (unverändert)`
                    : (STATUS_LABELS_STAFF[s as TicketStatus] ?? s)}
                </option>
              ))}
            </Select>
          </div>
          <SubmitButton
            variant={internal ? "dark" : "primary"}
            pendingText="Wird gespeichert …"
            className="w-full sm:w-auto"
          >
            {internal ? "Interne Notiz speichern" : "Antwort senden"}
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

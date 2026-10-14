"use client";

import { useActionState, useEffect, useState, type DragEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { Languages, Lock, MessageSquare } from "lucide-react";
import { staffReplyAction } from "@/lib/actions/admin-tickets";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/cn";
import { STATUS_LABELS_STAFF, type TicketStatus } from "@/lib/constants";
import { useChannel, useTypingSignal } from "@/realtime/client";
import { FieldError, Label, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { showToast } from "@/components/ui/toaster";
import type { UploadRules } from "@/components/forms/attachment-input";
import { AttachmentButton, AttachmentChips, useAttachments } from "@/components/admin/tickets/attachment-picker";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";

type Mode = "reply" | "internal";

/** Statuswerte, die nach einer Antwort typischerweise gesetzt werden */
const AFTER_OPTIONS: TicketStatus[] = ["IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"];

type Props = {
  ticketId: number;
  status: string;
  /** Empfänger der E-Mail-Benachrichtigung oder null */
  recipient: { name: string; email: string } | null;
  /** Wo der Kunde die Antwort sieht, z. B. „im Kundenportal“ oder „über seinen Status-Link“ */
  customerChannel: string;
  /** Sprache, in der der Kunde Antworten übersetzt liest (z. B. „Türkisch“); null = Deutsch bzw. keine Übersetzung */
  customerLanguage?: string | null;
  uploadRules: UploadRules;
};

/**
 * Antwortfeld unter dem Verlauf – kompakt wie ein Chat: Umschalter „Antwort an Kunden“ / „Interne Notiz“,
 * mitwachsendes Textfeld, Anhänge über die Büroklammer (oder hineinziehen), „Status danach“ und Senden.
 * Die gewählte Art bleibt nach dem Absenden erhalten, damit eine zweite Notiz nicht versehentlich beim Kunden landet;
 * bei einer internen Notiz ist das ganze Feld gelb abgesetzt.
 *
 * Live: Ist der Kunde gerade im Ticket, steht das über dem Textfeld – die Antwort erscheint dann sofort bei
 * ihm und die E-Mail entfällt. Bei einer internen Notiz wird das Tippen nur Kollegen angezeigt.
 */
export function StaffReplyForm(props: Props) {
  const [state, action] = useActionState(staffReplyAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const [mode, setMode] = useState<Mode>("reply");
  const internal = mode === "internal";

  // Erfolg als kurze Meldung – die Nachricht selbst erscheint im Verlauf
  useEffect(() => {
    if (state.status === "success" && state.message) showToast(state.message);
  }, [state]);

  return (
    <section
      aria-labelledby="antwort-titel"
      className={cn(
        "rounded-2xl border shadow-card transition-colors duration-200",
        internal ? "border-warning-line bg-warning-soft" : "border-line bg-surface",
      )}
    >
      <h2 id="antwort-titel" className="sr-only">
        {internal ? "Interne Notiz schreiben" : "Antwort schreiben"}
      </h2>
      <ComposerForm
        key={formKey}
        {...props}
        formRef={formRef}
        action={action}
        state={state}
        mode={mode}
        onModeChange={setMode}
      />
    </section>
  );
}

function ComposerForm({
  ticketId,
  status,
  recipient,
  customerChannel,
  customerLanguage = null,
  uploadRules,
  formRef,
  action,
  state,
  mode,
  onModeChange,
}: Props & {
  formRef: Ref<HTMLFormElement>;
  action: (formData: FormData) => void;
  state: FormState;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}) {
  const internal = mode === "internal";
  const signalTyping = useTypingSignal(`ticket:${ticketId}`, internal);
  // Gleicher Kanal wie die Live-Leiste am Verlauf; die Verbindung wird geteilt
  const { presence } = useChannel({ t: "sub", ch: "ticket", id: ticketId });
  // Die E-Mail entfällt nur, wenn ihr Empfänger selbst zusieht – nicht, wenn z. B. nur der Hauptansprechpartner das Ticket
  // offen hat (gleiche Regel wie isRecipientWatchingTicket). Gäste mit Status-Link erscheinen mit Kontaktnamen oder „Kunde“.
  const customerOnline = recipient ? presence.customers.includes(recipient.name || "Kunde") : presence.customers.length > 0;
  const { inputRef, picked, add, remove, warning, maxMb } = useAttachments(uploadRules);
  const [dragging, setDragging] = useState(false);

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

  function onDragOver(event: DragEvent<HTMLFormElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setDragging(true);
  }

  function onDrop(event: DragEvent<HTMLFormElement>) {
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    setDragging(false);
    add(Array.from(event.dataTransfer.files));
  }

  const attachmentsHint = internal
    ? "Anhänge bleiben intern wie die Notiz."
    : `Anhänge kann der Kunde im Ticket herunterladen. Erlaubt sind ${uploadRules.allowedLabel}.`;

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      className={cn(
        "relative space-y-3 rounded-2xl p-3 sm:p-4",
        dragging && "outline-2 -outline-offset-4 outline-brand-500 outline-dashed",
      )}
    >
      <input type="hidden" name="ticketId" value={ticketId} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <fieldset>
          <legend className="sr-only">Art der Nachricht</legend>
          <div className="inline-flex gap-0.5 rounded-full bg-surface p-0.5 ring-1 ring-line-strong ring-inset">
            <ModeOption value="reply" checked={!internal} onChange={() => onModeChange("reply")}>
              <MessageSquare className="size-3.5 shrink-0" aria-hidden />
              Antwort an Kunden
            </ModeOption>
            <ModeOption value="internal" checked={internal} onChange={() => onModeChange("internal")} tone="warning">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              Interne Notiz
            </ModeOption>
          </div>
        </fieldset>
        <span className="hidden text-xs text-ink-muted sm:inline">Strg + Enter sendet ab</span>
      </div>

      <div className="space-y-1 text-xs leading-relaxed text-ink-soft" aria-live="polite">
        {internal ? (
          <p className="text-warning-ink">
            <span className="font-semibold">Nur für das Hertlin-Team sichtbar.</span> Es wird keine E-Mail verschickt.
          </p>
        ) : customerOnline ? (
          <p className="flex items-center gap-2 text-success-ink">
            <span className="size-2 shrink-0 rounded-full bg-success-solid" aria-hidden />
            <span>
              <span className="font-semibold">Kunde ist online</span> – Ihre Antwort erscheint sofort bei ihm, keine E-Mail nötig.
            </span>
          </p>
        ) : recipient ? (
          <p>
            Der Kunde sieht die Antwort {customerChannel} und bekommt eine E-Mail an{" "}
            <span className="font-semibold [overflow-wrap:anywhere] text-ink">{recipient.email}</span>.
          </p>
        ) : (
          <p>Der Kunde sieht die Antwort {customerChannel}. Eine E-Mail-Adresse ist nicht hinterlegt.</p>
        )}
        {!internal && customerLanguage ? (
          <p className="flex items-start gap-1.5">
            <Languages className="mt-px size-3.5 shrink-0 text-ink-muted" aria-hidden />
            <span>Der Kunde liest Ihre Antwort auf {customerLanguage} (automatisch übersetzt). Schreiben Sie einfach wie gewohnt.</span>
          </p>
        ) : null}
      </div>

      {state.status === "error" ? <FormMessage state={state} /> : null}

      <div>
        <Label htmlFor="antwort-body" className="sr-only">
          {internal ? "Notiz" : "Nachricht"}
        </Label>
        <Textarea
          {...fieldA11y("antwort-body", errors.body)}
          name="body"
          rows={3}
          maxLength={10000}
          placeholder={
            internal
              ? "Interne Notiz, z. B. Ersatzteil bestellt, Lieferung Donnerstag."
              : "Antwort an den Kunden …"
          }
          defaultValue={values.body ?? ""}
          onInput={signalTyping}
          onKeyDown={onKeyDown}
          className={cn(
            "max-h-[24rem] min-h-[5.5rem] resize-none field-sizing-content",
            internal && "border-warning-line focus:border-warning-solid",
          )}
        />
        <FieldError id="antwort-body-error">{errors.body}</FieldError>
      </div>

      <AttachmentChips picked={picked} warning={warning} onRemove={remove} rules={uploadRules} />
      {errors.attachments ? <FieldError id="antwort-attachments-error">{errors.attachments}</FieldError> : null}
      <p id="antwort-attachments-hint" className="sr-only">
        {attachmentsHint}
      </p>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
        <AttachmentButton
          id="antwort-attachments"
          inputRef={inputRef}
          onAdd={add}
          count={picked.length}
          maxMb={maxMb}
          rules={uploadRules}
          invalid={Boolean(errors.attachments)}
          describedBy={errors.attachments ? "antwort-attachments-error" : "antwort-attachments-hint"}
        />
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <Label htmlFor="antwort-status" className="shrink-0 text-xs font-semibold whitespace-nowrap text-ink-muted">
            Status danach
          </Label>
          <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Select
              // Neu aufbauen, wenn die Art wechselt oder sich der Status live ändert (z. B. durch einen Kollegen)
              key={`${mode}-${status}`}
              id="antwort-status"
              name="statusAfter"
              defaultValue={values.statusAfter ?? suggested}
              className="h-9 text-sm"
            >
              {options.map((s) => (
                <option key={s} value={s}>
                  {s === status
                    ? `${STATUS_LABELS_STAFF[s as TicketStatus] ?? s} (bleibt)`
                    : (STATUS_LABELS_STAFF[s as TicketStatus] ?? s)}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <SubmitButton
          variant={internal ? "dark" : "primary"}
          pendingText="Wird gespeichert …"
          className="max-sm:w-full sm:ml-auto"
        >
          {internal ? "Interne Notiz speichern" : "Antwort senden"}
        </SubmitButton>
      </div>

      {dragging ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm font-semibold text-brand-700">
          Dateien hier ablegen
        </p>
      ) : null}
    </form>
  );
}

function ModeOption({
  value,
  checked,
  onChange,
  tone = "brand",
  children,
}: {
  value: Mode;
  checked: boolean;
  onChange: () => void;
  tone?: "brand" | "warning";
  children: ReactNode;
}) {
  return (
    <label className="relative block min-w-0 cursor-pointer">
      <input type="radio" name="mode" value={value} checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        className={cn(
          "flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-ink-soft transition-colors hover:text-ink",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
          tone === "warning"
            ? "peer-checked:bg-warning-soft peer-checked:text-warning-ink peer-checked:ring-1 peer-checked:ring-warning-line peer-checked:ring-inset"
            : "peer-checked:bg-brand-100 peer-checked:text-ink",
        )}
      >
        {children}
      </span>
    </label>
  );
}

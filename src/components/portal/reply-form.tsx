"use client";

import { useActionState, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type RefObject } from "react";
import { Paperclip, SendHorizontal, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { replyPortalTicketAction } from "@/lib/actions/portal-tickets";
import { useTypingSignal } from "@/realtime/client";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { showToast } from "@/components/ui/toaster";
import type { UploadRules } from "@/components/forms/attachment-input";
import { usePortalForm } from "@/components/portal/use-portal-form";

const ID = "antwort";

const PLACEHOLDER: Record<string, string> = {
  WAITING_CUSTOMER: "Ihre Antwort auf unsere Rückfrage",
  RESOLVED: "Was funktioniert noch nicht?",
};

const AFTER_SEND: Record<string, string> = {
  WAITING_CUSTOMER: "Danach geht das Ticket zurück in die Bearbeitung.",
  RESOLVED: "Damit öffnen Sie das Ticket wieder.",
};

function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

/**
 * Antwort eines Portalbenutzers im Ticket – kompakt wie ein Chat:
 * wachsendes Textfeld, Anhänge über die Büroklammer (oder hineinziehen), Senden rechts; Strg/⌘ + Enter sendet.
 * Erfolg kommt als kurze Meldung (Toast), Fehler stehen direkt am Feld. Die Ticket-ID prüft die Action erneut.
 */
export function ReplyForm({
  ticketId,
  status,
  uploadRules,
  note,
}: {
  ticketId: number;
  status: string;
  uploadRules: UploadRules;
  /** kleiner Hinweis unter dem Feld (z. B. zur Übersetzung) */
  note?: string;
}) {
  const [state, action, pending] = useActionState(replyPortalTicketAction, initialFormState);
  const { formRef, formKey } = usePortalForm(state);
  const signalTyping = useTypingSignal(`ticket:${ticketId}`);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status !== "success") return;
    if (state.message) showToast(state.message);
    // Weiterschreiben ohne Umweg – aber auf Touch-Geräten nicht gleich wieder die Tastatur öffnen
    if (window.matchMedia("(pointer: fine)").matches) textareaRef.current?.focus({ preventScroll: true });
  }, [state]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
      event.preventDefault();
      // Nicht doppelt senden, solange die Nachricht noch unterwegs ist
      if (!pending) formRef.current?.requestSubmit();
    }
  }

  return (
    // Neu aufgebaut nach jedem Ergebnis (formKey): nach Erfolg leer, nach Fehler mit dem geschriebenen Text
    <form key={formKey} ref={formRef} action={action} noValidate className="space-y-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <Composer
        textareaRef={textareaRef}
        defaultBody={state.status === "error" ? state.values?.body : undefined}
        placeholder={PLACEHOLDER[status] ?? "Ergänzung, Rückfrage oder ein kurzes „Danke, läuft wieder“"}
        bodyError={errors.body}
        attachmentError={errors.attachments}
        rules={uploadRules}
        onKeyDown={onKeyDown}
        onInput={signalTyping}
      />
      <p className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-ink-muted">
        {AFTER_SEND[status] ? <span>{AFTER_SEND[status]}</span> : null}
        {note ? <span>{note}</span> : null}
        <span className="hidden sm:inline">Strg + Enter sendet.</span>
      </p>
    </form>
  );
}

function Composer({
  textareaRef,
  defaultBody,
  placeholder,
  bodyError,
  attachmentError,
  rules,
  onKeyDown,
  onInput,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  defaultBody?: string;
  placeholder: string;
  bodyError?: string;
  attachmentError?: string;
  rules: UploadRules;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onInput: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const keptRef = useRef<File[]>([]);
  const [picked, setPicked] = useState<{ name: string; size: number }[]>([]);
  const [dragging, setDragging] = useState(false);

  function apply(files: File[]) {
    const input = inputRef.current;
    if (!input) return;
    try {
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(file);
      input.files = transfer.files;
      keptRef.current = files;
    } catch {
      // Sehr alte Browser: Auswahl lässt sich nicht zusammenführen, es gilt die letzte Auswahl
      keptRef.current = Array.from(input.files ?? []);
    }
    setPicked(keptRef.current.map((f) => ({ name: f.name, size: f.size })));
  }

  function add(incoming: File[]) {
    const merged = [...keptRef.current];
    for (const file of incoming) if (!merged.some((f) => sameFile(f, file))) merged.push(file);
    apply(merged);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) add(Array.from(event.dataTransfer.files));
  }

  const maxMb = Math.round(rules.maxFileSize / (1024 * 1024));
  const tooMany = picked.length > rules.maxFiles;
  const tooLarge = picked.filter((f) => f.size > rules.maxFileSize);
  const errorIds = [bodyError ? `${ID}-body-error` : null, attachmentError ? `${ID}-attachments-error` : null].filter(Boolean);

  return (
    <div
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      className={cn(
        "relative rounded-2xl border bg-surface shadow-card transition-colors",
        "has-[textarea:focus-visible]:border-brand-600 has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-brand-600",
        bodyError ? "border-danger-solid" : "border-line-strong",
      )}
    >
      <label htmlFor={`${ID}-body`} className="sr-only">
        Ihre Nachricht
      </label>
      <textarea
        ref={textareaRef}
        id={`${ID}-body`}
        name="body"
        rows={3}
        maxLength={10000}
        placeholder={placeholder}
        defaultValue={defaultBody}
        onKeyDown={onKeyDown}
        onInput={onInput}
        aria-invalid={bodyError ? true : undefined}
        aria-describedby={bodyError ? `${ID}-body-error` : undefined}
        className="block max-h-80 min-h-[5.5rem] w-full resize-none rounded-t-2xl bg-transparent px-4 pt-3 pb-2 text-[0.9375rem] leading-relaxed text-ink [field-sizing:content] placeholder:text-ink-muted/80 focus:outline-none"
      />

      {picked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5 px-3 pb-2" aria-label="Ausgewählte Dateien">
          {picked.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pr-1 pl-3 text-xs ring-1 ring-inset",
                file.size > rules.maxFileSize ? "bg-danger-soft text-danger-ink ring-danger-line" : "bg-mist text-ink ring-line",
              )}
            >
              <Paperclip className="size-3 shrink-0 text-ink-muted" aria-hidden />
              <span className="max-w-[12rem] truncate">{file.name}</span>
              <span className="shrink-0 text-ink-muted tabular-nums">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => apply(keptRef.current.filter((_, i) => i !== index))}
                className="grid size-6 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-brand-50 hover:text-ink"
                aria-label={`${file.name} entfernen`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <input
            ref={inputRef}
            id={`${ID}-attachments`}
            name="attachments"
            type="file"
            multiple
            accept={rules.accept}
            onChange={(event) => add(Array.from(event.currentTarget.files ?? []))}
            aria-invalid={attachmentError ? true : undefined}
            aria-describedby={errorIds.length > 0 ? errorIds.join(" ") : `${ID}-attachments-hint`}
            className="peer sr-only"
          />
          <label
            htmlFor={`${ID}-attachments`}
            title={`Bis zu ${rules.maxFiles} Dateien, je höchstens ${maxMb} MB. Erlaubt sind ${rules.allowedLabel}.`}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap text-ink-soft transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:bg-brand-50 hover:text-ink"
          >
            <Paperclip className="size-4" aria-hidden />
            <span className="max-sm:sr-only">Dateien anhängen</span>
          </label>
          <span id={`${ID}-attachments-hint`} className="hidden truncate text-xs text-ink-muted md:inline">
            oder hierher ziehen
            <span className="sr-only">
              {" "}
              – bis zu {rules.maxFiles} Dateien, je höchstens {maxMb} MB. Erlaubt sind {rules.allowedLabel}.
            </span>
          </span>
        </div>
        <SubmitButton pendingText="Wird gesendet …" className="shrink-0">
          <SendHorizontal className="size-4" aria-hidden />
          <span className="max-sm:sr-only">Nachricht senden</span>
        </SubmitButton>
      </div>

      {dragging ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/90 text-sm font-semibold text-brand-800"
        >
          Dateien hier ablegen
        </div>
      ) : null}

      {bodyError || attachmentError || tooMany || tooLarge.length > 0 ? (
        <div className="space-y-1 border-t border-line px-4 py-2 text-sm">
          {bodyError ? (
            <p id={`${ID}-body-error`} className="font-medium text-danger-ink">
              {bodyError}
            </p>
          ) : null}
          {attachmentError ? (
            <p id={`${ID}-attachments-error`} className="font-medium text-danger-ink">
              {attachmentError}
            </p>
          ) : null}
          {tooMany || tooLarge.length > 0 ? (
            <p className="font-medium text-warning-ink" role="status">
              {tooMany ? `Bitte höchstens ${rules.maxFiles} Dateien anhängen. ` : null}
              {tooLarge.length > 0
                ? `${tooLarge.map((f) => `„${f.name}“`).join(", ")} ${tooLarge.length === 1 ? "ist" : "sind"} größer als ${maxMb} MB.`
                : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

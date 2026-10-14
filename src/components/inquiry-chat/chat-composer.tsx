"use client";

import { useActionState, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/forms";
import { useTypingSignal } from "@/realtime/client";
import type { ChannelKey } from "@/realtime/protocol";
import { cn } from "@/lib/cn";
import { Textarea } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";

type ChatAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Touch-Geräte: Enter macht dort eine neue Zeile, gesendet wird über den Knopf. */
function subscribeCoarse(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useCoarsePointer(): boolean {
  return useSyncExternalStore(
    subscribeCoarse,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

/**
 * Eingabefeld unter dem Chat-Verlauf.
 * Enter sendet, Umschalt + Enter macht eine neue Zeile. Während des Tippens geht ein
 * „schreibt gerade …“-Signal an die anderen Teilnehmer (gedrosselt).
 * hidden: versteckte Felder (Token bzw. Anfrage-ID) – die Action prüft sie erneut.
 */
export function ChatComposer({
  action,
  hidden,
  typingKey,
  id,
  label,
  placeholder,
  maxLength,
  footer,
  mailedNote,
}: {
  action: ChatAction;
  hidden: Record<string, string>;
  typingKey: ChannelKey | null;
  id: string;
  label: string;
  placeholder: string;
  maxLength: number;
  /** kleiner Hinweis unter dem Feld */
  footer?: string;
  /** Hinweis nach dem Senden, wenn die Action meldet, dass eine E-Mail-Benachrichtigung rausgeht (state.data.mailed) */
  mailedNote?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [lastState, setLastState] = useState(state);
  const formRef = useRef<HTMLFormElement>(null);
  const signalTyping = useTypingSignal(typingKey);
  const coarse = useCoarsePointer();

  // Nach erfolgreichem Senden leeren – außer es wurde inzwischen weitergetippt
  if (state !== lastState) {
    setLastState(state);
    if (state.status === "success" && submitted !== null) {
      setText((current) => (current === submitted ? "" : current));
    }
    setSubmitted(null);
  }

  const empty = text.trim().length === 0;
  const tooLong = text.length > maxLength;
  const error = state.status === "error" ? (state.fieldErrors?.body ?? state.message ?? null) : null;
  const note = state.status === "success" && state.data?.mailed === "1" && mailedNote ? mailedNote : null;
  const errorId = `${id}-error`;

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.altKey || event.nativeEvent.isComposing) return;
    if (coarse && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (!pending && !empty && !tooLong) formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        if (empty || tooLong || pending) {
          event.preventDefault();
          return;
        }
        setSubmitted(text);
      }}
      className="space-y-2"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {error ? (
        <p id={errorId} role="alert" className="rounded-xl bg-red-50 px-3.5 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200 ring-inset">
          {error}
        </p>
      ) : null}
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="flex items-end gap-2">
        <Textarea
          id={id}
          name="body"
          rows={2}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onInput={signalTyping}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : `${id}-hint`}
          enterKeyHint={coarse ? "enter" : "send"}
          className="max-h-48 min-h-12 min-w-0 flex-1 resize-none [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={pending || empty || tooLong}
          aria-disabled={pending || empty || tooLong}
          className={buttonClasses("primary", "lg", "shrink-0")}
        >
          {pending ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
          ) : (
            <SendHorizontal className="size-4" aria-hidden />
          )}
          {/* Auf dem Handy nur das Symbol, damit das Eingabefeld Platz hat; Screenreader lesen den Text */}
          <span className="sr-only sm:not-sr-only">{pending ? "Wird gesendet …" : "Senden"}</span>
        </button>
      </div>
      <div id={`${id}-hint`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span aria-live="polite">
          {note ?? footer ?? null}
          {!note && !coarse ? (
            <span className="hidden sm:inline">{footer ? " · " : ""}Enter sendet, Umschalt + Enter macht eine neue Zeile.</span>
          ) : null}
        </span>
        {text.length > maxLength - 300 ? (
          <span className={cn("tabular-nums", tooLong ? "font-semibold text-red-700" : "")}>
            {text.length.toLocaleString("de-DE")} / {maxLength.toLocaleString("de-DE")} Zeichen
          </span>
        ) : null}
      </div>
    </form>
  );
}

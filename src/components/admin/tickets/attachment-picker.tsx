"use client";

import { useRef, useState, type RefObject } from "react";
import { Paperclip, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/format";
import type { UploadRules } from "@/components/forms/attachment-input";

type Picked = { name: string; size: number };

function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

/**
 * Anhänge im Antwortfeld: Büroklammer zum Auswählen, gewählte Dateien als kleine Chips.
 * Mehrfaches Auswählen ergänzt die Liste; Dateien können auch auf das Antwortfeld gezogen werden (add()).
 * Die endgültige Prüfung macht der Server (validateFiles). Das Formular wird nach dem Absenden neu aufgebaut,
 * damit beginnt auch die Liste wieder leer.
 */
export function useAttachments(rules: UploadRules) {
  const inputRef = useRef<HTMLInputElement>(null);
  const keptRef = useRef<File[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);

  function apply(files: File[]) {
    const input = inputRef.current;
    if (!input) return;
    try {
      const transfer = new DataTransfer();
      for (const file of files) transfer.items.add(file);
      input.files = transfer.files;
      keptRef.current = files;
    } catch {
      // Sehr alte Browser: Auswahl kann nicht zusammengeführt werden, es gilt die letzte Auswahl.
      keptRef.current = Array.from(input.files ?? []);
    }
    setPicked(keptRef.current.map((f) => ({ name: f.name, size: f.size })));
  }

  function add(incoming: File[]) {
    const merged = [...keptRef.current];
    for (const file of incoming) if (!merged.some((f) => sameFile(f, file))) merged.push(file);
    apply(merged);
  }

  function remove(index: number) {
    apply(keptRef.current.filter((_, i) => i !== index));
  }

  const maxMb = Math.round(rules.maxFileSize / (1024 * 1024));
  const tooMany = picked.length > rules.maxFiles;
  const tooLarge = picked.filter((f) => f.size > rules.maxFileSize);
  const warning =
    tooMany || tooLarge.length > 0
      ? [
          tooMany ? `Bitte höchstens ${rules.maxFiles} Dateien anhängen.` : null,
          tooLarge.length > 0
            ? `${tooLarge.map((f) => `„${f.name}“`).join(", ")} ${tooLarge.length === 1 ? "ist" : "sind"} größer als ${maxMb} MB.`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : null;

  return { inputRef, picked, add, remove, warning, maxMb };
}

/** Büroklammer-Knopf mit dem (unsichtbaren) Dateifeld. */
export function AttachmentButton({
  id,
  inputRef,
  onAdd,
  count,
  maxMb,
  rules,
  describedBy,
  invalid,
}: {
  id: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onAdd: (files: File[]) => void;
  count: number;
  maxMb: number;
  rules: UploadRules;
  describedBy?: string;
  invalid?: boolean;
}) {
  return (
    <>
      <input
        ref={inputRef}
        id={id}
        name="attachments"
        type="file"
        multiple
        accept={rules.accept}
        onChange={(e) => onAdd(Array.from(e.currentTarget.files ?? []))}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        title={`Dateien anhängen (bis zu ${rules.maxFiles}, je höchstens ${maxMb} MB)`}
        className={cn(
          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-brand-50 hover:text-ink",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
        )}
      >
        <Paperclip className="size-4" aria-hidden />
        <span className="sr-only">Dateien anhängen</span>
        {count > 0 ? <span className="tabular-nums">{count}</span> : null}
      </label>
    </>
  );
}

/** Gewählte Dateien als Chips mit „entfernen“. */
export function AttachmentChips({
  picked,
  warning,
  onRemove,
  rules,
}: {
  picked: Picked[];
  warning: string | null;
  onRemove: (index: number) => void;
  rules: UploadRules;
}) {
  if (picked.length === 0 && !warning) return null;
  return (
    <div className="space-y-1.5">
      {picked.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Ausgewählte Dateien">
          {picked.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-mist py-1 pr-1 pl-3 text-xs ring-1 ring-line ring-inset"
            >
              <Paperclip className="size-3 shrink-0 text-ink-muted" aria-hidden />
              <span className="min-w-0 truncate text-ink">{file.name}</span>
              <span className={cn("shrink-0 tabular-nums", file.size > rules.maxFileSize ? "text-danger-ink" : "text-ink-muted")}>
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="grid size-6 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-brand-50 hover:text-ink"
                aria-label={`${file.name} entfernen`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {warning ? (
        <p className="text-xs font-medium text-warning-ink" role="status">
          {warning}
        </p>
      ) : null}
    </div>
  );
}

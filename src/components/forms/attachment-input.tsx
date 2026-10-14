"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Paperclip, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatFileSize } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";
import { FieldError, Hint, Label } from "@/components/ui/field";

/** Regeln aus @/lib/uploads, vom Server als Props übergeben (das Modul ist server-only). */
export type UploadRules = {
  accept: string;
  maxFiles: number;
  maxFileSize: number;
  allowedLabel: string;
};

type Picked = { name: string; size: number };

function sameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

/**
 * Datei-Auswahl für Anhänge. Mehrfaches Auswählen ergänzt die Liste (statt sie zu ersetzen),
 * einzelne Dateien lassen sich wieder entfernen, Dateien können auch hineingezogen werden.
 * Die endgültige Prüfung macht der Server (validateFiles).
 */
export function AttachmentInput({
  id,
  name = "attachments",
  label,
  hint,
  error,
  rules,
}: {
  id: string;
  name?: string;
  label: string;
  hint?: string;
  error?: string;
  rules: UploadRules;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const keptRef = useRef<File[]>([]);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [dragging, setDragging] = useState(false);

  // React setzt das Formular nach dem Absenden zurück – dann auch die Liste leeren.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clear = () => {
      keptRef.current = [];
      setPicked([]);
    };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

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

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) add(Array.from(event.dataTransfer.files));
  }

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const tooMany = picked.length > rules.maxFiles;
  const tooLarge = picked.filter((f) => f.size > rules.maxFileSize);
  const maxMb = Math.round(rules.maxFileSize / (1024 * 1024));

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-ink-muted">optional</span>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "rounded-xl border border-dashed px-4 py-4 transition-colors",
          dragging ? "border-brand-500 bg-brand-50" : error ? "border-red-400 bg-white" : "border-line-strong bg-mist",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <input
            ref={inputRef}
            id={id}
            name={name}
            type="file"
            multiple
            accept={rules.accept}
            onChange={(e) => add(Array.from(e.currentTarget.files ?? []))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hintId}
            className="peer sr-only"
          />
          <label
            htmlFor={id}
            className={buttonClasses(
              "secondary",
              "sm",
              "cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
            )}
          >
            <Paperclip className="size-4" aria-hidden />
            {picked.length > 0 ? "Weitere Dateien" : "Dateien auswählen"}
          </label>
          <span className="text-sm text-ink-muted">
            oder hierher ziehen · bis zu {rules.maxFiles} Dateien, je höchstens {maxMb} MB
          </span>
        </div>

        {picked.length > 0 ? (
          <ul className="mt-3 space-y-1.5" aria-label="Ausgewählte Dateien">
            {picked.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-line"
              >
                <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                <span
                  className={cn("shrink-0 tabular-nums", file.size > rules.maxFileSize ? "text-red-700" : "text-ink-muted")}
                >
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-brand-50 hover:text-ink"
                  aria-label={`${file.name} entfernen`}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {tooMany || tooLarge.length > 0 ? (
        <p className="mt-1.5 text-sm font-medium text-amber-800" role="status">
          {tooMany ? `Bitte höchstens ${rules.maxFiles} Dateien anhängen. ` : null}
          {tooLarge.length > 0
            ? `${tooLarge.map((f) => `„${f.name}“`).join(", ")} ${tooLarge.length === 1 ? "ist" : "sind"} größer als ${maxMb} MB.`
            : null}
        </p>
      ) : null}
      {error ? (
        <FieldError id={errorId}>{error}</FieldError>
      ) : (
        <Hint id={hintId}>{hint ?? `Erlaubt sind ${rules.allowedLabel}.`}</Hint>
      )}
    </div>
  );
}

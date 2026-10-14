"use client";

import { useId, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState, type FormState } from "@/lib/forms";
import { cn } from "@/lib/cn";
import { uploadMediaAction } from "@/lib/actions/admin-website";
import { Modal } from "@/components/admin/website/dialog";
import type { MediaPickerRequest } from "@/components/admin/website/editor-context";
import type { MediaItem } from "@/components/admin/website/types";

/** Bildauswahl aus der Mediathek, mit direktem Hochladen. */
export function MediaPicker({
  request,
  media,
  accept,
  uploadHint,
  onUploaded,
  onClose,
}: {
  request: MediaPickerRequest | null;
  media: MediaItem[];
  accept: string;
  uploadHint: string;
  onUploaded: (item: MediaItem) => void;
  onClose: () => void;
}) {
  const [uploadState, setUploadState] = useState<FormState>(initialFormState);
  const [uploading, startUpload] = useTransition();
  const fileId = useId();
  const altId = useId();

  const select = (item: MediaItem) => {
    request?.onSelect(item);
    onClose();
  };

  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title="Bild auswählen"
      description="Klicken Sie auf ein Bild, um es zu übernehmen."
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Abbrechen
        </Button>
      }
    >
      <form
        className="mb-6 rounded-xl border border-line bg-mist p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          startUpload(async () => {
            let result: FormState;
            try {
              result = await uploadMediaAction(initialFormState, data);
            } catch (error) {
              unstable_rethrow(error);
              result = { status: "error", message: "Das Hochladen hat nicht geklappt. Bitte versuchen Sie es noch einmal." };
            }
            setUploadState(result);
            if (result.status === "success" && result.data?.id) {
              const item: MediaItem = {
                id: result.data.id,
                url: result.data.url,
                fileName: result.data.fileName,
                alt: result.data.alt || null,
              };
              form.reset();
              onUploaded(item);
              setUploadState(initialFormState);
              select(item);
            }
          });
        }}
      >
        <p className="mb-3 text-sm font-semibold text-ink">Neues Bild hochladen</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={fileId} className="mb-1.5">
              Datei
            </Label>
            <input
              id={fileId}
              name="files"
              type="file"
              accept={accept}
              required
              className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-surface file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink file:ring-1 file:ring-line-strong file:ring-inset hover:file:bg-brand-50"
            />
            <p className="mt-1.5 text-xs text-ink-muted">{uploadHint}</p>
          </div>
          <div>
            <Label htmlFor={altId} className="mb-1.5">
              Bildbeschreibung
            </Label>
            <Input id={altId} name="alt" maxLength={200} placeholder="Was ist zu sehen?" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="submit" size="sm" disabled={uploading}>
            <Upload className="size-4" aria-hidden />
            {uploading ? "Wird hochgeladen …" : "Hochladen und auswählen"}
          </Button>
        </div>
        <FormMessage state={uploadState} className="mt-3" />
      </form>

      {media.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
          Die Mediathek ist noch leer. Laden Sie oben das erste Bild hoch.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((item, i) => {
            const selected = item.id === request?.selectedId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => select(item)}
                  aria-pressed={selected}
                  data-autofocus={selected || (!request?.selectedId && i === 0) ? true : undefined}
                  className={cn(
                    "group relative block w-full overflow-hidden rounded-xl border bg-surface text-left transition-colors",
                    selected ? "border-brand-500 ring-2 ring-brand-300" : "border-line hover:border-brand-300",
                  )}
                >
                  <span className="block aspect-[4/3] bg-mist">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt="" loading="lazy" className="size-full object-cover" />
                  </span>
                  <span className="block truncate px-3 py-2 text-xs font-medium text-ink-soft">
                    {item.fileName}
                    {item.alt ? <span className="sr-only"> – {item.alt}</span> : null}
                  </span>
                  {selected ? (
                    <span className="absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-primary text-on-primary">
                      <Check className="size-4" aria-hidden />
                      <span className="sr-only">ausgewählt</span>
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

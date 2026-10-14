"use client";

import { useActionState, useId, useState, useTransition } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/forms";
import { deleteMediaAction, updateMediaAltAction, uploadMediaAction } from "@/lib/actions/admin-website";
import { Modal } from "@/components/admin/website/dialog";

/** Hochladen von Bildern in die Mediathek. */
export function MediaUploadForm({ accept, hint, maxFiles }: { accept: string; hint: string; maxFiles: number }) {
  const [state, formAction] = useActionState(uploadMediaAction, initialFormState);
  const fileId = useId();
  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor={fileId} className="mb-1.5">
            Bilder auswählen
          </Label>
          <input
            id={fileId}
            name="files"
            type="file"
            accept={accept}
            multiple
            required
            aria-describedby={`${fileId}-hint`}
            className="block w-full rounded-xl border border-dashed border-line-strong bg-mist px-3 py-3 text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink file:ring-1 file:ring-line-strong file:ring-inset hover:file:bg-brand-50"
          />
          <p id={`${fileId}-hint`} className="mt-1.5 text-sm text-ink-muted">
            {hint} Bis zu {maxFiles} Bilder auf einmal.
          </p>
        </div>
        <Field
          label="Bildbeschreibung (Alternativtext)"
          htmlFor="media-alt"
          optional
          hint="Ein kurzer Satz, was zu sehen ist. Gilt für alle ausgewählten Bilder und lässt sich später einzeln ändern."
        >
          <Input id="media-alt" name="alt" maxLength={200} defaultValue={state.status === "error" ? state.values?.alt : ""} />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Wird hochgeladen …">
        <Upload className="size-4" aria-hidden />
        Hochladen
      </SubmitButton>
    </form>
  );
}

/** Bildbeschreibung eines Bildes ändern. */
export function MediaAltForm({ id, alt }: { id: string; alt: string | null }) {
  const [state, formAction] = useActionState(updateMediaAltAction.bind(null, id), initialFormState);
  const inputId = `media-alt-${id}`;
  return (
    <form action={formAction} className="space-y-2">
      <Label htmlFor={inputId}>Bildbeschreibung</Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          name="alt"
          maxLength={200}
          defaultValue={state.status === "error" ? (state.values?.alt ?? "") : (alt ?? "")}
          placeholder="Was ist zu sehen?"
        />
        <SubmitButton variant="secondary" pendingText="…" className="shrink-0 self-center">
          Speichern
        </SubmitButton>
      </div>
      {state.status !== "idle" && state.message ? (
        <p className={state.status === "error" ? "text-xs font-medium text-red-700" : "text-xs text-emerald-700"} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export type MediaUsageInfo = { pageId: string; title: string; path: string; live: boolean; draft: boolean };

/** Bild löschen – bei Verwendung auf Seiten mit deutlicher Warnung. */
export function MediaDeleteButton({ id, fileName, usage }: { id: string; fileName: string; usage: MediaUsageInfo[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const used = usage.length > 0;

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteMediaAction(id, used).catch((error: unknown) => {
        unstable_rethrow(error);
        return { ok: false as const, message: "Keine Verbindung zum Server. Bitte versuchen Sie es noch einmal." };
      });
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  };

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" aria-hidden />
        Löschen<span className="sr-only"> – {fileName}</span>
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Bild löschen?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} data-autofocus>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={remove} disabled={pending}>
              {pending ? "Wird gelöscht …" : used ? "Trotzdem löschen" : "Bild löschen"}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-[0.9375rem] text-ink-soft">
          <p>
            „{fileName}“ wird endgültig aus der Mediathek entfernt.
          </p>
          {used ? (
            <Alert tone="warning" title={`Das Bild wird auf ${usage.length === 1 ? "einer Seite" : `${usage.length} Seiten`} verwendet`}>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {usage.map((u) => (
                  <li key={u.pageId}>
                    <Link href={`/admin/website/seiten/${u.pageId}`} className="font-semibold underline underline-offset-2">
                      {u.title}
                    </Link>{" "}
                    <span className="text-amber-800">
                      ({[u.live ? "auf der Website" : null, u.draft ? "im Entwurf" : null].filter(Boolean).join(" und ")})
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Beim Löschen verschwindet das Bild dort sofort, auch auf der Website. Besser: zuerst auf den Seiten ein anderes Bild wählen.
              </p>
            </Alert>
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
        </div>
      </Modal>
    </>
  );
}

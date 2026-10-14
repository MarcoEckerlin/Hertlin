"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Modales Fenster auf Basis von <dialog>: Fokus bleibt im Fenster, Escape schließt,
 * Klick auf den abgedunkelten Hintergrund schließt ebenfalls.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const preferred = dialog.querySelector<HTMLElement>("[data-autofocus]");
      preferred?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (open) onClose();
      }}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Nur schließen, wenn Drücken und Loslassen auf dem Hintergrund passiert sind (nicht beim Markieren von Text)
        if (e.target === e.currentTarget && pressedOnBackdrop.current) onClose();
        pressedOnBackdrop.current = false;
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-white p-0 text-ink shadow-lift backdrop:bg-ink/40",
        size === "sm" && "max-w-md",
        size === "md" && "max-w-xl",
        size === "lg" && "max-w-3xl",
      )}
    >
      {open ? (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-brand-50 hover:text-ink"
              aria-label="Fenster schließen"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-mist px-5 py-3 sm:px-6">{footer}</div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

export type ConfirmRequest = {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "primary";
};

/** Rückfrage vor folgenreichen Aktionen (Löschen, Verwerfen …). */
export function ConfirmDialog({
  request,
  onAnswer,
}: {
  request: ConfirmRequest | null;
  onAnswer: (confirmed: boolean) => void;
}) {
  return (
    <Modal
      open={request !== null}
      onClose={() => onAnswer(false)}
      title={request?.title ?? ""}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => onAnswer(false)} data-autofocus>
            Abbrechen
          </Button>
          <Button variant={request?.tone === "primary" ? "primary" : "danger"} onClick={() => onAnswer(true)}>
            {request?.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[0.9375rem] leading-relaxed text-ink-soft">{request?.message}</div>
    </Modal>
  );
}

/** Kleiner runder Symbol-Button mit Pflicht-Beschriftung für Screenreader. */
export function IconButton({
  label,
  className,
  children,
  tone = "default",
  ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string; tone?: "default" | "danger" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-35",
        tone === "danger" ? "text-red-700 hover:bg-red-50" : "text-ink-soft hover:bg-brand-50 hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

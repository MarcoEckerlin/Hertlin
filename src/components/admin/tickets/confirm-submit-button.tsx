"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

/** Absende-Button mit Sicherheitsabfrage, z. B. zum Löschen. */
export function ConfirmSubmitButton({
  confirmText,
  onClick,
  ...props
}: ComponentProps<typeof SubmitButton> & { confirmText: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    />
  );
}

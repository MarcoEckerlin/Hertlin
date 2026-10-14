"use client";

import type { ComponentProps } from "react";
import { Select } from "@/components/ui/field";

/**
 * Auswahlliste in einem GET-Filterformular, die beim Ändern sofort absendet.
 * Ohne JavaScript bleibt der Absende-Knopf des Formulars der Weg.
 */
export function AutoSubmitSelect({ onChange, ...props }: ComponentProps<typeof Select>) {
  return (
    <Select
      {...props}
      onChange={(event) => {
        onChange?.(event);
        event.currentTarget.form?.requestSubmit();
      }}
    />
  );
}

"use client";

import { createContext, useContext } from "react";
import type { ConfirmRequest } from "@/components/admin/website/dialog";
import type { MediaItem } from "@/components/admin/website/types";

export type MediaPickerRequest = {
  selectedId?: string;
  onSelect: (item: MediaItem) => void;
};

export type EditorContextValue = {
  media: MediaItem[];
  openMediaPicker: (request: MediaPickerRequest) => void;
  /** id der <datalist> mit Vorschlägen für Link-Ziele */
  linkListId: string;
  confirm: (request: ConfirmRequest) => Promise<boolean>;
  /** Nach dem nächsten Rendern das Element mit dieser id fokussieren (mit Ersatz-ids) */
  focusLater: (...ids: string[]) => void;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor() außerhalb des Seiten-Editors");
  return ctx;
}

/** DOM-id eines Felds: b-<blockId>-items-0-title */
export function fieldDomId(blockId: string, path: (string | number)[]): string {
  return ["b", blockId, ...path].join("-");
}

import type { PageDraft } from "@/cms/schema";

/** Gemeinsame Typen für Editor (Browser) und Server Actions der Website-Verwaltung. */

/** Validierungsfehler mit Pfad im Entwurf, z. B. ["blocks", 2, "items", 0, "title"] */
export type EditorIssue = { path: (string | number)[]; message: string };

export type SaveOptions = {
  /** updatedAt (ISO) des Stands, auf dem der Editor aufbaut – zur Erkennung paralleler Änderungen */
  baseUpdatedAt?: string;
  /** Trotz paralleler Änderung speichern */
  force?: boolean;
};

export type SaveResult =
  | {
      ok: true;
      message: string;
      hasDraft: boolean;
      published: boolean;
      publishedAt: string | null;
      updatedAt: string;
    }
  | {
      ok: false;
      message: string;
      issues?: EditorIssue[];
      /** Jemand anderes hat die Seite inzwischen geändert */
      conflict?: boolean;
    };

export type DiscardResult = { ok: true; message: string; content: PageDraft; updatedAt: string } | { ok: false; message: string };

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** Bild aus der Mediathek für die Bildauswahl im Editor */
export type MediaItem = { id: string; url: string; fileName: string; alt: string | null };

/** Vorschlag für Link-Ziele (Datalist) */
export type LinkTarget = { value: string; label: string };

/** Platzhalter mit aktuellem Wert aus den Firmendaten (Hilfe im Editor) */
export type PlaceholderInfo = { token: string; label: string; value: string };

import type { z } from "zod";
import type { Block } from "@/cms/schema";
import { BLOCK_LABELS } from "@/cms/schema";
import { describeBlockPath } from "@/components/admin/website/block-config";
import type { EditorIssue } from "@/components/admin/website/types";

/**
 * Übersetzt Zod-Fehler des Entwurfs in verständliche deutsche Meldungen
 * und ordnet sie Seite, Modul und Feld zu.
 */

const LINK_TARGET_HELP =
  "Ungültiges Link-Ziel. Erlaubt sind z. B. /kontakt, #abschnitt, https://…, mailto:…, tel:+49… oder {fernwartung}.";

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function germanIssueMessage(issue: z.core.$ZodIssue): string {
  const last = issue.path[issue.path.length - 1];
  switch (issue.code) {
    case "too_small": {
      const min = Number(issue.minimum);
      if (issue.origin === "string") return min <= 1 ? "Bitte ausfüllen." : `Mindestens ${min} Zeichen.`;
      if (issue.origin === "array") return `Mindestens ${min} ${plural(min, "Eintrag", "Einträge")}.`;
      return `Der Wert muss mindestens ${min} sein.`;
    }
    case "too_big": {
      const max = Number(issue.maximum);
      if (issue.origin === "string") return `Zu lang – höchstens ${max} Zeichen.`;
      if (issue.origin === "array") {
        return last === "blocks" ? `Höchstens ${max} Module pro Seite.` : `Höchstens ${max} ${plural(max, "Eintrag", "Einträge")}.`;
      }
      return `Der Wert darf höchstens ${max} sein.`;
    }
    case "invalid_format":
      if (last === "href") return LINK_TARGET_HELP;
      if (last === "anchor") return "Nur Kleinbuchstaben, Ziffern und Bindestriche, höchstens 40 Zeichen.";
      return "Ungültige Eingabe.";
    case "invalid_value":
    case "invalid_union":
      return "Bitte eine der angebotenen Möglichkeiten auswählen.";
    case "invalid_type":
      return /received undefined/.test(issue.message) ? "Bitte ausfüllen." : "Ungültige Eingabe.";
    default:
      return "Ungültige Eingabe.";
  }
}

export function issuesFromZod(error: z.ZodError): EditorIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"),
    message: germanIssueMessage(issue),
  }));
}

export type GroupedIssues = {
  /** Fehler an Seitenfeldern (title, description) */
  page: Record<string, string>;
  /** blockId → Feldpfad ("items.0.title", "" = Modul allgemein) → Meldung */
  blocks: Record<string, Record<string, string>>;
  /** Übersicht für die Fehlerliste */
  summary: { blockId: string | null; fieldKey: string; text: string }[];
};

/** Feld-Schlüssel innerhalb eines Moduls, z. B. ["items", 0, "title"] → "items.0.title" */
export function fieldKey(path: (string | number)[]): string {
  return path.join(".");
}

export function groupIssues(issues: EditorIssue[], blocks: Block[]): GroupedIssues {
  const grouped: GroupedIssues = { page: {}, blocks: {}, summary: [] };
  for (const issue of issues) {
    const [head, index, ...rest] = issue.path;
    if (head === "blocks" && typeof index === "number" && blocks[index]) {
      const block = blocks[index];
      const key = fieldKey(rest);
      const map = (grouped.blocks[block.id] ??= {});
      if (map[key]) continue;
      map[key] = issue.message;
      const where = describeBlockPath(block.type, rest);
      const label = `Modul ${index + 1} (${BLOCK_LABELS[block.type]?.label ?? block.type})`;
      grouped.summary.push({ blockId: block.id, fieldKey: key, text: `${label}${where ? `, ${where}` : ""}: ${issue.message}` });
      continue;
    }
    const key = head === undefined ? "_page" : String(head);
    if (grouped.page[key]) continue;
    grouped.page[key] = issue.message;
    const label = key === "title" ? "Seitentitel" : key === "description" ? "Beschreibung" : "Seite";
    grouped.summary.push({ blockId: null, fieldKey: key, text: `${label}: ${issue.message}` });
  }
  return grouped;
}

import type { Block, PageDraft } from "@/cms/schema";
import { BLOCK_FIELDS, type FieldDef } from "@/components/admin/website/block-config";

/**
 * Hilfsfunktionen für den Entwurf. Rein funktional, laufen im Browser und auf dem Server.
 */

type Values = Record<string, unknown>;
export type Path = (string | number)[];

export function getIn(obj: unknown, path: Path): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** Unveränderliches Setzen eines Werts; undefined entfernt den Schlüssel. */
export function setIn<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  if (Array.isArray(obj)) {
    const copy = [...obj];
    copy[head as number] = setIn(copy[head as number], rest, value);
    return copy as T;
  }
  const source = (obj && typeof obj === "object" ? obj : {}) as Values;
  const next = rest.length === 0 ? value : setIn(source[head as string], rest, value);
  const copy: Values = { ...source };
  if (next === undefined) delete copy[head as string];
  else copy[head as string] = next;
  return copy as T;
}

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** Bereinigt Werte nach der Feldbeschreibung: leere optionale Felder entfernen, leere Listeneinträge streichen. */
function normalizeValues(values: Values, defs: FieldDef[]): Values {
  const out: Values = { ...values };
  for (const def of defs) {
    switch (def.kind) {
      case "text":
      case "textarea": {
        const v = out[def.name];
        if (def.optional === "omit" && isBlank(v)) delete out[def.name];
        else if (v === undefined || v === null) out[def.name] = "";
        break;
      }
      case "select":
        if (def.emptyLabel !== undefined && isBlank(out[def.name])) delete out[def.name];
        break;
      case "link": {
        const v = out[def.name] as { label?: unknown; href?: unknown } | undefined;
        if (!v || (isBlank(v.label) && isBlank(v.href))) delete out[def.name];
        else out[def.name] = { label: typeof v.label === "string" ? v.label : "", href: typeof v.href === "string" ? v.href.trim() : "" };
        break;
      }
      case "image":
        if (isBlank(out.imageId)) delete out.imageId;
        if (isBlank(out.imageAlt)) delete out.imageAlt;
        break;
      case "stringList": {
        const v = out[def.name];
        out[def.name] = Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
        break;
      }
      case "list": {
        const v = out[def.name];
        out[def.name] = Array.isArray(v)
          ? v.map((item) => normalizeValues((item && typeof item === "object" ? item : {}) as Values, def.fields))
          : [];
        break;
      }
      default:
        break;
    }
  }
  if (isBlank(out.anchor)) delete out.anchor;
  else if (typeof out.anchor === "string") out.anchor = out.anchor.trim();
  if (out.hidden !== true) delete out.hidden;
  return out;
}

function fieldsOf(type: unknown): FieldDef[] | undefined {
  return typeof type === "string" && Object.hasOwn(BLOCK_FIELDS, type) ? BLOCK_FIELDS[type as Block["type"]] : undefined;
}

export function normalizeBlock(block: Block): Block {
  const defs = fieldsOf(block.type);
  if (!defs) return block;
  return normalizeValues(block as Values, defs) as Block;
}

/** Entwurf so aufbereiten, wie er gespeichert wird. */
export function normalizeDraft(draft: PageDraft): PageDraft {
  const description = typeof draft.description === "string" ? draft.description.trim() : "";
  return {
    title: typeof draft.title === "string" ? draft.title.trim() : "",
    ...(description ? { description } : {}),
    blocks: Array.isArray(draft.blocks) ? draft.blocks.map(normalizeBlock) : [],
  };
}

/** Normalisieren, ohne dem Inhalt aus dem Browser zu vertrauen (für Server Actions). */
export function normalizeUnknownDraft(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const raw = input as Values;
  const blocks = Array.isArray(raw.blocks)
    ? raw.blocks.map((b) => {
        if (!b || typeof b !== "object") return b;
        const defs = fieldsOf((b as Values).type);
        return defs ? normalizeValues(b as Values, defs) : b;
      })
    : raw.blocks;
  return {
    title: typeof raw.title === "string" ? raw.title.trim() : raw.title,
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : undefined,
    blocks,
  };
}

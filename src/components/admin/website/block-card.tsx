"use client";

import { memo } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { BLOCK_LABELS, type Block } from "@/cms/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Hint, Input, Label } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { BLOCK_FIELDS, blockSummary } from "@/components/admin/website/block-config";
import { FieldList } from "@/components/admin/website/block-fields";
import { IconButton } from "@/components/admin/website/dialog";
import { fieldDomId } from "@/components/admin/website/editor-context";
import type { Path } from "@/components/admin/website/draft-utils";

type Props = {
  block: Block;
  index: number;
  total: number;
  expanded: boolean;
  errors: Record<string, string> | undefined;
  onToggle: (id: string) => void;
  onChange: (id: string, path: Path, value: unknown) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onRemove: (id: string) => void;
  onInsertBelow: (index: number) => void;
};

const NO_ERRORS: Record<string, string> = {};

function BlockCardImpl({
  block,
  index,
  total,
  expanded,
  errors = NO_ERRORS,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onToggleHidden,
  onRemove,
  onInsertBelow,
}: Props) {
  const meta = BLOCK_LABELS[block.type];
  const summary = blockSummary(block);
  const errorCount = Object.keys(errors).length;
  const position = `Modul ${index + 1}`;
  const bodyId = fieldDomId(block.id, ["body"]);
  const anchorId = fieldDomId(block.id, ["anchor"]);
  const anchorError = errors.anchor;
  const generalError = errors[""];
  const hidden = block.hidden === true;

  return (
    <li
      id={fieldDomId(block.id, ["card"])}
      className={cn(
        "scroll-mt-40 rounded-2xl border shadow-card",
        hidden ? "border-dashed bg-mist" : "bg-white",
        errorCount > 0 ? "border-red-300 ring-1 ring-red-200" : hidden ? "border-line-strong" : "border-line",
      )}
    >
      <div className="flex flex-col gap-1 p-2 sm:flex-row sm:items-center sm:gap-2 sm:p-3">
        <button
          id={fieldDomId(block.id, ["toggle"])}
          type="button"
          onClick={() => onToggle(block.id)}
          aria-expanded={expanded}
          aria-controls={expanded ? bodyId : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-brand-50/60"
        >
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold",
              hidden ? "bg-white text-ink-muted ring-1 ring-line" : "bg-brand-100 text-brand-800",
            )}
            aria-hidden
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-ink">
                <span className="sr-only">{position}: </span>
                {meta?.label ?? block.type}
              </span>
              {hidden ? <Badge tone="gray">Ausgeblendet</Badge> : null}
              {errorCount > 0 ? (
                <Badge tone="red">{errorCount === 1 ? "1 Fehler" : `${errorCount} Fehler`}</Badge>
              ) : null}
            </span>
            <span className={cn("block truncate text-sm", hidden ? "text-ink-muted/80" : "text-ink-muted")}>
              {summary || meta?.description}
            </span>
          </span>
          <ChevronDown
            className={cn("size-5 shrink-0 text-ink-muted transition-transform", expanded && "rotate-180")}
            aria-hidden
          />
        </button>

        <div className="flex items-center justify-end gap-0.5 sm:justify-start" role="group" aria-label={`Aktionen für ${position}`}>
          <IconButton
            id={fieldDomId(block.id, ["up"])}
            label={`${position} nach oben verschieben`}
            disabled={index === 0}
            onClick={() => onMove(block.id, -1)}
          >
            <ArrowUp className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            id={fieldDomId(block.id, ["down"])}
            label={`${position} nach unten verschieben`}
            disabled={index === total - 1}
            onClick={() => onMove(block.id, 1)}
          >
            <ArrowDown className="size-4" aria-hidden />
          </IconButton>
          <IconButton id={fieldDomId(block.id, ["copy"])} label={`${position} duplizieren`} onClick={() => onDuplicate(block.id)}>
            <Copy className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            id={fieldDomId(block.id, ["visibility"])}
            label={hidden ? `${position} wieder einblenden` : `${position} ausblenden`}
            onClick={() => onToggleHidden(block.id)}
          >
            {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </IconButton>
          <IconButton id={fieldDomId(block.id, ["delete"])} label={`${position} löschen`} tone="danger" onClick={() => onRemove(block.id)}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {expanded ? (
        <div id={bodyId} className="space-y-6 border-t border-line px-4 py-5 sm:px-6">
          {hidden ? (
            <p className="rounded-xl bg-white px-4 py-3 text-sm text-ink-soft ring-1 ring-line ring-inset">
              Dieses Modul ist ausgeblendet und erscheint nicht auf der Website. Inhalt und Einstellungen bleiben erhalten.
            </p>
          ) : null}
          {meta?.description ? <p className="text-sm text-ink-muted">{meta.description}.</p> : null}
          <FieldError>{generalError}</FieldError>

          <FieldList
            defs={BLOCK_FIELDS[block.type] ?? []}
            blockId={block.id}
            prefix={[]}
            values={block as Record<string, unknown>}
            errors={errors}
            onChange={(path, value) => onChange(block.id, path, value)}
          />

          <details className="rounded-xl border border-line px-4 py-3" open={block.anchor || anchorError ? true : undefined}>
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft select-none">Erweitert: Sprunganker</summary>
            <div className="mt-3">
              <Label htmlFor={anchorId} className="mb-1.5">
                Sprunganker
              </Label>
              <Input
                id={anchorId}
                value={block.anchor ?? ""}
                maxLength={40}
                placeholder="z. B. hilfe-anfordern"
                autoCapitalize="off"
                spellCheck={false}
                aria-invalid={anchorError ? true : undefined}
                aria-describedby={`${anchorId}-hint${anchorError ? ` ${anchorId}-error` : ""}`}
                onChange={(e) => onChange(block.id, ["anchor"], e.target.value === "" ? undefined : e.target.value)}
              />
              <Hint id={`${anchorId}-hint`}>
                Damit lässt sich direkt zu diesem Abschnitt verlinken, z. B. mit dem Ziel{" "}
                <span className="font-mono text-xs">#{block.anchor || "hilfe-anfordern"}</span>. Nur Kleinbuchstaben, Ziffern und Bindestriche.
              </Hint>
              <FieldError id={`${anchorId}-error`}>{anchorError}</FieldError>
            </div>
          </details>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => onInsertBelow(index + 1)}>
              <Plus className="size-4" aria-hidden />
              Modul darunter einfügen
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onToggle(block.id)}>
              Zuklappen
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export const BlockCard = memo(BlockCardImpl);

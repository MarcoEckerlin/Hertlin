"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ImageOff, Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, FieldError, Hint, Input, Label, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type {
  FieldDef,
  ImageFieldDef,
  InfoFieldDef,
  LinkFieldDef,
  ListFieldDef,
  SelectFieldDef,
  StringListFieldDef,
  TextareaFieldDef,
  TextFieldDef,
} from "@/components/admin/website/block-config";
import { CmsIcon } from "@/components/admin/website/cms-icon";
import { IconButton } from "@/components/admin/website/dialog";
import { fieldDomId, useEditor } from "@/components/admin/website/editor-context";
import type { Path } from "@/components/admin/website/draft-utils";

type Values = Record<string, unknown>;
type ChangeFn = (path: Path, value: unknown) => void;

type CommonProps = {
  blockId: string;
  /** Pfad vom Modul bis zum Objekt, das die Felder enthält (z. B. ["items", 2]) */
  prefix: Path;
  values: Values;
  /** Fehler des Moduls, Schlüssel = Pfad mit Punkten ("items.2.title") */
  errors: Record<string, string>;
  onChange: ChangeFn;
};

const key = (path: Path) => path.join(".");

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function FieldShell({
  id,
  label,
  optional,
  hint,
  error,
  extra,
  children,
}: {
  id: string;
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {optional ? <span className="text-xs text-ink-muted">optional</span> : null}
      </div>
      {children}
      {hint ? <Hint id={`${id}-hint`}>{hint}</Hint> : null}
      {extra}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

const code = "rounded bg-mist px-1 py-px font-mono text-[0.78rem] text-ink-soft ring-1 ring-line";

/** Kurzhilfe für Felder mit einfachem Markdown */
export function MarkdownHint() {
  return (
    <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
      Leerzeile = neuer Absatz · <code className={code}>## Zwischenüberschrift</code> · <code className={code}>- Aufzählung</code> ·{" "}
      <code className={code}>**fett**</code> · <code className={code}>*kursiv*</code> ·{" "}
      <code className={code}>[Linktext](/kontakt)</code> · Platzhalter wie <code className={code}>{"{telefon}"}</code>
    </p>
  );
}

/* ---------------- Einzelne Feldtypen ---------------- */

function TextField({ def, blockId, prefix, values, errors, onChange }: CommonProps & { def: TextFieldDef }) {
  const path = [...prefix, def.name];
  const id = fieldDomId(blockId, path);
  const error = errors[key(path)];
  return (
    <FieldShell id={id} label={def.label} optional={!!def.optional} hint={def.hint} error={error}>
      <Input
        id={id}
        value={asString(values[def.name])}
        maxLength={def.max}
        placeholder={def.placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, def.hint, error)}
        onChange={(e) => onChange(path, e.target.value === "" && def.optional === "omit" ? undefined : e.target.value)}
      />
    </FieldShell>
  );
}

function TextareaField({ def, blockId, prefix, values, errors, onChange }: CommonProps & { def: TextareaFieldDef }) {
  const path = [...prefix, def.name];
  const id = fieldDomId(blockId, path);
  const error = errors[key(path)];
  const value = asString(values[def.name]);
  const minRows = def.rows ?? 4;
  const rows = Math.min(28, Math.max(minRows, value.split("\n").length + 1));
  return (
    <FieldShell
      id={id}
      label={def.label}
      optional={!!def.optional}
      hint={def.hint}
      error={error}
      extra={def.markdown ? <MarkdownHint /> : null}
    >
      <Textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={def.max}
        placeholder={def.placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, def.hint, error)}
        onChange={(e) => onChange(path, e.target.value === "" && def.optional === "omit" ? undefined : e.target.value)}
      />
    </FieldShell>
  );
}

function SelectField({ def, blockId, prefix, values, errors, onChange }: CommonProps & { def: SelectFieldDef }) {
  const path = [...prefix, def.name];
  const id = fieldDomId(blockId, path);
  const error = errors[key(path)];
  const raw = values[def.name];
  const value = raw === undefined || raw === null ? "" : String(raw);
  const select = (
    <Select
      id={id}
      value={value}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, def.hint, error)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" && def.emptyLabel !== undefined) onChange(path, undefined);
        else onChange(path, def.numeric ? Number(v) : v);
      }}
    >
      {def.emptyLabel !== undefined ? <option value="">{def.emptyLabel}</option> : null}
      {def.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
  return (
    <FieldShell id={id} label={def.label} optional={def.emptyLabel !== undefined} hint={def.hint} error={error}>
      {def.iconPreview ? (
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <CmsIcon name={value || undefined} className="size-5" />
          </span>
          <div className="min-w-0 flex-1">{select}</div>
        </div>
      ) : (
        select
      )}
    </FieldShell>
  );
}

function CheckboxField({ def, blockId, prefix, values, onChange }: CommonProps & { def: Extract<FieldDef, { kind: "checkbox" }> }) {
  const path = [...prefix, def.name];
  return (
    <Checkbox
      id={fieldDomId(blockId, path)}
      label={def.label}
      hint={def.hint}
      checked={values[def.name] === true}
      onChange={(e) => onChange(path, e.target.checked)}
    />
  );
}

function LinkField({ def, blockId, prefix, values, errors, onChange }: CommonProps & { def: LinkFieldDef }) {
  const { linkListId } = useEditor();
  const path = [...prefix, def.name];
  const current = (values[def.name] ?? null) as { label?: string; href?: string } | null;
  const labelId = fieldDomId(blockId, [...path, "label"]);
  const hrefId = fieldDomId(blockId, [...path, "href"]);
  const labelError = errors[key([...path, "label"])];
  const hrefError = errors[key([...path, "href"])];
  const groupError = errors[key(path)];

  const update = (part: "label" | "href", value: string) => {
    const next = { label: current?.label ?? "", href: current?.href ?? "", [part]: value };
    onChange(path, next.label === "" && next.href === "" ? undefined : next);
  };

  return (
    <fieldset className="rounded-xl border border-line px-4 pt-3 pb-4">
      <legend className="px-1 text-sm font-semibold text-ink">
        {def.label} <span className="ml-1 text-xs font-normal text-ink-muted">optional</span>
      </legend>
      {def.hint ? <p className="mb-3 text-sm text-ink-muted">{def.hint}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={labelId} className="mb-1.5">
            Beschriftung
          </Label>
          <Input
            id={labelId}
            value={current?.label ?? ""}
            maxLength={60}
            placeholder="z. B. Anfrage stellen"
            aria-invalid={labelError ? true : undefined}
            aria-describedby={labelError ? `${labelId}-error` : undefined}
            onChange={(e) => update("label", e.target.value)}
          />
          <FieldError id={`${labelId}-error`}>{labelError}</FieldError>
        </div>
        <div>
          <Label htmlFor={hrefId} className="mb-1.5">
            Ziel
          </Label>
          <Input
            id={hrefId}
            value={current?.href ?? ""}
            maxLength={500}
            list={linkListId}
            placeholder="/kontakt"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={hrefError ? true : undefined}
            aria-describedby={`${hrefId}-hint${hrefError ? ` ${hrefId}-error` : ""}`}
            onChange={(e) => update("href", e.target.value)}
          />
          <FieldError id={`${hrefId}-error`}>{hrefError}</FieldError>
        </div>
      </div>
      <p id={`${hrefId}-hint`} className="mt-2 text-xs leading-relaxed text-ink-muted">
        Ziel z. B. <code className={code}>/kontakt</code>, <code className={code}>#anker</code>, <code className={code}>https://…</code>,{" "}
        <code className={code}>mailto:…</code>, <code className={code}>tel:+49…</code> oder <code className={code}>{"{fernwartung}"}</code>.
        Beide Felder leer lassen, wenn kein Link gewünscht ist.
      </p>
      <FieldError>{groupError}</FieldError>
    </fieldset>
  );
}

function ImageField({ def, blockId, values, errors, onChange }: CommonProps & { def: ImageFieldDef }) {
  const { media, openMediaPicker } = useEditor();
  const imageId = asString(values.imageId);
  const alt = asString(values.imageAlt);
  const selected = imageId ? media.find((m) => m.id === imageId) : undefined;
  const buttonId = fieldDomId(blockId, ["imageId"]);
  const altId = fieldDomId(blockId, ["imageAlt"]);
  const imageError = errors.imageId;
  const altError = errors.imageAlt;

  const choose = () =>
    openMediaPicker({
      selectedId: imageId || undefined,
      onSelect: (item) => {
        onChange(["imageId"], item.id);
        if (!alt && item.alt) onChange(["imageAlt"], item.alt);
      },
    });

  return (
    <fieldset className="rounded-xl border border-line px-4 pt-3 pb-4">
      <legend className="px-1 text-sm font-semibold text-ink">
        {def.label} <span className="ml-1 text-xs font-normal text-ink-muted">optional</span>
      </legend>
      {def.hint ? <p className="mb-3 text-sm text-ink-muted">{def.hint}</p> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid aspect-[4/3] w-full shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-mist sm:w-44">
          {selected ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selected.url} alt="" className="size-full object-cover" />
          ) : imageId ? (
            <span className="flex flex-col items-center gap-1 px-3 text-center text-xs text-red-700">
              <ImageOff className="size-5" aria-hidden />
              Bild nicht mehr vorhanden
            </span>
          ) : (
            <span className="px-3 text-center text-xs text-ink-muted">Kein Bild ausgewählt</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {selected ? <p className="truncate text-sm text-ink-soft">{selected.fileName}</p> : null}
          {imageId && !selected ? (
            <p className="text-sm text-red-700">Das ausgewählte Bild wurde aus der Mediathek gelöscht. Bitte wählen Sie ein anderes.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              id={buttonId}
              variant="secondary"
              size="sm"
              onClick={choose}
              aria-describedby={imageError ? `${buttonId}-error` : undefined}
            >
              {imageId ? "Anderes Bild wählen" : "Bild auswählen"}
            </Button>
            {imageId ? (
              <Button variant="ghost" size="sm" onClick={() => onChange(["imageId"], undefined)}>
                Bild entfernen
              </Button>
            ) : null}
          </div>
          <FieldError id={`${buttonId}-error`}>{imageError}</FieldError>
          <div>
            <Label htmlFor={altId} className="mb-1.5">
              Bildbeschreibung (Alternativtext)
            </Label>
            <Input
              id={altId}
              value={alt}
              maxLength={200}
              placeholder="z. B. Techniker richtet einen Arbeitsplatz ein"
              aria-invalid={altError ? true : undefined}
              aria-describedby={`${altId}-hint${altError ? ` ${altId}-error` : ""}`}
              onChange={(e) => onChange(["imageAlt"], e.target.value === "" ? undefined : e.target.value)}
            />
            <Hint id={`${altId}-hint`}>Ein kurzer Satz, was zu sehen ist – für Screenreader und Suchmaschinen.</Hint>
            <FieldError id={`${altId}-error`}>{altError}</FieldError>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function InfoField({ def }: { def: InfoFieldDef }) {
  return (
    <div className="flex gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100 ring-inset">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="leading-relaxed">
        {def.text}
        {def.href ? (
          <>
            {" "}
            <Link href={def.href} target="_blank" className="font-semibold underline underline-offset-2">
              {def.linkLabel ?? "Öffnen"}
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}

function hasContent(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasContent);
  if (value && typeof value === "object") return Object.values(value).some(hasContent);
  return false;
}

function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function ListField({ def, blockId, prefix, values, errors, onChange }: CommonProps & { def: ListFieldDef }) {
  const { confirm, focusLater } = useEditor();
  const path = [...prefix, def.name];
  const items = (Array.isArray(values[def.name]) ? values[def.name] : []) as Values[];
  const listError = errors[key(path)];
  const min = def.min ?? 0;
  const addId = fieldDomId(blockId, [...path, "add"]);

  const remove = async (index: number) => {
    const item = items[index];
    if (hasContent(item)) {
      const ok = await confirm({
        title: `${def.itemLabel} ${index + 1} entfernen?`,
        message: `„${asString(item.title) || asString(item.question) || `${def.itemLabel} ${index + 1}`}“ wird mit allen Angaben entfernt.`,
        confirmLabel: "Entfernen",
      });
      if (!ok) return;
    }
    onChange(
      path,
      items.filter((_, i) => i !== index),
    );
    focusLater(fieldDomId(blockId, [...path, Math.min(index, items.length - 2), "remove"]), addId);
  };

  const shift = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    onChange(path, move(items, index, to));
    focusLater(fieldDomId(blockId, [...path, to, dir < 0 ? "up" : "down"]), fieldDomId(blockId, [...path, to, "remove"]));
  };

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        <span>{def.label}</span>
        <span className="text-xs font-normal text-ink-muted">
          {items.length} von höchstens {def.max}
        </span>
      </legend>
      {def.hint ? <p className="mb-3 text-sm text-ink-muted">{def.hint}</p> : null}
      <ol className="space-y-3">
        {items.map((item, index) => {
          const itemTitle = asString(item.title) || asString(item.question);
          return (
            <li key={index} className="rounded-xl border border-line bg-mist/60">
              <div className="flex items-center gap-2 border-b border-line py-1.5 pr-1.5 pl-4">
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                  {def.itemLabel} {index + 1}
                  {itemTitle ? <span className="font-normal text-ink-muted"> – {itemTitle}</span> : null}
                </p>
                <IconButton
                  id={fieldDomId(blockId, [...path, index, "up"])}
                  label={`${def.itemLabel} ${index + 1} nach oben`}
                  disabled={index === 0}
                  onClick={() => shift(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  id={fieldDomId(blockId, [...path, index, "down"])}
                  label={`${def.itemLabel} ${index + 1} nach unten`}
                  disabled={index === items.length - 1}
                  onClick={() => shift(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  id={fieldDomId(blockId, [...path, index, "remove"])}
                  label={`${def.itemLabel} ${index + 1} entfernen`}
                  tone="danger"
                  disabled={items.length <= min}
                  onClick={() => void remove(index)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
              <div className="px-4 py-4">
                <FieldList
                  defs={def.fields}
                  blockId={blockId}
                  prefix={[...path, index]}
                  values={item}
                  errors={errors}
                  onChange={onChange}
                />
              </div>
            </li>
          );
        })}
      </ol>
      {items.length === 0 ? <p className="rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm text-ink-muted">Noch keine Einträge.</p> : null}
      <FieldError>{listError}</FieldError>
      <Button
        id={addId}
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={items.length >= def.max}
        onClick={() => {
          onChange(path, [...items, def.newItem()]);
          const firstField = def.fields.find((f) => f.kind === "text" || f.kind === "textarea");
          if (firstField && "name" in firstField) focusLater(fieldDomId(blockId, [...path, items.length, firstField.name]));
        }}
      >
        <Plus className="size-4" aria-hidden />
        {def.addLabel}
      </Button>
    </fieldset>
  );
}

function StringListField({ def, blockId, prefix, values, errors, onChange }: CommonProps & { def: StringListFieldDef }) {
  const { focusLater } = useEditor();
  const path = [...prefix, def.name];
  const items = (Array.isArray(values[def.name]) ? values[def.name] : []) as string[];
  const listError = errors[key(path)];
  const addId = fieldDomId(blockId, [...path, "add"]);

  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm font-semibold text-ink">
        <span>{def.label}</span>
        <span className="text-xs font-normal text-ink-muted">
          {items.length} von höchstens {def.max}
        </span>
      </legend>
      {def.hint ? <p className="mb-3 text-sm text-ink-muted">{def.hint}</p> : null}
      <ol className="space-y-2">
        {items.map((item, index) => {
          const id = fieldDomId(blockId, [...path, index]);
          const error = errors[key([...path, index])];
          return (
            <li key={index}>
              <div className="flex items-center gap-1">
                <label htmlFor={id} className="sr-only">
                  {def.itemLabel} {index + 1}
                </label>
                <Input
                  id={id}
                  value={item}
                  maxLength={def.maxLength}
                  placeholder={def.placeholder ?? `${def.itemLabel} ${index + 1}`}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  onChange={(e) => onChange([...path, index], e.target.value)}
                  onKeyDown={(e) => {
                    // Enter legt direkt den nächsten Punkt an
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && items.length < def.max) {
                      e.preventDefault();
                      const next = [...items];
                      next.splice(index + 1, 0, "");
                      onChange(path, next);
                      focusLater(fieldDomId(blockId, [...path, index + 1]));
                    }
                  }}
                />
                <IconButton
                  label={`${def.itemLabel} ${index + 1} nach oben`}
                  disabled={index === 0}
                  onClick={() => {
                    onChange(path, move(items, index, index - 1));
                    focusLater(fieldDomId(blockId, [...path, index - 1]));
                  }}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={`${def.itemLabel} ${index + 1} nach unten`}
                  disabled={index === items.length - 1}
                  onClick={() => {
                    onChange(path, move(items, index, index + 1));
                    focusLater(fieldDomId(blockId, [...path, index + 1]));
                  }}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </IconButton>
                <IconButton
                  label={`${def.itemLabel} ${index + 1} entfernen`}
                  tone="danger"
                  onClick={() => {
                    onChange(
                      path,
                      items.filter((_, i) => i !== index),
                    );
                    focusLater(fieldDomId(blockId, [...path, Math.max(0, index - 1)]), addId);
                  }}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </div>
              <FieldError id={`${id}-error`}>{error}</FieldError>
            </li>
          );
        })}
      </ol>
      {items.length === 0 ? <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-muted">Noch keine Einträge.</p> : null}
      <FieldError>{listError}</FieldError>
      <Button
        id={addId}
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={items.length >= def.max}
        onClick={() => {
          onChange(path, [...items, ""]);
          focusLater(fieldDomId(blockId, [...path, items.length]));
        }}
      >
        <Plus className="size-4" aria-hidden />
        {def.addLabel}
      </Button>
      <p className="mt-2 text-xs text-ink-muted">Tipp: Mit der Eingabetaste legen Sie direkt den nächsten Eintrag an. Leere Einträge werden beim Speichern entfernt.</p>
    </fieldset>
  );
}

/* ---------------- Liste aller Felder ---------------- */

export function FieldList({
  defs,
  blockId,
  prefix,
  values,
  errors,
  onChange,
  className,
}: CommonProps & { defs: FieldDef[]; className?: string }) {
  const common = { blockId, prefix, values, errors, onChange };
  return (
    <div className={cn("space-y-5", className)}>
      {defs.map((def, i) => {
        if (def.showIf && !def.showIf(values)) return null;
        const k = `${def.kind}-${"name" in def ? def.name : i}`;
        switch (def.kind) {
          case "text":
            return <TextField key={k} def={def} {...common} />;
          case "textarea":
            return <TextareaField key={k} def={def} {...common} />;
          case "select":
            return <SelectField key={k} def={def} {...common} />;
          case "checkbox":
            return <CheckboxField key={k} def={def} {...common} />;
          case "link":
            return <LinkField key={k} def={def} {...common} />;
          case "image":
            return <ImageField key={k} def={def} {...common} />;
          case "info":
            return <InfoField key={k} def={def} />;
          case "list":
            return <ListField key={k} def={def} {...common} />;
          case "stringList":
            return <StringListField key={k} def={def} {...common} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

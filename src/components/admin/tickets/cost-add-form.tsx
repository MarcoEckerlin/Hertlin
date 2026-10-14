"use client";

import { useActionState, useId, useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { addCostAction } from "@/lib/actions/admin-costs";
import { initialFormState } from "@/lib/forms";
import { COST_KINDS, COST_KIND_DEFAULT_UNIT, COST_KIND_LABELS, COST_UNITS, type CostKind } from "@/lib/constants";
import { centsToInput, formatMoney } from "@/lib/format";
import {
  COST_NOTE_MAX,
  PRESET_NAME_MAX,
  composeCostDescription,
  formatQuantityWithUnit,
  groupPresetsForPicker,
  presetMatchesQuery,
  presetNameKey,
  quantityToInput,
} from "@/lib/cost-catalog";
import { cn } from "@/lib/cn";
import { Checkbox, Field, FieldError, Input, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { fieldA11y, useStaffForm } from "@/components/admin/tickets/use-staff-form";
import { PerformerField, PriceField, TotalOutput, costControl } from "@/components/admin/tickets/cost-fields";
import type { PresetOption, StaffChoice } from "@/components/admin/tickets/cost-values";

type Mode = "katalog" | "neu";

type Props = {
  ticketId: number;
  presets: PresetOption[];
  staff: StaffChoice[];
  currentUserId: string;
  /** Administratoren sehen und setzen Preise */
  canSetPrice: boolean;
  laborHint: string;
  /** YYYY-MM-DD, vom Server (deutsche Zeit) */
  today: string;
};

/**
 * Position erfassen: aus dem Katalog (durchsuchbar, nach Art gruppiert, häufig benutzte zuerst)
 * oder als neue Position, die standardmäßig in den Katalog aufgenommen wird.
 */
export function CostAddForm(props: Props) {
  const [state, action] = useActionState(addCostAction, initialFormState);
  const { formRef, formKey } = useStaffForm(state);
  const values = state.status === "error" ? (state.values ?? null) : null;

  return (
    <form key={formKey} ref={formRef} action={action} noValidate className="@container space-y-4">
      <input type="hidden" name="ticketId" value={props.ticketId} />
      <FormMessage state={state} />
      <AddFields {...props} values={values} errors={state.fieldErrors ?? {}} />
      <div className="pt-1">
        <SubmitButton pendingText="Wird gespeichert …">Position hinzufügen</SubmitButton>
      </div>
    </form>
  );
}

function AddFields({
  presets,
  staff,
  currentUserId,
  canSetPrice,
  laborHint,
  today,
  values,
  errors,
}: Props & { values: Record<string, string> | null; errors: Record<string, string> }) {
  const hasPresets = presets.length > 0;
  const initialPreset = presets.find((p) => p.id === values?.presetId) ?? null;

  const [mode, setMode] = useState<Mode>(!hasPresets || values?.mode === "neu" ? "neu" : "katalog");
  const [presetId, setPresetId] = useState(initialPreset?.id ?? "");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState(values?.note ?? "");
  const [description, setDescription] = useState(values?.description ?? "");
  const [kind, setKind] = useState<string>(values?.kind ?? "LABOR");
  const [unit, setUnit] = useState<string>(values?.unit ?? COST_KIND_DEFAULT_UNIT.LABOR);
  const [quantity, setQuantity] = useState(
    values?.quantity ?? (initialPreset ? quantityToInput(initialPreset.defaultQuantityHundredths) : "1"),
  );
  const [unitPrice, setUnitPrice] = useState(values?.unitPrice ?? "");
  // Von Hand geänderter Preis wird beim Wechsel zwischen Katalog und neuer Position nicht überschrieben
  const [priceTouched, setPriceTouched] = useState(Boolean(values?.unitPrice));
  const descriptionRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const preset = presets.find((p) => p.id === presetId) ?? null;
  const visible = presets.filter((p) => presetMatchesQuery(p, search));
  const groups = groupPresetsForPicker(visible);
  const firstVisible = groups[0]?.presets[0] ?? null;

  // Freie Bezeichnung, die es im Katalog schon gibt
  const descriptionKey = presetNameKey(description);
  const existing = mode === "neu" && descriptionKey ? (presets.find((p) => presetNameKey(p.name) === descriptionKey) ?? null) : null;

  function catalogPriceInput(p: PresetOption | null): string {
    return p?.unitPriceCents === null || p?.unitPriceCents === undefined ? "" : centsToInput(p.unitPriceCents);
  }

  function choose(p: PresetOption) {
    setPresetId(p.id);
    setQuantity(quantityToInput(p.defaultQuantityHundredths));
    if (canSetPrice) {
      setUnitPrice(catalogPriceInput(p));
      setPriceTouched(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    if (!canSetPrice || priceTouched) return;
    // Vorbelegter Katalogpreis gehört nur zur gewählten Katalogposition
    setUnitPrice(next === "katalog" ? catalogPriceInput(preset) : "");
  }

  function chooseFromCatalog(p: PresetOption) {
    setMode("katalog");
    setSearch("");
    choose(p);
    requestAnimationFrame(() => document.getElementById(`kosten-preset-${p.id}`)?.focus());
  }

  function startNew(name: string) {
    switchMode("neu");
    setDescription(name.trim());
    requestAnimationFrame(() => descriptionRef.current?.focus());
  }

  function changePrice(value: string) {
    setUnitPrice(value);
    setPriceTouched(true);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    // Enter würde das Formular absenden – stattdessen den ersten Treffer auswählen
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (firstVisible) {
      choose(firstVisible);
      document.getElementById(`kosten-preset-${firstVisible.id}`)?.focus();
    }
  }

  function changeKind(next: string) {
    setKind(next);
    const defaultUnit = COST_KIND_DEFAULT_UNIT[next as CostKind];
    if (defaultUnit) setUnit(defaultUnit);
  }

  const activeUnit = mode === "katalog" ? (preset?.unit ?? "") : unit;
  const activeKind = mode === "katalog" ? (preset?.kind ?? "") : kind;
  const showDetails = mode === "neu" || preset !== null;
  const showLaborHint = activeKind === "LABOR" && activeUnit === "Std.";

  let priceHint: string | undefined;
  if (canSetPrice) {
    if (mode === "katalog" && preset && preset.unitPriceCents !== null && preset.unitPriceCents !== undefined) {
      priceHint = `Katalog: ${formatMoney(preset.unitPriceCents)}`;
    } else {
      priceHint = "Leer = Preis folgt später";
    }
  }

  return (
    <>
      {hasPresets ? (
        <fieldset className="min-w-0">
          <legend className="sr-only">Woher kommt die Position?</legend>
          <div className="grid max-w-md grid-cols-2 gap-1 rounded-full bg-white p-1 ring-1 ring-line-strong ring-inset">
            {(
              [
                ["katalog", "Aus dem Katalog"],
                ["neu", "Neue Position"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="relative block min-w-0 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => switchMode(value)}
                  // Unsichtbar über der ganzen Fläche: Klick und Tastatur landen direkt auf der Option
                  className="peer absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-full opacity-0"
                />
                <span className="flex min-h-9 items-center justify-center rounded-full px-3 py-1.5 text-center text-sm font-semibold text-ink-soft transition-colors peer-checked:bg-brand-100 peer-checked:text-ink peer-checked:ring-1 peer-checked:ring-brand-300 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:text-ink">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <>
          <input type="hidden" name="mode" value="neu" />
          <p className="text-sm text-ink-soft">Der Katalog ist noch leer. Neue Positionen landen automatisch dort.</p>
        </>
      )}

      {mode === "katalog" ? (
        <div className="space-y-4">
          <input type="hidden" name="presetId" value={presetId} />
          <div>
            <label htmlFor="kosten-suche" className="mb-1.5 block text-sm font-semibold text-ink">
              Katalog durchsuchen
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <Input
                id="kosten-suche"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchKey}
                autoComplete="off"
                placeholder="z. B. Anfahrt, Fernwartung, Kabel"
                aria-controls={listId}
                aria-describedby="kosten-suche-hint"
                className={cn(costControl, "pl-9")}
              />
            </div>
            <p id="kosten-suche-hint" className="sr-only">
              Enter wählt den ersten Treffer. Mit den Pfeiltasten wechseln Sie in der Liste.
            </p>
          </div>

          <fieldset
            id={listId}
            aria-invalid={errors.presetId ? true : undefined}
            aria-describedby={errors.presetId ? "kosten-presetId-error" : undefined}
            className="min-w-0"
          >
            <legend className="sr-only">Position aus dem Katalog</legend>
            <div
              className={cn(
                "max-h-72 overflow-y-auto overscroll-contain rounded-xl border bg-white",
                errors.presetId ? "border-red-400" : "border-line-strong",
              )}
            >
              {groups.map((group) => (
                <div key={group.kind} role="group" aria-labelledby={`${listId}-${group.kind}`}>
                  <p
                    id={`${listId}-${group.kind}`}
                    className="sticky top-0 z-10 border-b border-line bg-mist px-3.5 py-1.5 text-xs font-semibold text-ink-muted"
                  >
                    {group.label}
                  </p>
                  <ul className="divide-y divide-line">
                    {group.presets.map((p) => (
                      <li key={p.id}>
                        <label
                          htmlFor={`kosten-preset-${p.id}`}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-sm transition-colors hover:bg-brand-50",
                            presetId === p.id && "bg-brand-50",
                          )}
                        >
                          <input
                            id={`kosten-preset-${p.id}`}
                            type="radio"
                            name="presetPick"
                            value={p.id}
                            checked={presetId === p.id}
                            onChange={() => choose(p)}
                            className="size-4 shrink-0 cursor-pointer accent-brand-600"
                          />
                          <span className="min-w-0 flex-1 break-words text-ink">{p.name}</span>
                          <span className="shrink-0 text-right text-xs text-ink-muted tabular-nums">
                            {formatQuantityWithUnit(p.defaultQuantityHundredths, p.unit)}
                            {canSetPrice ? (
                              <span className="block font-semibold text-ink-soft">
                                {p.unitPriceCents === null || p.unitPriceCents === undefined
                                  ? "Preis je Position"
                                  : `${formatMoney(p.unitPriceCents)} / ${p.unit}`}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {groups.length === 0 ? (
                <div className="px-4 py-5 text-sm text-ink-soft">
                  <p>Nichts gefunden für „{search.trim()}“.</p>
                  <button
                    type="button"
                    onClick={() => startNew(search)}
                    className="mt-2 font-semibold text-brand-700 underline-offset-2 hover:underline"
                  >
                    Als neue Position erfassen
                  </button>
                </div>
              ) : null}
            </div>
            <FieldError id="kosten-presetId-error">{errors.presetId}</FieldError>
          </fieldset>

          {preset ? (
            <Field
              label="Notiz"
              htmlFor="kosten-note"
              optional
              error={errors.note}
              hint={
                <>
                  Steht so auf der Position: <span className="font-semibold text-ink">„{composeCostDescription(preset.name, note)}“</span>
                </>
              }
            >
              <Input
                {...fieldA11y("kosten-note", errors.note, true)}
                name="note"
                maxLength={COST_NOTE_MAX}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="z. B. Trommel getauscht"
                className={costControl}
              />
            </Field>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <Field
            label="Bezeichnung"
            htmlFor="kosten-description"
            error={errors.description}
            hint={
              existing ? (
                <>
                  „{existing.name}“ steht schon im Katalog.{" "}
                  <button
                    type="button"
                    onClick={() => chooseFromCatalog(existing)}
                    className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                  >
                    Aus dem Katalog wählen
                  </button>
                </>
              ) : undefined
            }
          >
            <Input
              {...fieldA11y("kosten-description", errors.description, Boolean(existing))}
              ref={descriptionRef}
              name="description"
              maxLength={PRESET_NAME_MAX}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === "MATERIAL" ? "z. B. Netzteil Dell 90 W" : kind === "TRAVEL" ? "z. B. Anfahrt Neu-Ulm" : "z. B. Drucker eingerichtet"
              }
              className={costControl}
            />
          </Field>
        </div>
      )}

      {showDetails ? (
        <div className="grid grid-cols-2 gap-4 @xl:grid-cols-4">
          {mode === "neu" ? (
            <>
              <Field label="Art" htmlFor="kosten-kind" error={errors.kind}>
                <Select
                  {...fieldA11y("kosten-kind", errors.kind)}
                  name="kind"
                  value={kind}
                  onChange={(e) => changeKind(e.target.value)}
                  className={costControl}
                >
                  {COST_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {COST_KIND_LABELS[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Einheit" htmlFor="kosten-unit" error={errors.unit}>
                <Select
                  {...fieldA11y("kosten-unit", errors.unit)}
                  name="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className={costControl}
                >
                  {COST_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : null}
          <Field label={mode === "katalog" && preset ? `Menge (${preset.unit})` : "Menge"} htmlFor="kosten-quantity" error={errors.quantity}>
            <Input
              {...fieldA11y("kosten-quantity", errors.quantity, showLaborHint)}
              name="quantity"
              inputMode="decimal"
              autoComplete="off"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="1,25"
              className={cn(costControl, "tabular-nums")}
            />
          </Field>
          <Field label="Datum" htmlFor="kosten-date" error={errors.performedAt}>
            <Input
              {...fieldA11y("kosten-date", errors.performedAt)}
              name="performedAt"
              type="date"
              defaultValue={values?.performedAt ?? today}
              className={costControl}
            />
          </Field>
          <div className="col-span-2">
            <PerformerField
              id="kosten-performer"
              staff={staff}
              currentUserId={currentUserId}
              defaultValue={values?.performedById ?? currentUserId}
              error={errors.performedById}
            />
          </div>
          {canSetPrice ? (
            <>
              <PriceField id="kosten-price" value={unitPrice} onChange={changePrice} error={errors.unitPrice} hint={priceHint} />
              <TotalOutput quantity={quantity} unitPrice={unitPrice} />
            </>
          ) : null}
        </div>
      ) : null}

      {showDetails && showLaborHint ? (
        <p id="kosten-quantity-hint" className="-mt-1 text-xs text-ink-muted">
          Arbeitszeit: {laborHint}
        </p>
      ) : null}

      {mode === "neu" && !existing ? (
        <Checkbox
          name="addToCatalog"
          defaultChecked={values ? values.addToCatalog === "on" : true}
          label="In den Katalog aufnehmen"
          hint={
            canSetPrice
              ? "Beim nächsten Mal steht die Position zur Auswahl. Der Preis wird zum Katalogpreis."
              : "Beim nächsten Mal steht die Position zur Auswahl."
          }
          className="text-sm"
        />
      ) : null}
    </>
  );
}

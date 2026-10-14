"use client";

import { formatMoney, lineTotalCents, parseMoney, parseQuantity } from "@/lib/format";
import { Field, Input, Select } from "@/components/ui/field";
import { fieldA11y } from "@/components/admin/tickets/use-staff-form";
import type { StaffChoice } from "@/components/admin/tickets/cost-values";

/** Gemeinsame Felder der Formulare „Leistungen und Material“. */

export const costControl = "h-10 text-sm";

/** „Erbracht von“: aktive Mitarbeiter, die angemeldete Person ist markiert. */
export function PerformerField({
  id,
  staff,
  currentUserId,
  defaultValue,
  error,
}: {
  id: string;
  staff: StaffChoice[];
  currentUserId: string;
  defaultValue: string;
  error?: string;
}) {
  return (
    <Field label="Erbracht von" htmlFor={id} error={error}>
      <Select {...fieldA11y(id, error)} name="performedById" defaultValue={defaultValue || currentUserId} className={costControl}>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id === currentUserId ? `${s.name} (ich)` : s.active ? s.name : `${s.name} (deaktiviert)`}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Live berechneter Gesamtbetrag (nur Administratoren). Der Server rechnet beim Speichern neu. */
export function TotalOutput({ quantity, unitPrice }: { quantity: string; unitPrice: string }) {
  const q = parseQuantity(quantity);
  const p = parseMoney(unitPrice);
  const total = q !== null && p !== null ? lineTotalCents(q, p) : null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-ink" aria-hidden>
        Gesamt
      </p>
      <output
        aria-label="Gesamtbetrag"
        aria-live="polite"
        className="flex h-10 items-center rounded-xl bg-mist px-3.5 text-sm font-bold text-ink tabular-nums ring-1 ring-line ring-inset"
      >
        {total === null ? "–" : formatMoney(total)}
      </output>
    </div>
  );
}

/** Einzelpreis in Euro (nur Administratoren); leer = Preis steht noch nicht fest. */
export function PriceField({
  id,
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label="Einzelpreis (€)" htmlFor={id} error={error} hint={hint}>
      <Input
        {...fieldA11y(id, error, Boolean(hint))}
        name="unitPrice"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className={`${costControl} tabular-nums`}
      />
    </Field>
  );
}

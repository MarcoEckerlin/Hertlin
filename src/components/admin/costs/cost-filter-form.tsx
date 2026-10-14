"use client";

import Form from "next/form";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type PeriodOption = { value: string; label: string };

const BILLING_OPTIONS = [
  { value: "offen", label: "Noch nicht abgerechnet" },
  { value: "abgerechnet", label: "Abgerechnet" },
  { value: "alle", label: "Alle Positionen" },
] as const;

/**
 * Filter für Zeitraum und Abrechnungsstand (GET-Formular, Werte landen in der Adresse).
 * Auswahl ändern lädt sofort neu; beim eigenen Zeitraum erst nach „Anzeigen“.
 */
export function CostFilterForm({
  action,
  period,
  from,
  to,
  billing,
  years,
  months,
  extraOption,
  hidden = {},
}: {
  action: string;
  /** "alle" | "2026" | "2026-10" | "frei" */
  period: string;
  from: string;
  to: string;
  billing: string;
  years: PeriodOption[];
  months: PeriodOption[];
  /** Zeitraum aus der Adresse, der nicht in den Listen steht (z. B. ein älterer Monat) */
  extraOption?: PeriodOption | null;
  hidden?: Record<string, string>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState(period);
  const custom = mode === "frei";

  const submit = () => formRef.current?.requestSubmit();

  return (
    <Form
      ref={formRef}
      action={action}
      className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:flex sm:flex-row sm:flex-wrap sm:items-end sm:gap-4 sm:p-5"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="min-w-0 sm:w-60">
        <Label htmlFor="kosten-zeitraum" className="mb-1 text-xs sm:mb-1.5 sm:text-sm">
          Zeitraum
        </Label>
        <Select
          id="kosten-zeitraum"
          name="zeitraum"
          defaultValue={period}
          className="h-10"
          onChange={(e) => {
            const next = e.currentTarget.value;
            setMode(next);
            if (next !== "frei") submit();
          }}
        >
          <option value="alle">Gesamter Zeitraum</option>
          {extraOption ? <option value={extraOption.value}>{extraOption.label}</option> : null}
          <optgroup label="Jahr">
            {years.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Monat">
            {months.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
          <option value="frei">Eigener Zeitraum …</option>
        </Select>
      </div>

      {custom ? (
        <div className="col-span-2 flex flex-wrap items-end gap-3 max-sm:order-3">
          <div>
            <Label htmlFor="kosten-von" className="mb-1.5">
              Von
            </Label>
            <Input id="kosten-von" name="von" type="date" defaultValue={from} className="h-10 w-44" />
          </div>
          <div>
            <Label htmlFor="kosten-bis" className="mb-1.5">
              Bis einschließlich
            </Label>
            <Input id="kosten-bis" name="bis" type="date" defaultValue={to} className="h-10 w-44" />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 sm:w-60">
        <Label htmlFor="kosten-abrechnung" className="mb-1 text-xs sm:mb-1.5 sm:text-sm">
          Abrechnung
        </Label>
        <Select
          id="kosten-abrechnung"
          name="abrechnung"
          defaultValue={billing}
          className="h-10"
          onChange={() => {
            if (!custom) submit();
          }}
        >
          {BILLING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Auswahllisten laden sofort neu; auf dem Handy braucht es den Knopf nur beim eigenen Zeitraum */}
      <Button
        type="submit"
        variant={custom ? "primary" : "secondary"}
        className={cn("h-10 max-sm:order-4", custom ? "col-span-2" : "max-sm:sr-only")}
      >
        Anzeigen
      </Button>
    </Form>
  );
}

"use client";

import Form from "next/form";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

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
      className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-end sm:p-5"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="sm:w-60">
        <Label htmlFor="kosten-zeitraum" className="mb-1.5">
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
        <div className="flex flex-wrap items-end gap-3">
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

      <div className="sm:w-60">
        <Label htmlFor="kosten-abrechnung" className="mb-1.5">
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

      <Button type="submit" variant={custom ? "primary" : "secondary"} className="h-10">
        Anzeigen
      </Button>
    </Form>
  );
}

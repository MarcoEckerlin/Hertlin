"use client";

import Form from "next/form";
import { useRef } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

/** Filter der Rechnungsliste (GET-Formular, Werte landen in der Adresse). Auswahl ändern lädt sofort neu. */
export function InvoiceFilterForm({
  status,
  year,
  query,
  companyId,
  statuses,
  years,
}: {
  status: string;
  year: string;
  query: string;
  companyId: string | null;
  statuses: readonly { value: string; label: string }[];
  years: number[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  return (
    <Form
      ref={formRef}
      action="/admin/rechnungen"
      role="search"
      className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-end sm:p-5"
    >
      {companyId ? <input type="hidden" name="kunde" value={companyId} /> : null}
      <div className="sm:w-52">
        <Label htmlFor="rechnungen-status" className="mb-1.5">
          Stand
        </Label>
        <Select id="rechnungen-status" name="status" defaultValue={status} className="h-10" onChange={submit}>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="sm:w-36">
        <Label htmlFor="rechnungen-jahr" className="mb-1.5">
          Jahr
        </Label>
        <Select id="rechnungen-jahr" name="jahr" defaultValue={year} className="h-10" onChange={submit}>
          <option value="">Alle Jahre</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-0 flex-1 sm:min-w-56">
        <Label htmlFor="rechnungen-suche" className="mb-1.5">
          Suche
        </Label>
        <Input
          id="rechnungen-suche"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Nummer, Empfänger oder E-Mail"
          className="h-10"
        />
      </div>
      <Button type="submit" variant="secondary" className="h-10">
        <Search className="size-4" aria-hidden />
        Suchen
      </Button>
    </Form>
  );
}

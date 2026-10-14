import { Field, Select } from "@/components/ui/field";

/**
 * Auswahl des zuständigen Hertlin-Standorts (Firmenkunde, Mitarbeiter, Ticket).
 * Optionen kommen vom Server (locationOptions() aus @/lib/locations); funktioniert in Server- und Client-Formularen.
 * Ohne Standorte wird nichts angezeigt.
 */
export function LocationSelect({
  name = "locationId",
  label = "Zuständiger Standort",
  options,
  defaultValue,
  error,
  hint,
  emptyLabel = "Kein bestimmter Standort",
}: {
  name?: string;
  label?: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  error?: string;
  hint?: string;
  emptyLabel?: string;
}) {
  if (options.length === 0) return null;
  const id = `field-${name}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} optional>
      <Select id={id} name={name} defaultValue={defaultValue ?? ""} aria-invalid={error ? true : undefined}>
        <option value="">{emptyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

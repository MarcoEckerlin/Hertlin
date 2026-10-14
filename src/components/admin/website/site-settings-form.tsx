"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FieldError, Input, Label, Select } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { initialFormState, type FormState } from "@/lib/forms";
import { PRIORITY_LABELS, TICKET_PRIORITIES } from "@/lib/constants";
import { saveSiteSettingsAction } from "@/lib/actions/admin-website";
import { IconButton } from "@/components/admin/website/dialog";

/** Entspricht SiteSettings aus src/lib/settings.ts (dort server-only). */
export type SiteSettingsValues = {
  name: string;
  legalName: string;
  tagline: string;
  owner: string;
  street: string;
  zip: string;
  city: string;
  region: string;
  phone: string;
  phoneHref: string;
  email: string;
  supportEmail: string;
  vatId: string;
  register: string;
  openingHours: { days: string; hours: string }[];
  responseTimes: { priority: string; label: string; time: string }[];
  remoteSupportUrl: string;
  hostingProvider: string;
  logRetentionDays: number;
};

type TextKey = Exclude<keyof SiteSettingsValues, "openingHours" | "responseTimes" | "logRetentionDays">;

/** Telefonnummer in die Schreibweise für Anruf-Links umwandeln: „0711 123456“ → „+49711123456“. */
export function phoneToHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return `+${cleaned.slice(1).replace(/\+/g, "")}`;
  if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
  if (cleaned.startsWith("0")) return `+49${cleaned.slice(1)}`;
  return cleaned;
}

function isTodo(value: string): boolean {
  return value.trim().startsWith("TODO");
}

function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function SiteSettingsForm({ initial }: { initial: SiteSettingsValues }) {
  const [values, setValues] = useState<SiteSettingsValues>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [state, setState] = useState<FormState>(initialFormState);
  const [pending, startTransition] = useTransition();
  const messageRef = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify(values) !== saved;
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const set = (key: TextKey, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const text = (
    key: TextKey,
    label: string,
    opts: { hint?: ReactNode; max: number; type?: string; optional?: boolean; placeholder?: string; inputMode?: "tel" | "email" | "url" } = {
      max: 160,
    },
  ) => {
    const id = `settings-${key}`;
    const todo = isTodo(values[key]);
    const hint = todo ? (
      <span className="font-medium text-warning-ink">Noch ein Platzhalter – bitte vor dem Livegang durch die echte Angabe ersetzen.</span>
    ) : (
      opts.hint
    );
    return (
      <Field label={label} htmlFor={id} hint={hint} error={errors[key]} optional={opts.optional}>
        <Input
          id={id}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          value={values[key]}
          maxLength={opts.max}
          placeholder={opts.placeholder}
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={errors[key] ? `${id}-error` : hint ? `${id}-hint` : undefined}
          onChange={(e) => set(key, e.target.value)}
        />
      </Field>
    );
  };

  const submit = () => {
    startTransition(async () => {
      let result: FormState;
      try {
        result = await saveSiteSettingsAction(values);
      } catch (error) {
        unstable_rethrow(error);
        result = { status: "error", message: "Keine Verbindung zum Server. Bitte versuchen Sie es noch einmal." };
      }
      setState(result);
      if (result.status === "success") setSaved(JSON.stringify(values));
      requestAnimationFrame(() => {
        if (result.status === "error") {
          const firstKey = Object.keys(result.fieldErrors ?? {})[0];
          const el = firstKey ? document.getElementById(`settings-${firstKey.replace(/\./g, "-")}`) : null;
          if (el) {
            el.focus();
            return;
          }
        }
        messageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  };

  /* ---------------- Öffnungszeiten ---------------- */

  const setHour = (index: number, field: "days" | "hours", value: string) =>
    setValues((v) => ({ ...v, openingHours: v.openingHours.map((row, i) => (i === index ? { ...row, [field]: value } : row)) }));

  /* ---------------- Reaktionszeiten ---------------- */

  const setResponse = (index: number, field: "priority" | "label" | "time", value: string) =>
    setValues((v) => ({ ...v, responseTimes: v.responseTimes.map((row, i) => (i === index ? { ...row, [field]: value } : row)) }));

  const suggestedHref = phoneToHref(values.phone);

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardHeader title="Firma" description="Name und Firmierung erscheinen im Impressum, in der Fußzeile und in E-Mails." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("name", "Kurzname", { max: 80, hint: "Wie Sie im Alltag genannt werden, z. B. „Hertlin“. Platzhalter {firma}." })}
          {text("legalName", "Firmierung", { max: 160, hint: "Vollständiger Name laut Gewerbeanmeldung oder Handelsregister." })}
          {text("owner", "Inhaber bzw. Geschäftsführer", { max: 160, hint: "Pflichtangabe im Impressum." })}
          {text("tagline", "Kurzbeschreibung", { max: 160, optional: true, hint: "Ein Satz, z. B. für Suchmaschinen und E-Mails." })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Anschrift" description="Ladungsfähige Anschrift für das Impressum. Platzhalter {adresse}." />
        <CardBody className="grid gap-5 sm:grid-cols-6">
          <div className="sm:col-span-6">{text("street", "Straße und Hausnummer", { max: 160 })}</div>
          <div className="sm:col-span-2">{text("zip", "PLZ", { max: 20, inputMode: undefined })}</div>
          <div className="sm:col-span-4">{text("city", "Ort", { max: 80 })}</div>
          <div className="sm:col-span-6">
            {text("region", "Einsatzgebiet", {
              max: 120,
              hint: "Wo Sie vor Ort arbeiten, z. B. „Raum Stuttgart“. Platzhalter {region}.",
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Kontakt" description="Erscheint auf der Kontaktseite, in der Fußzeile, im Impressum und in E-Mails." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("phone", "Telefonnummer", {
            max: 40,
            type: "tel",
            inputMode: "tel",
            hint: "So, wie sie auf der Website stehen soll, z. B. „0711 123456“. Platzhalter {telefon}.",
          })}
          <div>
            {text("phoneHref", "Telefonnummer für Anruf-Links", {
              max: 40,
              inputMode: "tel",
              placeholder: "+49711123456",
              hint: "Internationale Schreibweise ohne Leerzeichen. Wird beim Antippen auf dem Handy gewählt.",
            })}
            {suggestedHref && suggestedHref !== values.phoneHref ? (
              <button
                type="button"
                className="mt-1.5 text-sm font-semibold text-brand-700 underline underline-offset-2"
                onClick={() => set("phoneHref", suggestedHref)}
              >
                Aus der Telefonnummer übernehmen: {suggestedHref}
              </button>
            ) : null}
          </div>
          {text("email", "E-Mail-Adresse", { max: 160, type: "email", inputMode: "email", hint: "Allgemeine Adresse. Platzhalter {email}." })}
          {text("supportEmail", "E-Mail-Adresse für den Support", {
            max: 160,
            type: "email",
            inputMode: "email",
            hint: "Antwortadresse für Ticket-E-Mails. Platzhalter {support_email}.",
          })}
          <div className="sm:col-span-2">
            {text("remoteSupportUrl", "Link zur Fernwartung", {
              max: 300,
              type: "url",
              inputMode: "url",
              optional: true,
              placeholder: "https://",
              hint: "Download-Link Ihres Fernwartungsprogramms (z. B. TeamViewer QuickSupport). Als Link-Ziel {fernwartung} verwendbar.",
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Rechtliche Angaben" description="Für das Impressum." />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          {text("vatId", "Umsatzsteuer-Identifikationsnummer", { max: 40, optional: true, placeholder: "DE123456789" })}
          {text("register", "Registereintrag", {
            max: 200,
            optional: true,
            placeholder: "Amtsgericht Musterstadt, HRB 12345",
            hint: "Leer lassen, wenn die Firma nicht im Handelsregister eingetragen ist.",
          })}
          <div className="sm:col-span-2">
            {text("hostingProvider", "Hosting-Anbieter", {
              max: 300,
              placeholder: "Name und Anschrift des Anbieters, bei dem der Server steht",
              hint: "Erscheint in der Datenschutzerklärung.",
            })}
          </div>
          <Field
            label="Server-Logs löschen nach (Tagen)"
            htmlFor="settings-logRetentionDays"
            hint="Erscheint in der Datenschutzerklärung. Muss zu den Einstellungen Ihres Servers passen."
            error={errors.logRetentionDays}
          >
            <Input
              id="settings-logRetentionDays"
              type="number"
              min={1}
              max={365}
              value={values.logRetentionDays}
              aria-invalid={errors.logRetentionDays ? true : undefined}
              onChange={(e) => setValues((v) => ({ ...v, logRetentionDays: Number(e.target.value) }))}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Öffnungszeiten" description="Erscheinen auf der Kontaktseite und im Kontakt-Modul." />
        <CardBody className="space-y-3">
          <FieldError>{errors.openingHours}</FieldError>
          {values.openingHours.length === 0 ? <p className="text-sm text-ink-muted">Noch keine Öffnungszeiten eingetragen.</p> : null}
          <ol className="space-y-3">
            {values.openingHours.map((row, i) => (
              <li key={i} className="rounded-xl border border-line p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                  <div>
                    <Label htmlFor={`settings-openingHours-${i}-days`} className="mb-1.5">
                      Tage
                    </Label>
                    <Input
                      id={`settings-openingHours-${i}-days`}
                      value={row.days}
                      maxLength={80}
                      placeholder="Montag bis Donnerstag"
                      aria-invalid={errors[`openingHours.${i}.days`] ? true : undefined}
                      onChange={(e) => setHour(i, "days", e.target.value)}
                    />
                    <FieldError>{errors[`openingHours.${i}.days`]}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor={`settings-openingHours-${i}-hours`} className="mb-1.5">
                      Uhrzeiten
                    </Label>
                    <Input
                      id={`settings-openingHours-${i}-hours`}
                      value={row.hours}
                      maxLength={80}
                      placeholder="8:00 – 17:00 Uhr"
                      aria-invalid={errors[`openingHours.${i}.hours`] ? true : undefined}
                      onChange={(e) => setHour(i, "hours", e.target.value)}
                    />
                    <FieldError>{errors[`openingHours.${i}.hours`]}</FieldError>
                  </div>
                  <RowActions
                    label={`Zeile ${i + 1}`}
                    index={i}
                    count={values.openingHours.length}
                    onMove={(to) => setValues((v) => ({ ...v, openingHours: move(v.openingHours, i, to) }))}
                    onRemove={() => setValues((v) => ({ ...v, openingHours: v.openingHours.filter((_, j) => j !== i) }))}
                  />
                </div>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            disabled={values.openingHours.length >= 10}
            onClick={() => setValues((v) => ({ ...v, openingHours: [...v.openingHours, { days: "", hours: "" }] }))}
          >
            <Plus className="size-4" aria-hidden />
            Zeile hinzufügen
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Reaktionszeiten"
          description="Für Firmenkunden mit Betreuungsvertrag. Erscheinen auf der Website im Modul „Reaktionszeiten“."
        />
        <CardBody className="space-y-3">
          <FieldError>{errors.responseTimes}</FieldError>
          {values.responseTimes.length === 0 ? <p className="text-sm text-ink-muted">Noch keine Reaktionszeiten eingetragen.</p> : null}
          <ol className="space-y-3">
            {values.responseTimes.map((row, i) => (
              <li key={i} className="rounded-xl border border-line p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr_1fr_auto] sm:items-start">
                  <div>
                    <Label htmlFor={`settings-responseTimes-${i}-priority`} className="mb-1.5">
                      Priorität
                    </Label>
                    <Select
                      id={`settings-responseTimes-${i}-priority`}
                      value={row.priority}
                      aria-invalid={errors[`responseTimes.${i}.priority`] ? true : undefined}
                      onChange={(e) => setResponse(i, "priority", e.target.value)}
                    >
                      {!TICKET_PRIORITIES.includes(row.priority as (typeof TICKET_PRIORITIES)[number]) ? (
                        <option value={row.priority}>Bitte wählen</option>
                      ) : null}
                      {[...TICKET_PRIORITIES].reverse().map((p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      ))}
                    </Select>
                    <FieldError>{errors[`responseTimes.${i}.priority`]}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor={`settings-responseTimes-${i}-label`} className="mb-1.5">
                      Beschreibung
                    </Label>
                    <Input
                      id={`settings-responseTimes-${i}-label`}
                      value={row.label}
                      maxLength={120}
                      placeholder="Kritisch – der Betrieb steht"
                      aria-invalid={errors[`responseTimes.${i}.label`] ? true : undefined}
                      onChange={(e) => setResponse(i, "label", e.target.value)}
                    />
                    <FieldError>{errors[`responseTimes.${i}.label`]}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor={`settings-responseTimes-${i}-time`} className="mb-1.5">
                      Reaktionszeit
                    </Label>
                    <Input
                      id={`settings-responseTimes-${i}-time`}
                      value={row.time}
                      maxLength={80}
                      placeholder="innerhalb von 1 Stunde"
                      aria-invalid={errors[`responseTimes.${i}.time`] ? true : undefined}
                      onChange={(e) => setResponse(i, "time", e.target.value)}
                    />
                    <FieldError>{errors[`responseTimes.${i}.time`]}</FieldError>
                  </div>
                  <RowActions
                    label={`Zeile ${i + 1}`}
                    index={i}
                    count={values.responseTimes.length}
                    onMove={(to) => setValues((v) => ({ ...v, responseTimes: move(v.responseTimes, i, to) }))}
                    onRemove={() => setValues((v) => ({ ...v, responseTimes: v.responseTimes.filter((_, j) => j !== i) }))}
                  />
                </div>
              </li>
            ))}
          </ol>
          <Button
            variant="secondary"
            size="sm"
            disabled={values.responseTimes.length >= 8}
            onClick={() =>
              setValues((v) => ({ ...v, responseTimes: [...v.responseTimes, { priority: "NORMAL", label: "", time: "" }] }))
            }
          >
            <Plus className="size-4" aria-hidden />
            Zeile hinzufügen
          </Button>
        </CardBody>
      </Card>

      <div
        ref={messageRef}
        className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface-raised/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:shadow-lift"
      >
        <FormMessage state={state} className="mb-3" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Wird gespeichert …" : "Firmendaten speichern"}
          </Button>
          {dirty ? (
            <>
              <span className="text-sm font-semibold text-caution-ink" role="status">
                Ungespeicherte Änderungen
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setValues(JSON.parse(saved) as SiteSettingsValues);
                  setState(initialFormState);
                }}
              >
                Zurücksetzen
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function RowActions({
  label,
  index,
  count,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5 sm:pt-7">
      <IconButton label={`${label} nach oben`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp className="size-4" aria-hidden />
      </IconButton>
      <IconButton label={`${label} nach unten`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDown className="size-4" aria-hidden />
      </IconButton>
      <IconButton label={`${label} entfernen`} tone="danger" onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden />
      </IconButton>
    </div>
  );
}

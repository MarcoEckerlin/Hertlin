"use client";

import { startTransition, useActionState, useEffect, useOptimistic, useState } from "react";
import { ChevronDown, UserCheck } from "lucide-react";
import { takeTicketAction, updateTicketMetaAction } from "@/lib/actions/admin-tickets";
import { initialFormState } from "@/lib/forms";
import { cn } from "@/lib/cn";
import { STATUS_LABELS_STAFF, TICKET_STATUSES, type TicketStatus } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { showToast } from "@/components/ui/toaster";

type Quick = { status: string; assigneeId: string };

/** Statuswerte, nach denen der Kunde auf Wunsch eine kurze E-Mail bekommt */
function isDone(status: string): boolean {
  return status === "RESOLVED" || status === "CLOSED";
}

/**
 * Schnellleiste unter dem Tickettitel: Status und Bearbeiter ändern (wird sofort gespeichert),
 * „Übernehmen“ und der Sprung zu den Leistungen. Die Auswahl zeigt die Änderung sofort an;
 * schlägt das Speichern fehl, springt sie zurück und eine Meldung erscheint.
 * Wird ein Ticket gelöst oder geschlossen und gibt es eine Kundenadresse, fragt die Leiste vorher,
 * ob der Kunde per E-Mail informiert werden soll.
 */
export function TicketQuickBar({
  ticketId,
  current,
  staff,
  currentUserId,
  recipientEmail,
  costLink,
}: {
  ticketId: number;
  current: Quick;
  staff: { id: string; name: string; active: boolean }[];
  currentUserId: string;
  /** Adresse für Status-Mails an den Kunden oder null */
  recipientEmail: string | null;
  /** Sprung zu „Leistungen und Material“, z. B. „Kosten 172,40 €“; null = ausblenden */
  costLink: { label: string; warning?: string } | null;
}) {
  const [state, formAction, pending] = useActionState(updateTicketMetaAction, initialFormState);
  const [shown, setShown] = useOptimistic(current, (base: Quick, patch: Partial<Quick>) => ({ ...base, ...patch }));
  /** Gewählter Status „Gelöst“/„Geschlossen“, der noch auf die Bestätigung wartet */
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);

  // Rückmeldung als kurze Meldung; Fehler bleiben länger stehen
  useEffect(() => {
    if (state.status === "success" && state.message) showToast(state.message);
    if (state.status === "error") {
      const fieldError = Object.values(state.fieldErrors ?? {})[0];
      showToast(fieldError ?? state.message ?? "Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.", "error");
    }
  }, [state]);

  function save(patch: Partial<Quick>, notifyCustomer = false) {
    const data = new FormData();
    data.set("ticketId", String(ticketId));
    if (patch.status !== undefined) data.set("status", patch.status);
    if (patch.assigneeId !== undefined) data.set("assigneeId", patch.assigneeId);
    if (notifyCustomer) data.set("notify", "on");
    startTransition(() => {
      setShown(patch);
      formAction(data);
    });
  }

  function changeStatus(next: string) {
    if (next === shown.status) {
      setConfirmStatus(null);
      return;
    }
    if (isDone(next) && recipientEmail) {
      setNotify(true);
      setConfirmStatus(next);
      return;
    }
    setConfirmStatus(null);
    save({ status: next });
  }

  const statusLabel = (s: string) => STATUS_LABELS_STAFF[s as TicketStatus] ?? s;
  const mine = shown.assigneeId === currentUserId;
  // Aktuell eingetragener (evtl. deaktivierter) Bearbeiter bleibt auswählbar
  const staffChoices = staff.filter((s) => s.active || s.id === shown.assigneeId);

  return (
    <div className="mb-6 space-y-2">
      <div
        role="group"
        aria-label="Status und Bearbeiter"
        className="flex flex-wrap items-end gap-x-3 gap-y-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:px-4"
        aria-busy={pending || undefined}
      >
        <div className="min-w-0 flex-1 basis-[calc(50%-0.75rem)] sm:max-w-52 sm:flex-none sm:basis-52">
          <Label htmlFor="quick-status" className="mb-1 text-xs text-ink-muted">
            Status
          </Label>
          <Select
            id="quick-status"
            value={confirmStatus ?? shown.status}
            onChange={(e) => changeStatus(e.target.value)}
            className="h-10 text-sm font-semibold"
          >
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-0 flex-1 basis-[calc(50%-0.75rem)] sm:max-w-60 sm:flex-none sm:basis-60">
          <Label htmlFor="quick-assignee" className="mb-1 text-xs text-ink-muted">
            Bearbeiter
          </Label>
          <Select
            id="quick-assignee"
            value={shown.assigneeId}
            onChange={(e) => save({ assigneeId: e.target.value })}
            className="h-10 text-sm"
          >
            <option value="">Noch niemand</option>
            {staffChoices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === currentUserId ? `${s.name} (ich)` : s.active ? s.name : `${s.name} (deaktiviert)`}
              </option>
            ))}
          </Select>
        </div>

        {!mine ? (
          <form
            action={async () => {
              setShown({ assigneeId: currentUserId, ...(shown.status === "NEW" ? { status: "IN_PROGRESS" } : {}) });
              await takeTicketAction(ticketId);
              showToast("Sie bearbeiten das Ticket jetzt.");
            }}
          >
            <SubmitButton variant="secondary" pendingText="Einen Moment …" className="h-10">
              <UserCheck className="size-4" aria-hidden />
              {shown.assigneeId ? "Selbst übernehmen" : "Übernehmen"}
            </SubmitButton>
          </form>
        ) : null}

        <span
          aria-hidden
          className={cn(
            "mb-3 size-4 shrink-0 animate-spin rounded-full border-2 border-brand-500 border-r-transparent transition-opacity motion-reduce:animate-none",
            pending ? "opacity-100" : "opacity-0",
          )}
        />
        {pending ? <span className="sr-only">Wird gespeichert …</span> : null}

        {costLink ? (
          <a
            href="#kosten"
            className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft transition-colors hover:bg-brand-50 hover:text-ink"
          >
            {costLink.label}
            {costLink.warning ? <span className="text-warning-ink">· {costLink.warning}</span> : null}
            <ChevronDown className="size-4 text-ink-muted" aria-hidden />
          </a>
        ) : null}
      </div>

      {confirmStatus ? (
        <div
          role="group"
          aria-label={`Status „${statusLabel(confirmStatus)}“ speichern`}
          className="flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-3 transition-[opacity,translate] duration-200 starting:-translate-y-1 starting:opacity-0 sm:flex-row sm:items-center sm:justify-between sm:px-4"
        >
          <Checkbox
            checked={notify}
            onChange={(e) => setNotify(e.currentTarget.checked)}
            label="Kunden per E-Mail informieren"
            hint={`Kurze Nachricht an ${recipientEmail}, dass das Ticket „${statusLabel(confirmStatus)}“ ist.`}
            className="text-sm"
          />
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmStatus(null)}>
              Abbrechen
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const next = confirmStatus;
                setConfirmStatus(null);
                save({ status: next }, notify);
              }}
            >
              Status speichern
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

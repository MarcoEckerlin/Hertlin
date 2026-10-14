import { Lock, Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS_STAFF,
  TYPE_LABELS,
  labelOf,
} from "@/lib/constants";
import { formatDateTime, formatFileSize, formatRelative, initials } from "@/lib/format";
import { TranslatedBody } from "@/components/translate/translated-body";
import type { StaffTicketEvent, StaffTicketMessage } from "@/components/admin/tickets/data";
import { TimelineFollower } from "@/components/admin/tickets/timeline-follower";

type Item =
  | { kind: "message"; at: Date; message: StaffTicketMessage; first: boolean }
  | { kind: "event"; at: Date; event: StaffTicketEvent };

/** Übersetzungen von Kundennachrichten: Nachrichten-ID -> übersetzter Text und erkannte Ausgangssprache */
export type TimelineTranslations = Record<string, { text: string; from: string | null }>;

/** Gemeinsame Klassen der Verlaufseinträge (Abstand beim Hinscrollen wegen der festen Kopfzeile) */
const ITEM_CLASS = "scroll-mt-24 scroll-mb-6";

const BODY_CLASS = "text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-ink-soft";

/** Liegt eine Nachricht so kurz vor dem letzten Eintrag, gehört dieser dazu (z. B. Statuswechsel nach einer Antwort). */
const SAME_UPDATE_MS = 10_000;

function isStaffRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "TECHNICIAN";
}

/**
 * Verlauf eines Tickets für die Verwaltung: alle Nachrichten inklusive interner Notizen
 * und das Ereignisprotokoll (Status, Priorität, Bearbeiter …) in zeitlicher Reihenfolge.
 * Kunde weiß (links), Antworten von Hertlin hellblau, interne Notizen gelb abgesetzt (rechts).
 * Kundennachrichten erscheinen auf Wunsch übersetzt (translations); das Original bleibt abrufbar.
 * Kommen live neue Einträge dazu, scrollt der Verlauf weich mit (TimelineFollower).
 */
export function StaffTimeline({
  messages,
  events,
  customerName,
  currentUserId,
  translations = {},
}: {
  messages: StaffTicketMessage[];
  events: StaffTicketEvent[];
  /** Name für Kundennachrichten ohne Benutzerkonto */
  customerName: string | null;
  currentUserId: string;
  /** Nur für Kundennachrichten – interne Notizen und Antworten von Hertlin werden nie übersetzt */
  translations?: TimelineTranslations;
}) {
  // „Ticket angelegt“ steht immer ganz oben, auch wenn die erste Nachricht ein paar Millisekunden früher gespeichert wurde
  const firstAt = messages[0]?.createdAt;
  const items: Item[] = [
    ...messages.map((message, index) => ({ kind: "message" as const, at: message.createdAt, message, first: index === 0 })),
    ...events.map((event) => ({
      kind: "event" as const,
      at: event.type === "CREATED" && firstAt && firstAt < event.createdAt ? firstAt : event.createdAt,
      event,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === b.kind ? 0 : a.kind === "event" ? -1 : 1));

  const last = items[items.length - 1];
  const lastKey = last ? (last.kind === "message" ? last.message.id : last.event.id) : "leer";
  const lastFromSelf = last
    ? last.kind === "message"
      ? last.message.authorId === currentUserId
      : last.event.actorId === currentUserId
    : false;
  const lastMessage = messages[messages.length - 1];
  const endsWithMessage =
    last?.kind === "message" ||
    (last !== undefined && lastMessage !== undefined && last.at.getTime() - lastMessage.createdAt.getTime() < SAME_UPDATE_MS);

  return (
    <TimelineFollower
      lastKey={lastKey}
      lastFromSelf={lastFromSelf}
      jumpLabel={endsWithMessage ? "Neue Nachricht" : "Neuer Eintrag im Verlauf"}
    >
      <ol className="space-y-4">
        {items.map((item) =>
          item.kind === "message" ? (
            <MessageItem
              key={item.message.id}
              message={item.message}
              first={item.first}
              customerName={customerName}
              own={item.message.authorId === currentUserId}
              translation={
                !item.message.fromStaff && !item.message.internal ? (translations[item.message.id] ?? null) : null
              }
            />
          ) : (
            <EventItem key={item.event.id} event={item.event} />
          ),
        )}
      </ol>
    </TimelineFollower>
  );
}

function MessageItem({
  message,
  first,
  customerName,
  own,
  translation,
}: {
  message: StaffTicketMessage;
  first: boolean;
  customerName: string | null;
  own: boolean;
  translation: { text: string; from: string | null } | null;
}) {
  const variant = message.internal ? "note" : message.fromStaff ? "staff" : "customer";
  const name =
    message.author?.name ?? message.authorName ?? (message.fromStaff ? "Hertlin" : (customerName ?? "Kunde"));
  const subtitle =
    variant === "note"
      ? "Interne Notiz – für Kunden unsichtbar"
      : variant === "staff"
        ? first
          ? "Beschreibung, für den Kunden sichtbar"
          : "Antwort an den Kunden"
        : first
          ? "Meldung des Kunden"
          : "Nachricht des Kunden";

  return (
    <li data-timeline-item className={cn(ITEM_CLASS, "flex", variant === "customer" ? "justify-start" : "justify-end")}>
      <article
        className={cn(
          "w-full max-w-3xl rounded-2xl border p-4 sm:p-5",
          variant === "note" && "border-amber-300 bg-amber-50 sm:ml-10",
          variant === "staff" && "border-brand-200 bg-brand-50 sm:ml-10",
          variant === "customer" && "border-line bg-white shadow-card sm:mr-10",
        )}
        aria-label={`${subtitle}: ${name}`}
      >
        {variant === "note" ? (
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-amber-300 ring-inset">
            <Lock className="size-3" aria-hidden />
            Interne Notiz – für Kunden unsichtbar
          </p>
        ) : null}
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                variant === "note" && "bg-amber-200 text-amber-900",
                variant === "staff" && "bg-brand-400 text-ink",
                variant === "customer" && "bg-brand-100 text-brand-800",
              )}
              aria-hidden
            >
              {initials(name) || "?"}
            </span>
            <p className="min-w-0 text-sm leading-tight">
              <span className="block font-semibold break-words text-ink">
                {name}
                {own ? <span className="font-normal text-ink-muted"> (Sie)</span> : null}
              </span>
              {variant === "note" ? null : <span className="block text-xs text-ink-muted">{subtitle}</span>}
            </p>
          </div>
          <time dateTime={message.createdAt.toISOString()} className="text-xs text-ink-muted" title={formatRelative(message.createdAt)}>
            {formatDateTime(message.createdAt)}
          </time>
        </header>

        {translation ? (
          <div className="mt-3" dir="auto">
            <TranslatedBody original={message.body} translation={translation} className={BODY_CLASS} />
          </div>
        ) : (
          <div className={cn("mt-3", BODY_CLASS)} dir="auto">
            {message.body}
          </div>
        )}

        {message.attachments.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Anhänge">
            {message.attachments.map((attachment) => (
              <li key={attachment.id} className="max-w-full">
                <a
                  href={`/admin/dateien/${attachment.id}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink ring-1 ring-line ring-inset hover:bg-brand-50 hover:ring-brand-300"
                >
                  <Paperclip className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
                  <span className="truncate">{attachment.fileName}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{formatFileSize(attachment.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </li>
  );
}

function change(label: string, from: string, to: string): string {
  return `${label}: ${from} → ${to}`;
}

/** Text einer Protokollzeile, z. B. „Status: Neu → In Bearbeitung“. */
export function describeEvent(event: Pick<StaffTicketEvent, "type" | "fromValue" | "toValue">): string {
  const { fromValue: from, toValue: to } = event;
  switch (event.type) {
    case "CREATED":
      return "Ticket angelegt";
    case "STATUS":
      return change("Status", labelOf(STATUS_LABELS_STAFF, from), labelOf(STATUS_LABELS_STAFF, to));
    case "PRIORITY":
      return change("Priorität", labelOf(PRIORITY_LABELS, from), labelOf(PRIORITY_LABELS, to));
    case "TYPE":
      return change("Art", labelOf(TYPE_LABELS, from), labelOf(TYPE_LABELS, to));
    case "CATEGORY":
      return change("Bereich", labelOf(CATEGORY_LABELS, from), labelOf(CATEGORY_LABELS, to));
    case "ASSIGNEE":
      if (!from && to) return `Bearbeiter: ${to}`;
      if (from && !to) return `Bearbeiter entfernt (vorher ${from})`;
      return change("Bearbeiter", from ?? "niemand", to ?? "niemand");
    case "COMPANY":
      return change("Zuordnung", from ?? "–", to ?? "–");
    case "LOCATION":
      return change("Standort", from ?? "keiner", to ?? "keiner");
    default:
      return to ? `${event.type}: ${to}` : event.type;
  }
}

function EventItem({ event }: { event: StaffTicketEvent }) {
  const actor = event.actor ? (isStaffRole(event.actor.role) ? event.actor.name : `${event.actor.name} (Kunde)`) : null;
  return (
    <li data-timeline-item className={cn(ITEM_CLASS, "flex items-center gap-3 py-0.5 text-xs text-ink-muted")}>
      <span className="h-px flex-1 bg-line" aria-hidden />
      <span className="max-w-[85%] text-center">
        <span className="font-semibold text-ink-soft">{describeEvent(event)}</span>
        {actor ? ` · ${actor}` : null} ·{" "}
        <time dateTime={event.createdAt.toISOString()} title={formatDateTime(event.createdAt)}>
          {formatRelative(event.createdAt)}
        </time>
      </span>
      <span className="h-px flex-1 bg-line" aria-hidden />
    </li>
  );
}

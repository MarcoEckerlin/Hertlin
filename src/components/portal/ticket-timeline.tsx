import { Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import { STATUS_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatFileSize, initials } from "@/lib/format";
import { TranslatedBody } from "@/components/translate/translated-body";
import type { MessageTranslations, PortalTicketEvent, PortalTicketMessage } from "@/components/portal/portal-data";

type Item =
  | { kind: "message"; at: Date; message: PortalTicketMessage; first: boolean }
  | { kind: "event"; at: Date; event: PortalTicketEvent };

function isStaffRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "TECHNICIAN";
}

function sortItems(messages: PortalTicketMessage[], events: PortalTicketEvent[]): Item[] {
  return [
    ...messages.map((message, index) => ({ kind: "message" as const, at: message.createdAt, message, first: index === 0 })),
    ...events.map((event) => ({ kind: "event" as const, at: event.createdAt, event })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || (a.kind === b.kind ? 0 : a.kind === "message" ? -1 : 1));
}

function messageAuthor(message: PortalTicketMessage, fallbackAuthor: string | null): string | null {
  return message.author?.name ?? message.authorName ?? (message.fromStaff ? null : fallbackAuthor);
}

/**
 * Letzter Eintrag im Verlauf – für die Live-Ansicht (weiches Mitscrollen, Ansage für Screenreader).
 * fromSelf: selbst ausgelöst (eigene Nachricht, eigener Statuswechsel) – dann wird weder gescrollt noch angesagt.
 */
export function timelineTail(
  messages: PortalTicketMessage[],
  events: PortalTicketEvent[],
  currentUserId: string,
  fallbackAuthor: string | null,
): { key: string; fromSelf: boolean; announcement: string } {
  const last = sortItems(messages, events).at(-1);
  if (!last) return { key: "leer", fromSelf: true, announcement: "" };
  if (last.kind === "event") {
    return {
      key: `e:${last.event.id}`,
      fromSelf: last.event.actorId === currentUserId,
      announcement: `Neuer Status: ${labelOf(STATUS_LABELS, last.event.toValue)}`,
    };
  }
  const m = last.message;
  const name = messageAuthor(m, fallbackAuthor);
  return {
    key: `m:${m.id}`,
    fromSelf: m.authorId === currentUserId,
    announcement: m.fromStaff
      ? `Neue Antwort von Hertlin${name ? ` (${name})` : ""}`
      : `Neue Nachricht von ${name ?? "Kundenseite"}`,
  };
}

/**
 * Verlauf eines Tickets für Kunden: Nachrichten (nie interne Notizen) und Statuswechsel.
 * Antworten von Hertlin sind hellblau abgesetzt, Nachrichten von Kundenseite weiß.
 */
export function TicketTimeline({
  messages,
  events,
  currentUserId,
  fallbackAuthor,
  translations = {},
}: {
  messages: PortalTicketMessage[];
  events: PortalTicketEvent[];
  currentUserId: string;
  /** Name für Kundennachrichten ohne Konto (z. B. von Hertlin am Telefon erfasst) */
  fallbackAuthor: string | null;
  /** Übersetzungen in die Sprache des Lesers (Nachrichten-ID -> Text) */
  translations?: MessageTranslations;
}) {
  const items = sortItems(messages, events);

  return (
    <ol className="space-y-4">
      {items.map((item) =>
        item.kind === "message" ? (
          <MessageItem
            key={item.message.id}
            message={item.message}
            first={item.first}
            own={item.message.authorId === currentUserId}
            fallbackAuthor={fallbackAuthor}
            translation={translations[item.message.id]}
          />
        ) : (
          <EventItem key={item.event.id} event={item.event} currentUserId={currentUserId} />
        ),
      )}
    </ol>
  );
}

function MessageItem({
  message,
  first,
  own,
  fallbackAuthor,
  translation,
}: {
  message: PortalTicketMessage;
  first: boolean;
  own: boolean;
  fallbackAuthor: string | null;
  translation?: { text: string; from: string | null };
}) {
  const fromStaff = message.fromStaff;
  const name = messageAuthor(message, fallbackAuthor);
  const bodyClass = "text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-ink-soft";

  return (
    <li className={cn("flex", fromStaff ? "justify-start" : "justify-end")}>
      <article
        className={cn(
          "w-full max-w-2xl rounded-2xl border p-4 sm:p-5",
          fromStaff ? "border-brand-200 bg-brand-50 sm:mr-12" : "border-line bg-white shadow-card sm:ml-12",
        )}
        aria-label={fromStaff ? `Antwort von Hertlin${name ? `, ${name}` : ""}` : own ? "Ihre Nachricht" : `Nachricht von ${name ?? "Kundenseite"}`}
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold",
                fromStaff ? "bg-brand-400 text-ink" : "bg-brand-100 text-brand-800",
              )}
              aria-hidden
            >
              {fromStaff ? "H" : initials(name ?? "?") || "?"}
            </span>
            <p className="min-w-0 text-sm leading-tight">
              <span className="block font-semibold break-words text-ink">
                {fromStaff ? `Hertlin${name ? ` · ${name}` : ""}` : (name ?? "Kundenseite")}
              </span>
              <span className="block text-xs text-ink-muted">
                {fromStaff ? "Antwort von Hertlin" : own ? (first ? "Ihre Meldung" : "Ihre Nachricht") : first ? "Meldung" : "Nachricht"}
              </span>
            </p>
          </div>
          <time dateTime={message.createdAt.toISOString()} className="text-xs text-ink-muted">
            {formatDateTime(message.createdAt)}
          </time>
        </header>

        {translation ? (
          // Schon übersetzt: Der Website-Übersetzer soll weder Übersetzung noch Original ein zweites Mal übersetzen
          <div className="mt-3" data-no-translate>
            <TranslatedBody original={message.body} translation={translation} className={bodyClass} />
          </div>
        ) : (
          <div className={cn("mt-3", bodyClass)}>{message.body}</div>
        )}

        {message.attachments.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Anhänge">
            {message.attachments.map((attachment) => (
              <li key={attachment.id} className="max-w-full">
                <a
                  href={`/dateien/${attachment.id}`}
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

function EventItem({ event, currentUserId }: { event: PortalTicketEvent; currentUserId: string }) {
  const actor = event.actor;
  let who: string | null = null;
  if (event.actorId && event.actorId === currentUserId) who = "Sie";
  else if (actor) who = isStaffRole(actor.role) ? `${actor.name} (Hertlin)` : actor.name;

  return (
    <li className="flex items-center gap-3 py-1 text-xs text-ink-muted">
      <span className="h-px flex-1 bg-line" aria-hidden />
      <span className="max-w-[80%] text-center">
        Neuer Status: „<span className="font-semibold text-ink-soft">{labelOf(STATUS_LABELS, event.toValue)}</span>“
        {who ? ` · ${who}` : null} · <time dateTime={event.createdAt.toISOString()}>{formatDateTime(event.createdAt)}</time>
      </span>
      <span className="h-px flex-1 bg-line" aria-hidden />
    </li>
  );
}

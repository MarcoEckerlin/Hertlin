import { cn } from "@/lib/cn";
import { toDateInput } from "@/lib/format";
import type { InquiryChatEntry } from "@/lib/inquiry-chat";
import { TranslatedBody } from "@/components/translate/translated-body";
import { ChatScroller } from "@/components/inquiry-chat/chat-scroller";

/**
 * Chat-Verlauf einer Anfrage, gemeinsam für Interessent und Verwaltung.
 * Farben: Hertlin hellblau, Interessent weiß. Eigene Nachrichten stehen rechts.
 */

export type ChatTranslations = Record<string, { text: string; from: string | null }>;

const TZ = "Europe/Berlin";
const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayFormat = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const fullFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short", timeZone: TZ });

function dayLabel(date: Date, now: Date): string {
  const key = toDateInput(date);
  if (key === toDateInput(now)) return "Heute";
  if (key === toDateInput(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return "Gestern";
  return dayFormat.format(date);
}

export function ChatThread({
  entries,
  perspective,
  translations = {},
  companyName,
  selfId,
  className,
}: {
  entries: InquiryChatEntry[];
  /** guest: Interessent über seinen Link; staff: Verwaltung */
  perspective: "guest" | "staff";
  translations?: ChatTranslations;
  /** Firmenname (Hertlin) für die Kennzeichnung der Mitarbeiter-Nachrichten */
  companyName: string;
  /** staff: eigene Benutzer-ID, um „(Sie)“ anzuzeigen */
  selfId?: string;
  className?: string;
}) {
  const now = new Date();
  const last = entries[entries.length - 1];
  const isMine = (entry: InquiryChatEntry) => (perspective === "guest" ? !entry.fromStaff : entry.fromStaff);

  const days = entries.map((entry) => toDateInput(entry.createdAt));

  return (
    <ChatScroller
      lastKey={last ? last.id : "leer"}
      lastFromSelf={last ? isMine(last) : false}
      label="Nachrichtenverlauf"
      className={className}
    >
      <ol className="space-y-3 px-3 py-5 sm:px-5">
        {entries.map((entry, i) => (
          <ChatEntryItem
            key={entry.id}
            entry={entry}
            mine={isMine(entry)}
            perspective={perspective}
            translation={translations[entry.id] ?? null}
            companyName={companyName}
            selfId={selfId}
            dayLabel={i === 0 || days[i] !== days[i - 1] ? dayLabel(entry.createdAt, now) : null}
          />
        ))}
      </ol>
    </ChatScroller>
  );
}

function ChatEntryItem({
  entry,
  mine,
  perspective,
  translation,
  companyName,
  selfId,
  dayLabel,
}: {
  entry: InquiryChatEntry;
  mine: boolean;
  perspective: "guest" | "staff";
  translation: { text: string; from: string | null } | null;
  companyName: string;
  selfId?: string;
  dayLabel: string | null;
}) {
  let author: string;
  let note: string | null = null;
  if (entry.isOriginal) {
    author = perspective === "guest" ? "Ihre Anfrage" : entry.authorName;
    note = perspective === "guest" ? "über das Kontaktformular" : "Anfrage über das Kontaktformular";
  } else if (entry.fromStaff) {
    author = entry.authorName;
    if (perspective === "guest") note = entry.authorName !== companyName ? companyName : null;
    else if (selfId && entry.authorId === selfId) note = "Sie";
  } else {
    author = perspective === "guest" ? "Sie" : entry.authorName;
    note = perspective === "staff" ? "Interessent" : null;
  }

  // Eigene Texte und bereits übersetzte Nachrichten lässt der Website-Übersetzer in Ruhe
  const keepAsIs = mine || entry.isOriginal || translation !== null;

  return (
    <>
      {dayLabel ? (
        <li className="flex items-center gap-3 py-1 text-xs font-semibold text-ink-muted">
          <span className="h-px flex-1 bg-line" aria-hidden />
          <span>{dayLabel}</span>
          <span className="h-px flex-1 bg-line" aria-hidden />
        </li>
      ) : null}
      <li className={cn("flex", mine ? "justify-end" : "justify-start")}>
        <article
          className={cn(
            "max-w-[88%] min-w-0 rounded-2xl px-4 pt-2.5 pb-2 ring-1 ring-inset sm:max-w-[78%]",
            entry.fromStaff ? "bg-brand-100 ring-brand-200" : "bg-white shadow-card ring-line",
            mine ? "rounded-br-md" : "rounded-bl-md",
          )}
        >
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold break-words text-ink">{author}</p>
            {note ? <span className="text-xs text-ink-muted">{note}</span> : null}
          </header>
          <div className="mt-1" dir="auto" data-no-translate={keepAsIs ? "" : undefined}>
            <TranslatedBody
              original={entry.body}
              translation={translation}
              className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-ink [overflow-wrap:anywhere]"
            />
          </div>
          <p className="mt-1 text-right text-[0.6875rem] text-ink-muted">
            <time dateTime={entry.createdAt.toISOString()} title={fullFormat.format(entry.createdAt)}>
              {timeFormat.format(entry.createdAt)}
            </time>
          </p>
        </article>
      </li>
    </>
  );
}

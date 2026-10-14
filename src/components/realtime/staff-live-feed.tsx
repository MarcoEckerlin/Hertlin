"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Inbox, MessageSquare, Phone, Ticket, X } from "lucide-react";
import { useChannel } from "@/realtime/client";
import type { StaffNotice } from "@/realtime/protocol";
import { formatTicketNumber, formatInquiryNumber } from "@/lib/format";
import { PRIORITY_LABELS, labelOf } from "@/lib/constants";

type Toast = { id: string; notice: StaffNotice; sticky: boolean };

const SPEC = { t: "sub", ch: "staff" } as const;

function noticeHref(n: StaffNotice): string | null {
  switch (n.kind) {
    case "ticket.created":
    case "ticket.message":
      return `/admin/tickets/${n.ticketId}`;
    case "inquiry.created":
    case "inquiry.message":
      return `/admin/anfragen/${n.inquiryId}`;
    case "call.incoming":
      return `/admin/anrufe/${n.callId}`;
    default:
      return null;
  }
}

function showSystemNotification(title: string, body: string, href: string | null) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || document.visibilityState === "visible") return;
  const n = new Notification(title, { body, tag: href ?? title });
  n.onclick = () => {
    window.focus();
    if (href) window.location.href = href;
  };
}

/**
 * Live-Hinweise für das Hertlin-Team: eingehende Anrufe, neue Tickets und Anfragen,
 * neue Kundennachrichten. Hängt in der Verwaltungs-Oberfläche.
 */
export function StaffLiveFeed() {
  const router = useRouter();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Solange die Maus über den Hinweisen ist oder einer davon den Fokus hat, verschwindet nichts. */
  const paused = useRef(false);

  const dismiss = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((t) => t.filter((x) => x.id !== id));
  };

  const schedule = (id: string, ms: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  };

  const pause = () => {
    paused.current = true;
    for (const timer of timers.current.values()) clearTimeout(timer);
    timers.current.clear();
  };

  const resume = () => {
    paused.current = false;
    for (const t of toasts) if (!t.sticky) schedule(t.id, 5000);
  };

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  useChannel(SPEC, (message) => {
    if (message.t !== "notice") return;
    const n = message.notice;

    // Zähler in der Navigation aktualisieren
    if (n.kind === "ticket.created" || n.kind === "inquiry.created") router.refresh();

    if (n.kind === "call.updated") {
      // Zähler „verpasste Anrufe“ in der Navigation aktualisieren
      if (n.status === "MISSED") router.refresh();
      // Angenommene oder beendete Anrufe aus der Anzeige nehmen
      if (n.status !== "RINGING") {
        setToasts((t) => t.filter((x) => !(x.notice.kind === "call.incoming" && x.notice.callId === n.callId)));
      }
      return;
    }

    const href = noticeHref(n);
    // Kein Hinweis für das Ticket, das gerade offen ist
    if (href && pathname === href && n.kind !== "call.incoming") return;

    counter.current += 1;
    const toast: Toast = { id: `${Date.now()}-${counter.current}`, notice: n, sticky: n.kind === "call.incoming" };
    setToasts((t) => [toast, ...t].slice(0, 5));
    if (!toast.sticky && !paused.current) schedule(toast.id, 9000);

    if (n.kind === "call.incoming") showSystemNotification("Eingehender Anruf", n.callerLabel ?? n.from, href);
    if (n.kind === "ticket.created") showSystemNotification(`Neues Ticket ${formatTicketNumber(n.ticketId)}`, n.subject, href);
  });

  // Die Live-Region bleibt immer im Dokument, sonst lesen Screenreader den ersten Hinweis nicht vor.
  // Mobil oben unter der Kopfzeile und höchstens zwei Hinweise, damit Eingabefelder und Speichern-Leisten frei bleiben.
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2 max-sm:top-16 max-sm:bottom-auto max-sm:[&>:nth-child(n+3)]:hidden"
      aria-live="polite"
      onMouseEnter={pause}
      onMouseLeave={(e) => {
        if (!e.currentTarget.contains(document.activeElement)) resume();
      }}
      onFocus={pause}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) resume();
      }}
    >
      {toasts.map(({ id, notice: n }) => {
        const href = noticeHref(n);
        let icon = <Ticket className="size-4" aria-hidden />;
        let title = "";
        let body: string | null = null;
        let extra: React.ReactNode = null;

        switch (n.kind) {
          case "call.incoming":
            icon = <Phone className="size-4" aria-hidden />;
            title = "Eingehender Anruf";
            body = n.callerLabel ? `${n.callerLabel} · ${n.from}` : n.from;
            extra = (
              <div className="mt-2 flex flex-wrap gap-2">
                {n.companyId ? (
                  <Link href={`/admin/kunden/${n.companyId}`} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink ring-1 ring-line-strong hover:bg-brand-50">
                    Kunde öffnen
                  </Link>
                ) : null}
                <Link
                  href={`/admin/anrufe/${n.callId}#ticket-anlegen`}
                  className="rounded-full bg-brand-400 px-3 py-1 text-xs font-semibold text-ink hover:bg-brand-300"
                >
                  Ticket anlegen
                </Link>
              </div>
            );
            break;
          case "ticket.created":
            title = `Neues Ticket ${formatTicketNumber(n.ticketId)} · ${labelOf(PRIORITY_LABELS, n.priority)}`;
            body = `${n.subject} – ${n.customer}`;
            break;
          case "ticket.message":
            icon = <MessageSquare className="size-4" aria-hidden />;
            title = `Antwort in ${formatTicketNumber(n.ticketId)}`;
            body = `${n.author}: ${n.subject}`;
            break;
          case "inquiry.created":
            icon = <Inbox className="size-4" aria-hidden />;
            title = `Neue Anfrage ${formatInquiryNumber(n.inquiryId)}`;
            body = n.name;
            break;
          case "inquiry.message":
            icon = <MessageSquare className="size-4" aria-hidden />;
            title = `Nachricht zu ${formatInquiryNumber(n.inquiryId)}`;
            body = n.name;
            break;
        }

        const critical = n.kind === "call.incoming" || (n.kind === "ticket.created" && n.priority === "CRITICAL");
        return (
          <div
            key={id}
            className={`pointer-events-auto rounded-2xl border p-4 shadow-lift ${
              critical ? "border-brand-300 bg-brand-100" : "border-line bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-white text-brand-700 ring-1 ring-line">{icon}</span>
              <div className="min-w-0 flex-1">
                {href && n.kind !== "call.incoming" ? (
                  <Link href={href} className="block font-semibold text-ink hover:underline" onClick={() => dismiss(id)}>
                    {title}
                  </Link>
                ) : (
                  <p className="font-semibold text-ink">{title}</p>
                )}
                {body ? <p className="mt-0.5 truncate text-sm text-ink-soft">{body}</p> : null}
                {extra}
              </div>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="grid size-7 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-white hover:text-ink"
                aria-label="Hinweis schließen"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

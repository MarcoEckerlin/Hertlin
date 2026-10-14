"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useChannel, useRealtimeConnected } from "@/realtime/client";
import type { ClientMessage } from "@/realtime/protocol";
import { cn } from "@/lib/cn";

type Spec = Extract<ClientMessage, { t: "sub" }>;

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
}

/**
 * Live-Leiste über bzw. unter einem Verlauf:
 * - lädt den Verlauf neu, sobald jemand schreibt oder sich der Status ändert
 * - zeigt, wer gerade im Ticket ist und wer tippt
 *
 * audience "customer": zeigt nur, ob Hertlin da ist / schreibt.
 * audience "staff": zeigt Kunden und Kollegen.
 */
export function LiveConversation({
  spec,
  audience,
  selfName,
  companyName,
  className,
}: {
  spec: Spec;
  audience: "customer" | "staff";
  /** eigener Name, wird aus Anwesenheit/Tippen herausgefiltert */
  selfName?: string;
  /** Firmenname aus den Firmendaten, steht beim Kunden hinter den Namen unserer Mitarbeiter */
  companyName?: string;
  className?: string;
}) {
  const router = useRouter();
  const connected = useRealtimeConnected();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { presence, typing } = useChannel(spec, (message) => {
    if (message.t !== "message" && message.t !== "update") return;
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 150);
  });

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const others = (names: string[]) => names.filter((n) => n !== selfName);
  const staffHere = others(presence.staff);
  const customersHere = others(presence.customers);
  const typingNames = typing.filter((t) => t.name !== selfName);

  const company = companyName ? ` (${companyName})` : "";
  let presenceText: string | null = null;
  if (audience === "customer") {
    if (staffHere.length > 0) presenceText = `${joinNames(staffHere)}${company} ${staffHere.length > 1 ? "lesen" : "liest"} gerade mit.`;
  } else {
    const parts: string[] = [];
    if (customersHere.length > 0) parts.push(`${joinNames(customersHere)} ${customersHere.length > 1 ? "sind" : "ist"} gerade online`);
    if (staffHere.length > 0) parts.push(`${joinNames(staffHere)} ${staffHere.length > 1 ? "sehen" : "sieht"} sich das auch an`);
    presenceText = parts.length ? `${parts.join(" · ")}.` : null;
  }

  const typingText =
    typingNames.length > 0
      ? `${joinNames(typingNames.map((t) => (audience === "customer" && t.staff ? `${t.name}${company}` : t.name)))} ${
          typingNames.length > 1 ? "schreiben" : "schreibt"
        } gerade …`
      : null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted", className)}
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-slate-300")}
          aria-hidden
        />
        {connected ? "Live" : "Verbindung wird aufgebaut …"}
      </span>
      {presenceText ? <span>{presenceText}</span> : null}
      {typingText ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-brand-700">
          <span className="inline-flex gap-0.5" aria-hidden>
            <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="size-1 animate-bounce rounded-full bg-current" />
          </span>
          {typingText}
        </span>
      ) : null}
    </div>
  );
}

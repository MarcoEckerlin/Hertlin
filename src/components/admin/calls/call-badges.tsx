import { PhoneIncoming, PhoneMissed, PhoneOutgoing } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { CALL_PROVIDER_LABELS, CALL_STATUS_LABELS, isStaleRinging, type CallProvider, type CallStatus } from "@/lib/phone";

type CallForBadge = {
  status: string;
  direction: string;
  startedAt: Date;
  answeredAt: Date | null;
  answeredBy: string | null;
  handledAt: Date | null;
};

/** Status eines Anrufs als Badge: Klingelt, Angenommen, Verpasst, Beendet. */
export function CallStatusBadge({ call, now }: { call: CallForBadge; now?: Date }) {
  let tone: BadgeTone = "gray";
  let label = CALL_STATUS_LABELS[call.status as CallStatus] ?? call.status;
  let pulse = false;

  if (isStaleRinging(call, now)) {
    label = "Keine Rückmeldung";
  } else if (call.status === "RINGING") {
    tone = "blue";
    label = call.direction === "OUT" ? "Wählt" : "Klingelt";
    pulse = true;
  } else if (call.status === "ANSWERED") {
    tone = "green";
    label = call.direction === "OUT" ? "Im Gespräch" : "Angenommen";
  } else if (call.status === "MISSED") {
    tone = call.handledAt ? "gray" : "red";
    label = call.handledAt ? "Verpasst, erledigt" : "Verpasst";
  } else if (call.status === "ENDED" && call.direction === "OUT" && !call.answeredAt && !call.answeredBy) {
    label = "Nicht erreicht";
  }

  return (
    <Badge tone={tone}>
      <span className={cn("size-1.5 rounded-full bg-current opacity-70", pulse && "animate-pulse")} aria-hidden />
      {label}
    </Badge>
  );
}

/** Symbol für die Richtung; mit withLabel zusätzlich als Text. */
export function CallDirection({ direction, status, withLabel = false }: { direction: string; status: string; withLabel?: boolean }) {
  const out = direction === "OUT";
  const missed = !out && status === "MISSED";
  const Icon = out ? PhoneOutgoing : missed ? PhoneMissed : PhoneIncoming;
  const label = out ? "Ausgehend" : "Eingehend";
  return (
    <span className={cn("inline-flex items-center gap-1.5", missed ? "text-danger-ink" : "text-ink-soft")} title={label}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {withLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}

export function TestCallBadge({ provider }: { provider: string }) {
  if (provider !== "test") return null;
  return <Badge tone="amber">{CALL_PROVIDER_LABELS[provider as CallProvider]}</Badge>;
}

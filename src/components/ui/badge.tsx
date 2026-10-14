import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  INQUIRY_STATUS_LABELS,
  PRIORITY_LABELS,
  ROLE_LABELS,
  STATUS_LABELS,
  STATUS_LABELS_STAFF,
  labelOf,
} from "@/lib/constants";

export type BadgeTone = "blue" | "gray" | "green" | "amber" | "orange" | "red" | "ink";

const tones: Record<BadgeTone, string> = {
  blue: "bg-brand-100 text-brand-800 ring-brand-200",
  gray: "bg-neutral-soft text-neutral-ink ring-neutral-line",
  green: "bg-success-soft text-success-ink ring-success-line",
  amber: "bg-warning-soft text-warning-ink ring-warning-line",
  orange: "bg-caution-soft text-caution-ink ring-caution-line",
  red: "bg-danger-soft text-danger-ink ring-danger-line",
  ink: "bg-ink text-on-ink ring-ink",
};

export function Badge({ tone = "gray", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<string, BadgeTone> = {
  NEW: "blue",
  IN_PROGRESS: "amber",
  WAITING_CUSTOMER: "orange",
  RESOLVED: "green",
  CLOSED: "gray",
};

/** audience "staff" zeigt "Wartet auf Kunde" statt "Rückfrage an Sie". */
export function StatusBadge({ status, audience = "customer" }: { status: string; audience?: "customer" | "staff" }) {
  const labels = audience === "staff" ? STATUS_LABELS_STAFF : STATUS_LABELS;
  return (
    <Badge tone={statusTone[status] ?? "gray"}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {labelOf(labels, status)}
    </Badge>
  );
}

const priorityTone: Record<string, BadgeTone> = {
  LOW: "gray",
  NORMAL: "blue",
  HIGH: "orange",
  CRITICAL: "red",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={priorityTone[priority] ?? "gray"}>{labelOf(PRIORITY_LABELS, priority)}</Badge>;
}

const inquiryTone: Record<string, BadgeTone> = {
  NEW: "blue",
  CONTACTED: "amber",
  OFFER_SENT: "orange",
  WON: "green",
  LOST: "gray",
};

export function InquiryStatusBadge({ status }: { status: string }) {
  return <Badge tone={inquiryTone[status] ?? "gray"}>{labelOf(INQUIRY_STATUS_LABELS, status)}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const tone: BadgeTone = role === "ADMIN" || role === "CUSTOMER_ADMIN" ? "blue" : "gray";
  return <Badge tone={tone}>{labelOf(ROLE_LABELS, role)}</Badge>;
}

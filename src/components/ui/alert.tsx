import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "error";

const styles: Record<Tone, string> = {
  info: "bg-brand-50 text-brand-900 ring-brand-200",
  success: "bg-success-soft text-success-ink ring-success-line",
  warning: "bg-warning-soft text-warning-ink ring-warning-line",
  error: "bg-danger-soft text-danger-ink ring-danger-line",
};

const icons = { info: Info, success: CircleCheck, warning: TriangleAlert, error: CircleAlert };

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset", styles[tone], className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

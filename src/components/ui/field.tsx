import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border border-line-strong bg-white px-3.5 text-[0.9375rem] text-ink placeholder:text-ink-muted/80 shadow-[inset_0_1px_1px_rgb(16_36_58/0.03)] transition-colors hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-200/70 disabled:bg-mist disabled:text-ink-muted aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-100";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-semibold text-ink", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 5, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(control, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-muted"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
      >
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Checkbox({ className, label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-[0.9375rem] text-ink", className)}>
      <input
        type="checkbox"
        className="mt-0.5 size-[1.125rem] shrink-0 cursor-pointer rounded border-line-strong accent-brand-600"
        {...props}
      />
      <span>
        {label}
        {hint ? <span className="mt-0.5 block text-sm text-ink-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function FieldError({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-red-700">
      {children}
    </p>
  );
}

export function Hint({ children, id }: { children?: ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-ink-muted">
      {children}
    </p>
  );
}

/**
 * Label + Eingabefeld + Hinweis + Fehlermeldung.
 * Das Eingabefeld wird als children übergeben und sollte id={name} und aria-invalid tragen.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional ? <span className="text-xs text-ink-muted">optional</span> : null}
      </div>
      {children}
      {error ? <FieldError id={`${htmlFor}-error`}>{error}</FieldError> : <Hint id={`${htmlFor}-hint`}>{hint}</Hint>}
    </div>
  );
}

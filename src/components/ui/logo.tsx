import { cn } from "@/lib/cn";

/** Bildmarke: hellblaues Quadrat mit weißem H. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#66b9ec" />
      <path d="M10 8.5v15M22 8.5v15M10 16h12" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, subtitle }: { className?: string; subtitle?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[1.2rem] font-extrabold tracking-tight text-ink">Hertlin</span>
        {subtitle ? <span className="mt-1 text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">{subtitle}</span> : null}
      </span>
    </span>
  );
}

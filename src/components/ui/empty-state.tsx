import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-mist px-6 py-12 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-md text-sm text-ink-soft">{children}</div> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Tabelle in einer Karte mit horizontalem Scrollen auf kleinen Bildschirmen. */
export function Table({ className, children, ...props }: ComponentProps<"table">) {
  return (
    <div className="relative overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className={cn("w-full min-w-[40rem] border-collapse text-left text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("border-b border-line bg-mist text-xs text-ink-muted", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("px-4 py-3 font-semibold whitespace-nowrap first:pl-5 last:pr-5", className)} {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-line last:border-0 hover:bg-brand-50/50", className)} {...props} />;
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-middle text-ink-soft first:pl-5 last:pr-5", className)} {...props} />;
}

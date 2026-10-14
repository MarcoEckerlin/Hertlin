import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[color,background-color,box-shadow,transform] duration-150 active:scale-[0.98] motion-reduce:transform-none disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-brand-50 hover:ring-brand-300",
  ghost: "text-ink-soft hover:bg-brand-50 hover:text-ink",
  danger: "bg-surface text-danger-ink ring-1 ring-inset ring-danger-line hover:bg-danger-soft",
  dark: "bg-ink text-on-ink hover:bg-brand-900",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-sm",
  md: "h-10 px-5 text-[0.9375rem]",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize };

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}

import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Logo } from "@/components/ui/logo";

/** Zentrierte Karte für Anmeldung, Passwort vergessen usw. Unten dezent der Umschalter Hell/Dunkel. */
export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  homeHref = "/",
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  homeHref?: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col bg-brand-50">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[26rem]">
          <Link href={homeHref} className="mb-8 flex justify-center">
            <Logo />
          </Link>
          <div className="rounded-3xl border border-line bg-surface-raised p-7 shadow-lift sm:p-9">
            {eyebrow ? <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">{eyebrow}</p> : null}
            <h1 className="mt-1 text-2xl font-bold text-ink">{title}</h1>
            {description ? <div className="mt-2 text-[0.9375rem] leading-relaxed text-ink-soft">{description}</div> : null}
            <div className="mt-7">{children}</div>
          </div>
          {footer ? <div className="mt-6 text-center text-sm text-ink-soft">{footer}</div> : null}
        </div>
      </div>
      <div className="flex justify-center pb-6">
        <ThemeToggle compact />
      </div>
    </main>
  );
}

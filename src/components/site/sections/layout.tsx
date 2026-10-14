import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Seitenbreite der Website mit einheitlichen Seitenabständen. */
export function Container({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

/**
 * Inhaltsabschnitt einer Marketingseite.
 * tone "brand" = hellblaue Fläche, "white" = weiße Fläche. Abschnitte möglichst abwechseln.
 */
export function Section({
  id,
  tone = "white",
  labelledBy,
  className,
  children,
}: {
  id?: string;
  tone?: "white" | "brand";
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("scroll-mt-20 py-16 lg:py-24", tone === "brand" ? "bg-brand-50" : "bg-white", className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

/** Kleine Überzeile über Überschriften. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm font-bold tracking-wider text-brand-700 uppercase", className)}>{children}</p>;
}

/** Überschrift eines Abschnitts mit optionaler Überzeile und Einleitung. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  className,
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        id={id}
        className={cn(
          "text-3xl font-bold tracking-tight text-ink hyphens-auto sm:text-4xl sm:hyphens-manual",
          eyebrow ? "mt-3" : undefined,
        )}
      >
        {title}
      </h2>
      {children ? <div className="mt-4 space-y-3 text-lg leading-relaxed text-ink-soft">{children}</div> : null}
    </div>
  );
}

/** Kopfbereich einer Unterseite: hellblaue Fläche mit H1, Einleitung, Buttons und optionaler Seitenspalte. */
export function PageHero({
  eyebrow,
  title,
  children,
  actions,
  aside,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="bg-brand-50">
      <Container
        className={cn(
          "grid gap-10 py-14 sm:py-16 lg:py-24",
          aside ? "lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-center lg:gap-16" : undefined,
        )}
      >
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink hyphens-auto sm:text-5xl sm:hyphens-manual">
            {title}
          </h1>
          {children ? <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink-soft">{children}</div> : null}
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {aside ? <div>{aside}</div> : null}
      </Container>
    </section>
  );
}

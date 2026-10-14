import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Container, Eyebrow } from "@/components/site/sections/layout";

/** true, wenn ein Konfigurationswert noch ein Platzhalter ist (beginnt mit "TODO"). */
export function isPlaceholder(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().toUpperCase().startsWith("TODO");
}

/**
 * Hinweis für den Betreiber, solange Pflichtangaben in src/config/site.ts noch Platzhalter sind.
 * Verschwindet automatisch, sobald alle übergebenen Werte ausgefüllt sind.
 */
export function PlaceholderNotice({ values }: { values: Array<string | null | undefined> }) {
  if (!values.some(isPlaceholder)) return null;
  return (
    <Alert tone="warning" title="Angaben noch unvollständig" className="mb-10">
      Einige Firmenangaben auf dieser Seite sind noch Platzhalter (in <code className="font-mono text-[0.8125rem]">src/config/site.ts</code>{" "}
      mit „TODO“ markiert). Bitte vor der Veröffentlichung vollständig ergänzen und den Text rechtlich prüfen lassen.
    </Alert>
  );
}

/** Seitengerüst für Impressum und Datenschutzerklärung. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  notice,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <section className="bg-brand-50">
        <Container className="py-12 sm:py-16">
          <div className="max-w-3xl">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink hyphens-auto sm:text-5xl sm:hyphens-manual">
              {title}
            </h1>
            {intro ? <div className="mt-4 text-lg leading-relaxed text-ink-soft">{intro}</div> : null}
          </div>
        </Container>
      </section>
      <section className="bg-white">
        <Container className="py-12 sm:py-16">
          <div className="max-w-prose">
            {notice}
            <div className="prose-hertlin">{children}</div>
          </div>
        </Container>
      </section>
    </>
  );
}

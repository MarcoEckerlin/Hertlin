import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/site/sections/layout";

/**
 * Platzhalter beim Seitenwechsel (loading.tsx der Website): ein Seitenkopf und ein Abschnitt,
 * etwa so hoch wie die echte Seite, damit beim Laden nichts springt.
 */
export function SitePageSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Seite wird geladen …</span>
      <section className="bg-brand-50">
        <Container className="pt-14 pb-14 sm:pt-16 sm:pb-16 lg:pt-24 lg:pb-24">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-6 h-9 w-full max-w-2xl sm:h-12" />
          <Skeleton className="mt-3 h-9 w-3/4 max-w-xl sm:h-12" />
          <div className="mt-8 max-w-[38rem] space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="mt-8 flex gap-3">
            <Skeleton className="h-12 w-40 rounded-full" />
            <Skeleton className="h-12 w-40 rounded-full" />
          </div>
        </Container>
      </section>
      <Container className="py-16 lg:py-24">
        <Skeleton className="h-8 w-72 max-w-full" />
        <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3 border-t border-line pt-6">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}

import { PageSkeleton } from "@/components/ui/skeleton";

/** Sofortige Rückmeldung beim Seitenwechsel in der Verwaltung, bis die Seite vom Server da ist. */
export default function AdminLoading() {
  return <PageSkeleton />;
}

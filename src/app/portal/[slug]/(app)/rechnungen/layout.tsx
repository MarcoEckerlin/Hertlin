import type { ReactNode } from "react";
import { requirePortalAdmin } from "@/lib/auth";

/** Rechnungen nur für Hauptansprechpartner – geprüft vor dem Platzhalter, damit die Weiterleitung echt bleibt. */
export default async function PortalInvoicesLayout({ children }: { children: ReactNode }) {
  await requirePortalAdmin();
  return children;
}

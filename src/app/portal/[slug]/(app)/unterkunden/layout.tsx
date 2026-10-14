import type { ReactNode } from "react";
import { requirePortalRootAdmin } from "@/lib/auth";

/** Unterkunden nur für Hauptansprechpartner des Firmenkunden – geprüft vor dem Platzhalter (echte Weiterleitung). */
export default async function PortalSubCustomersLayout({ children }: { children: ReactNode }) {
  await requirePortalRootAdmin();
  return children;
}

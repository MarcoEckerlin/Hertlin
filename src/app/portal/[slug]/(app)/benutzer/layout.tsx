import type { ReactNode } from "react";
import { requirePortalAdmin } from "@/lib/auth";

/** Benutzerverwaltung nur für Hauptansprechpartner – geprüft vor dem Platzhalter, damit die Weiterleitung echt bleibt. */
export default async function PortalUsersLayout({ children }: { children: ReactNode }) {
  await requirePortalAdmin();
  return children;
}

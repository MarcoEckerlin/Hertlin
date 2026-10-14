import { connection } from "next/server";
import { getNavigation } from "@/cms/store";
import { SiteShell } from "@/components/site/site-shell";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Menü, Firmendaten und Hostnamen werden pro Anfrage gelesen
  await connection();
  const nav = await getNavigation();
  return <SiteShell nav={nav}>{children}</SiteShell>;
}

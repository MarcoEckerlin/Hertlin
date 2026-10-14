import Link from "next/link";
import { connection } from "next/server";
import { LogoMark } from "@/components/ui/logo";
import { buttonClasses } from "@/components/ui/button";
import { mainUrl } from "@/lib/hosts";

export default async function NotFound() {
  await connection();
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-50 px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-12" />
        <p className="mt-6 text-sm font-bold tracking-wider text-brand-700 uppercase">Fehler 404</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Diese Seite gibt es nicht</h1>
        <p className="mt-3 text-ink-soft">
          Vielleicht hat sich ein Tippfehler in die Adresse geschlichen, oder die Seite wurde verschoben. Bei einer
          Portal-Adresse prüfen Sie bitte das Kürzel vor dem Punkt.
        </p>
        <Link href={mainUrl("/")} className={buttonClasses("primary", "md", "mt-8")}>
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}

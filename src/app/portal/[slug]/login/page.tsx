import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getPortalCompany, getPortalContext } from "@/lib/auth";
import { mainUrl } from "@/lib/hosts";
import { getSiteSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Anmeldung" };

export default async function PortalLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getPortalContext()) redirect("/");
  const { slug } = await params;
  const { next } = await searchParams;
  const company = await getPortalCompany(slug);
  const site = await getSiteSettings();

  return (
    <AuthCard
      eyebrow="Kundenportal"
      title={company?.name ?? "Anmeldung"}
      description="Melden Sie Störungen, stellen Sie Anfragen und sehen Sie, woran wir gerade arbeiten."
      homeHref={mainUrl("/")}
      footer={
        <>
          Noch keinen Zugang? Ihr Hauptansprechpartner kann Sie im Portal anlegen.
          <br />
          Dringend? <a className="font-semibold text-brand-700 hover:underline" href={`tel:${site.phoneHref}`}>{site.phone}</a>
        </>
      }
    >
      <LoginForm next={next} forgotHref="/passwort-vergessen" />
    </AuthCard>
  );
}

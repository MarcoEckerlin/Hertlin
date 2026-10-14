import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { portalContact } from "@/components/portal/portal-data";
import { getPortalCompany, getPortalContext } from "@/lib/auth";
import { mainUrl } from "@/lib/hosts";

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
  // Telefon des betreuenden Standorts; ohne echte Nummer kein Hinweis
  const contact = await portalContact({ companyId: company?.id ?? null });

  return (
    <AuthCard
      eyebrow="Kundenportal"
      title={company?.name ?? "Anmeldung"}
      description="Melden Sie Störungen, stellen Sie Anfragen und sehen Sie, woran wir gerade arbeiten."
      homeHref={mainUrl("/")}
      footer={
        <>
          Noch keinen Zugang? Ihr Hauptansprechpartner kann Sie im Portal anlegen.
          {contact.phone && contact.phoneHref ? (
            <>
              <br />
              Dringend?{" "}
              <a className="font-semibold whitespace-nowrap text-brand-700 hover:underline" href={contact.phoneHref}>
                {contact.phone}
              </a>
            </>
          ) : null}
        </>
      }
    >
      <LoginForm next={next} forgotHref="/passwort-vergessen" />
    </AuthCard>
  );
}

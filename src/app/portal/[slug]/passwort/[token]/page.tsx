import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { findValidAuthToken, portalSlugOfCompany } from "@/lib/auth-tokens";
import { Alert } from "@/components/ui/alert";
import { mainUrl } from "@/lib/hosts";

export const metadata: Metadata = { title: "Passwort festlegen" };

export default async function PortalSetPasswordPage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const record = await findValidAuthToken(token);
  const valid = record && portalSlugOfCompany(record.user.company) === slug;

  if (!valid) {
    return (
      <AuthCard title="Link nicht mehr gültig" homeHref={mainUrl("/")}>
        <Alert tone="warning">
          Dieser Link ist abgelaufen oder wurde schon benutzt. Fordern Sie über „Passwort vergessen“ einen neuen an oder
          bitten Sie Ihren Hauptansprechpartner, die Einladung erneut zu senden.
        </Alert>
        <Link href="/passwort-vergessen" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
          Neuen Link anfordern
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow={record.user.company?.name}
      title={record.purpose === "INVITE" ? `Willkommen, ${record.user.name}` : "Neues Passwort festlegen"}
      description={
        record.purpose === "INVITE"
          ? "Legen Sie ein Passwort für Ihren Zugang zum Kundenportal fest. Danach sind Sie direkt angemeldet."
          : `Für ${record.user.email}`
      }
      homeHref={mainUrl("/")}
    >
      <SetPasswordForm token={token} email={record.user.email} />
    </AuthCard>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { findValidAuthToken } from "@/lib/auth-tokens";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Passwort festlegen", robots: { index: false } };

export default async function AdminSetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await findValidAuthToken(token);
  const valid = record && (record.user.role === "ADMIN" || record.user.role === "TECHNICIAN");

  if (!valid) {
    return (
      <AuthCard title="Link nicht mehr gültig">
        <Alert tone="warning">
          Dieser Link ist abgelaufen oder wurde schon benutzt. Fordern Sie über „Passwort vergessen“ einfach einen neuen an.
        </Alert>
        <Link href="/admin/passwort-vergessen" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
          Neuen Link anfordern
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={record.purpose === "INVITE" ? `Willkommen, ${record.user.name}` : "Neues Passwort festlegen"}
      description={
        record.purpose === "INVITE"
          ? "Legen Sie Ihr Passwort fest. Danach sind Sie direkt angemeldet."
          : `Für ${record.user.email}`
      }
    >
      <SetPasswordForm token={token} email={record.user.email} />
    </AuthCard>
  );
}

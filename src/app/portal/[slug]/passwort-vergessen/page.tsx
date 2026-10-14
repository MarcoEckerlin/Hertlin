import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { mainUrl } from "@/lib/hosts";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function PortalForgotPasswordPage() {
  return (
    <AuthCard
      title="Passwort vergessen"
      description="Geben Sie die E-Mail-Adresse Ihres Zugangs ein. Sie bekommen einen Link, mit dem Sie ein neues Passwort festlegen."
      homeHref={mainUrl("/")}
      footer={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}

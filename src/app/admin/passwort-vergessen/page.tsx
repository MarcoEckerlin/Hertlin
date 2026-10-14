import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Passwort vergessen", robots: { index: false } };

export default function AdminForgotPasswordPage() {
  return (
    <AuthCard
      title="Passwort vergessen"
      description="Geben Sie Ihre E-Mail-Adresse ein. Sie bekommen einen Link, mit dem Sie ein neues Passwort festlegen."
      footer={
        <Link href="/admin/login" className="font-semibold text-brand-700 hover:underline">
          Zurück zur Anmeldung
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}

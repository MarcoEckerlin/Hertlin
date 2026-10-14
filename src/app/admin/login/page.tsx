import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getStaffUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Anmeldung Verwaltung", robots: { index: false } };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getStaffUser()) redirect("/admin");
  const { next } = await searchParams;
  return (
    <AuthCard eyebrow="Hertlin intern" title="Anmeldung für Mitarbeiter" description="Tickets, Anfragen und Kunden verwalten.">
      <LoginForm next={next} forgotHref="/admin/passwort-vergessen" />
    </AuthCard>
  );
}

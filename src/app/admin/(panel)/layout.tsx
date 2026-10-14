import type { Metadata } from "next";
import { AppShell, type ShellNavGroup } from "@/components/shell/app-shell";
import { requireStaff } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: { default: "Verwaltung", template: "%s | Hertlin Verwaltung" },
  robots: { index: false },
};

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [newInquiries, newTickets] = await Promise.all([
    db.inquiry.count({ where: { status: "NEW" } }),
    db.ticket.count({ where: { status: "NEW" } }),
  ]);

  const groups: ShellNavGroup[] = [
    {
      items: [
        { href: "/admin", label: "Übersicht", icon: "dashboard", exact: true },
        { href: "/admin/tickets", label: "Tickets", icon: "tickets", count: newTickets },
        { href: "/admin/anfragen", label: "Anfragen", icon: "inquiries", count: newInquiries },
        { href: "/admin/kunden", label: "Kunden", icon: "companies" },
      ],
    },
  ];
  if (user.role === "ADMIN") {
    groups.push({
      label: "Nur Administratoren",
      items: [
        { href: "/admin/kosten", label: "Kosten pro Konto", icon: "costs" },
        { href: "/admin/team", label: "Team", icon: "team" },
      ],
    });
  }

  return (
    <AppShell
      areaLabel="Hertlin"
      areaSubLabel="Verwaltung"
      homeHref="/admin"
      groups={groups}
      user={{ name: user.name, email: user.email, roleLabel: ROLE_LABELS[user.role] }}
      profileHref="/admin/profil"
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}

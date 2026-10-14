import { AppShell, type ShellNavGroup } from "@/components/shell/app-shell";
import { requirePortalContext } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { translationEnabled } from "@/lib/translate";
import { PageTranslator } from "@/components/translate/page-translator";

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePortalContext();

  const groups: ShellNavGroup[] = [
    {
      items: [
        { href: "/", label: "Übersicht", icon: "dashboard", exact: true },
        { href: "/tickets", label: "Tickets", icon: "tickets" },
        { href: "/tickets/neu", label: "Neues Ticket", icon: "newTicket" },
      ],
    },
  ];
  if (ctx.isAdmin) {
    const items: ShellNavGroup["items"] = [{ href: "/benutzer", label: "Benutzer", icon: "users" }];
    if (ctx.isRootAdmin) items.unshift({ href: "/unterkunden", label: "Unterkunden", icon: "subCustomers" });
    groups.push({ label: "Verwaltung", items });
  }

  const subLabel = ctx.company.parentId ? `${ctx.company.name} · ${ctx.root.name}` : "Kundenportal";

  // Website-Übersetzer, damit fremdsprachige Mitarbeiter die Oberfläche lesen können (nur im Portal, nicht in der Verwaltung)
  const translator = translationEnabled() ? <PageTranslator enabled compact /> : undefined;

  return (
    <AppShell
      areaLabel={ctx.company.parentId ? ctx.company.name : ctx.root.name}
      areaSubLabel={ctx.company.parentId ? `Unterkunde von ${ctx.root.name}` : subLabel}
      homeHref="/"
      groups={groups}
      user={{ name: ctx.user.name, email: ctx.user.email, roleLabel: ROLE_LABELS[ctx.user.role] }}
      profileHref="/profil"
      logoutAction={logoutAction}
      toolbar={translator}
    >
      {children}
    </AppShell>
  );
}

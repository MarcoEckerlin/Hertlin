import type { Metadata } from "next";
import { requirePortalAdmin } from "@/lib/auth";
import { portalHost } from "@/lib/hosts";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader, type Crumb } from "@/components/ui/page-header";
import { UserCreatePanel } from "@/components/portal/admin/user-create-form";
import { cleanId, manageableCompanies } from "@/components/portal/admin/data";

export const metadata: Metadata = { title: "Benutzer anlegen" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewUserPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePortalAdmin();
  const sp = await searchParams;

  // Nur aktive Firmen im eigenen Bereich (Unterkunden-Hauptansprechpartner: nur die eigene Unterkunde)
  const companies = (await manageableCompanies(ctx)).filter((c) => c.active);
  const requested = cleanId(sp.firma);
  const preselected = companies.find((c) => c.id === requested);
  const fallbackId = ctx.isRootAdmin ? ctx.root.id : ctx.company.id;
  const defaultCompanyId = preselected?.id ?? (companies.some((c) => c.id === fallbackId) ? fallbackId : companies[0]?.id);

  // Aus der Unterkunden-Seite gekommen: Brotkrumen und „Zurück“ führen dorthin
  const fromSubCustomer = ctx.isRootAdmin && preselected && !preselected.isRoot ? preselected : null;
  const breadcrumbs: Crumb[] = fromSubCustomer
    ? [
        { label: "Unterkunden", href: "/unterkunden" },
        { label: fromSubCustomer.name, href: `/unterkunden/${fromSubCustomer.id}` },
        { label: "Benutzer anlegen" },
      ]
    : [{ label: "Benutzer", href: "/benutzer" }, { label: "Neu" }];
  const backHref = fromSubCustomer ? `/unterkunden/${fromSubCustomer.id}` : "/benutzer";
  const backLabel = fromSubCustomer ? `Zurück zu ${fromSubCustomer.name}` : "Zur Benutzerliste";

  return (
    <>
      <PageHeader
        title="Benutzer anlegen"
        breadcrumbs={breadcrumbs}
        description="Sie brauchen sich kein Passwort auszudenken: Die Person bekommt eine Einladung per E-Mail und legt ihr Passwort selbst fest."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,42rem)_minmax(0,1fr)]">
        <Card className="max-w-2xl">
          <CardHeader title="Angaben zur Person" />
          <CardBody>
            {defaultCompanyId ? (
              <UserCreatePanel
                companies={companies}
                defaultCompanyId={defaultCompanyId}
                isRootAdmin={ctx.isRootAdmin}
                backHref={backHref}
                backLabel={backLabel}
              />
            ) : (
              <Alert tone="warning" title="Zurzeit können Sie keine Benutzer anlegen">
                Ihre Firma ist im Kundenportal deaktiviert. Bitte melden Sie sich bei uns, damit wir das klären.
              </Alert>
            )}
          </CardBody>
        </Card>

        <aside className="text-sm leading-relaxed text-ink-soft lg:pt-2">
          <h2 className="text-sm font-bold text-ink">So läuft die Einladung</h2>
          <ol className="mt-3 space-y-3">
            {[
              "Sie legen den Benutzer hier an.",
              "Die Person bekommt von uns eine E-Mail mit einem persönlichen Link. Er ist 7 Tage gültig.",
              `Über den Link legt sie ihr Passwort fest und ist danach direkt angemeldet. Später meldet sie sich unter ${portalHost(ctx.root.slug)} an.`,
              "Kommt die E-Mail nicht an, zeigen wir Ihnen den Link nach dem Anlegen zum Kopieren an.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}

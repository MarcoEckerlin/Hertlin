import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { requirePortalContext } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import type { TicketType } from "@/lib/constants";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { assignableCompanies } from "@/components/portal/portal-data";
import { NewTicketForm } from "@/components/portal/new-ticket-form";

export const metadata: Metadata = { title: "Neues Ticket" };

const TYPE_FROM_QUERY: Record<string, TicketType> = { stoerung: "STOERUNG", anfrage: "ANFRAGE" };

export default async function NewPortalTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePortalContext();
  const { art } = await searchParams;
  const defaultType = TYPE_FROM_QUERY[typeof art === "string" ? art : ""] ?? "STOERUNG";

  const [site, companies] = await Promise.all([getSiteSettings(), assignableCompanies(ctx)]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Übersicht", href: "/" },
          { label: "Tickets", href: "/tickets" },
          { label: "Neues Ticket" },
        ]}
        title="Neues Ticket"
        description="Beschreiben Sie kurz, worum es geht. Sie bekommen sofort eine Ticketnummer und sehen hier im Portal jederzeit den Stand."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Card>
          <CardBody className="sm:p-8">
            <NewTicketForm
              defaultType={defaultType}
              companies={companies.length > 1 ? companies.map(({ id, name, isRoot }) => ({ id, name, isRoot })) : null}
              defaultCompanyId={ctx.company.id}
              userPhone={ctx.user.phone}
              userEmail={ctx.user.email}
              sitePhone={site.phone}
              sitePhoneHref={site.phoneHref}
              uploadRules={{
                accept: ACCEPT_ATTRIBUTE,
                maxFiles: MAX_FILES,
                maxFileSize: MAX_FILE_SIZE,
                allowedLabel: ALLOWED_EXTENSIONS_LABEL,
              }}
            />
          </CardBody>
        </Card>

        <aside className="space-y-4" aria-label="Hinweise">
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
            <h2 className="text-sm font-bold text-ink">Steht der Betrieb?</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Dann rufen Sie uns bitte zusätzlich an – am Telefon sind wir am schnellsten bei Ihnen.
            </p>
            <a
              href={`tel:${site.phoneHref}`}
              className="mt-3 inline-flex items-center gap-2 font-bold whitespace-nowrap text-ink hover:text-brand-700"
            >
              <Phone className="size-4 text-brand-700" aria-hidden />
              {site.phone}
            </a>
          </div>

          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h2 className="text-sm font-bold text-ink">Was uns schneller macht</h2>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-soft">
              <li>Die Fehlermeldung wörtlich oder als Screenshot</li>
              <li>Seit wann es auftritt und ob sich vorher etwas geändert hat</li>
              <li>Wer betroffen ist – eine Person, mehrere oder alle</li>
              <li>Was Sie schon versucht haben, z. B. einen Neustart</li>
            </ul>
          </div>

          {site.responseTimes.length > 0 ? (
            <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-sm font-bold text-ink">Reaktionszeiten</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {site.responseTimes.map((entry) => (
                  <li key={entry.priority}>
                    <span className="block text-ink-soft">{entry.label}</span>
                    <span className="block font-medium text-ink">{entry.time}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Gilt innerhalb der Servicezeiten für Kunden mit Betreuungsvertrag.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </>
  );
}

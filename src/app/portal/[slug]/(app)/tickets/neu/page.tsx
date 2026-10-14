import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { requirePortalContext } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import type { TicketType } from "@/lib/constants";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Disclosure } from "@/components/portal/disclosure";
import { assignableCompanies, portalContact } from "@/components/portal/portal-data";
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

  const [site, contact, companies] = await Promise.all([
    getSiteSettings(),
    portalContact({ companyId: ctx.company.id }),
    assignableCompanies(ctx),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Übersicht", href: "/" },
          { label: "Tickets", href: "/tickets" },
          { label: "Neues Ticket" },
        ]}
        title="Neues Ticket"
        description="Sie bekommen sofort eine Ticketnummer und sehen hier jederzeit den Stand."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <Card>
          <CardBody className="sm:p-8">
            <NewTicketForm
              defaultType={defaultType}
              companies={companies.length > 1 ? companies.map(({ id, name, isRoot }) => ({ id, name, isRoot })) : null}
              defaultCompanyId={ctx.company.id}
              userPhone={ctx.user.phone}
              userEmail={ctx.user.email}
              phone={contact.phone}
              phoneHref={contact.phoneHref}
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
          {contact.phone && contact.phoneHref ? (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
              <h2 className="text-sm font-bold text-ink">Steht der Betrieb?</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Dann rufen Sie bitte zusätzlich an – am Telefon sind wir am schnellsten.
              </p>
              <a
                href={contact.phoneHref}
                className="mt-3 inline-flex items-center gap-2 font-bold whitespace-nowrap text-ink hover:text-brand-700"
              >
                <Phone className="size-4 text-brand-700" aria-hidden />
                {contact.phone}
              </a>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <section aria-labelledby="schneller">
              <h2 id="schneller" className="text-sm font-bold text-ink">
                Was uns schneller macht
              </h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-ink-soft marker:text-ink-muted">
                <li>Die Fehlermeldung wörtlich oder als Screenshot</li>
                <li>Seit wann es auftritt und ob sich vorher etwas geändert hat</li>
                <li>Wer betroffen ist – eine Person, mehrere oder alle</li>
                <li>Was Sie schon versucht haben, z. B. einen Neustart</li>
              </ul>
            </section>

            {site.responseTimes.length > 0 ? (
              <Disclosure summary="Reaktionszeiten" summaryClassName="text-sm font-bold text-ink" className="border-t border-line pt-4">
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
              </Disclosure>
            ) : null}
          </div>
        </aside>
      </div>
    </>
  );
}

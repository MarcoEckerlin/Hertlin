import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Detail, DetailList, Missing } from "@/components/admin/companies/detail-list";
import { BillingProblemsAlert } from "@/components/admin/invoices/invoice-badges";
import { BillingSettingsForm } from "@/components/admin/invoices/billing-settings-form";
import { requireAdmin } from "@/lib/auth";
import { getInvoiceIssuer } from "@/lib/billing-settings";
import { toDateInput } from "@/lib/format";
import { formatIban, taxRateToInput, yearOfInput } from "@/lib/invoices/calc";
import { isMissing } from "@/lib/invoices/settings-schema";

export const metadata: Metadata = { title: "Rechnungseinstellungen" };

function Value({ value }: { value: string }) {
  if (isMissing(value)) return <Missing>{value.trim() ? "noch Platzhalter" : "nicht hinterlegt"}</Missing>;
  return <>{value}</>;
}

export default async function BillingSettingsPage() {
  await requireAdmin();
  const { billing, site, problems } = await getInvoiceIssuer();

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Rechnungen", href: "/admin/rechnungen" }, { label: "Einstellungen" }]}
        title="Rechnungseinstellungen"
        description="Steuer, Rechnungsnummern, Bankverbindung und die Texte für Rechnung und E-Mail."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {problems.length > 0 ? (
            <BillingProblemsAlert problems={problems} title="Bevor Sie Rechnungen schreiben können" />
          ) : (
            <Alert tone="success" title="Alle Pflichtangaben sind vorhanden">
              Rechnungen können erstellt werden.
            </Alert>
          )}
          <BillingSettingsForm
            year={yearOfInput(toDateInput(new Date()))}
            issuerName={isMissing(site.legalName) ? "" : site.legalName}
            initial={{
              taxNumber: billing.taxNumber,
              smallBusiness: billing.smallBusiness,
              taxRate: taxRateToInput(billing.taxRateBasisPoints),
              paymentTermDays: String(billing.paymentTermDays),
              numberPrefix: billing.numberPrefix,
              bankAccountHolder: billing.bankAccountHolder,
              iban: billing.iban ? formatIban(billing.iban) : "",
              bic: billing.bic,
              bankName: billing.bankName,
              introText: billing.introText,
              paymentNote: billing.paymentNote,
              emailSubject: billing.emailSubject,
              emailText: billing.emailText,
              bccEmail: billing.bccEmail,
            }}
          />
        </div>

        <aside className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Absender"
              description="Aus den Firmendaten der Website. Erscheint im Kopf und in der Fußzeile jeder Rechnung."
              actions={
                <Link href="/admin/website/firmendaten" className="text-sm font-semibold text-brand-700 hover:underline">
                  Ändern
                </Link>
              }
            />
            <CardBody>
              <DetailList>
                <Detail label="Firmierung">
                  <Value value={site.legalName} />
                </Detail>
                <Detail label="Inhaber">
                  <Value value={site.owner} />
                </Detail>
                <Detail label="Anschrift">
                  {[site.street, site.zip, site.city].some(isMissing) ? (
                    <Missing>unvollständig</Missing>
                  ) : (
                    <>
                      <span className="block">{site.street}</span>
                      <span className="block">
                        {site.zip} {site.city}
                      </span>
                    </>
                  )}
                </Detail>
                <Detail label="Telefon">
                  <Value value={site.phone} />
                </Detail>
                <Detail label="E-Mail">
                  <Value value={site.email} />
                </Detail>
                <Detail label="USt-IdNr.">
                  <Value value={site.vatId} />
                </Detail>
                <Detail label="Register">{site.register.trim() ? site.register : <Missing>keine Angabe</Missing>}</Detail>
              </DetailList>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

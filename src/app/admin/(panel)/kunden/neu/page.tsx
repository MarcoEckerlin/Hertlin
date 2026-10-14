import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyCreate, type CompanyCreateDefaults } from "@/components/admin/companies/company-create-form";
import { firstParam } from "@/components/admin/companies/list-tools";
import { requireAdmin } from "@/lib/auth";
import { INQUIRY_TOPIC_LABELS, WORKPLACE_LABELS, labelOf } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatInquiryNumber } from "@/lib/format";
import { rootDomain } from "@/lib/hosts";

export const metadata: Metadata = { title: "Firmenkunde anlegen" };

/** „89073 Ulm“ → PLZ und Ort; sonst alles als Ort. */
function splitZipCity(value: string | null): { zip?: string; city?: string } {
  const v = value?.trim();
  if (!v) return {};
  const m = v.match(/^(\d{4,5})\s+(.+)$/);
  return m ? { zip: m[1], city: m[2] } : { city: v };
}

export default async function NewCompanyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const inquiryParam = firstParam(sp.anfrage);
  const inquiry = /^\d{1,9}$/.test(inquiryParam)
    ? await db.inquiry.findUnique({
        where: { id: Number(inquiryParam) },
        select: {
          id: true,
          customerType: true,
          name: true,
          companyName: true,
          email: true,
          phone: true,
          zipCity: true,
          topic: true,
          workplaces: true,
          createdAt: true,
          company: { select: { id: true, name: true } },
        },
      })
    : null;

  // Bereits zugeordnete Anfragen werden nicht noch einmal übernommen
  const usable = inquiry && !inquiry.company ? inquiry : null;

  let defaults: CompanyCreateDefaults = {};
  if (usable) {
    const number = formatInquiryNumber(usable.id);
    const noteLines = [
      `Aus Anfrage ${number} vom ${formatDate(usable.createdAt)}: ${labelOf(INQUIRY_TOPIC_LABELS, usable.topic)}.`,
      usable.workplaces ? `Arbeitsplätze laut Anfrage: ${labelOf(WORKPLACE_LABELS, usable.workplaces)}.` : null,
    ].filter(Boolean);
    defaults = {
      name: usable.companyName ?? "",
      ...splitZipCity(usable.zipCity),
      internalNote: noteLines.join("\n"),
      contactName: usable.name,
      contactEmail: usable.email,
      contactPhone: usable.phone ?? "",
      inquiryId: usable.id,
      inquiryNumber: number,
    };
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: "Kunden", href: "/admin/kunden" },
          ...(usable ? [{ label: formatInquiryNumber(usable.id), href: `/admin/anfragen/${usable.id}` }] : []),
          { label: "Firmenkunde anlegen" },
        ]}
        title="Firmenkunde anlegen"
        description="Der Kunde bekommt eine eigene Portal-Adresse. Unterkunden und weitere Benutzer legen Sie danach beim Kunden an – oder der Hauptansprechpartner macht das selbst im Portal."
      />

      <div className="max-w-3xl space-y-5">
        {usable ? (
          <Alert tone="info" title={`Angaben aus Anfrage ${formatInquiryNumber(usable.id)} übernommen`}>
            Bitte prüfen. Nach dem Anlegen wird die Anfrage diesem Kunden zugeordnet und auf „Auftrag erhalten“ gesetzt.
          </Alert>
        ) : null}
        <Card>
          <CardBody className="sm:p-8">
            {/* Stabiler key: Nach dem Anlegen ist die Anfrage zugeordnet (usable = null). Ein neuer key würde das Formular
                neu aufbauen und die Erfolgsmeldung mit Einladungslink verwerfen. Der Hinweis erscheint nur über dem Formular. */}
            <CompanyCreate
              key={inquiryParam || "neu"}
              rootDomain={rootDomain()}
              defaults={defaults}
              notice={
                inquiry?.company ? (
                  <Alert tone="warning" title={`Anfrage ${formatInquiryNumber(inquiry.id)} ist bereits zugeordnet`}>
                    Aus dieser Anfrage wurde schon{" "}
                    <Link href={`/admin/kunden/${inquiry.company.id}`} className="font-semibold underline">
                      {inquiry.company.name}
                    </Link>{" "}
                    angelegt. Das Formular ist deshalb leer.
                  </Alert>
                ) : null
              }
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

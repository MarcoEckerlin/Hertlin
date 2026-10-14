import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Phone } from "lucide-react";
import { Badge, InquiryStatusBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Detail, DetailList, Missing } from "@/components/admin/companies/detail-list";
import { InquiryDeleteForm } from "@/components/admin/inquiries/inquiry-delete-form";
import { InquiryUpdateForm } from "@/components/admin/inquiries/inquiry-update-form";
import { InquiryChatPanel } from "@/components/inquiry-chat/inquiry-chat-panel";
import { requireStaff } from "@/lib/auth";
import {
  CONTACT_PREFERENCE_LABELS,
  CUSTOMER_ROLES,
  INQUIRY_TOPIC_LABELS,
  ROLE_LABELS,
  WORKPLACE_LABELS,
  labelOf,
} from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, formatInquiryNumber, formatTicketNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Anfrage" };

function parseId(raw: string): number | null {
  const m = raw.match(/^(?:A-?)?0*(\d{1,9})$/i);
  return m ? Number(m[1]) : null;
}

/** Erste Zeile der Nachricht als Vorschlag für den Ticket-Betreff (höchstens 80 Zeichen, an Wortgrenze gekürzt). */
function subjectFromMessage(message: string, fallback: string): string {
  const line =
    message
      .trim()
      .split(/\r?\n/)
      .find((l) => l.trim())
      ?.trim() ?? "";
  if (!line) return fallback;
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")} …`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const id = parseId((await params).id);
  if (!id) notFound();

  const inquiry = await db.inquiry.findUnique({
    where: { id },
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
      message: true,
      preferredContact: true,
      status: true,
      internalNote: true,
      createdAt: true,
      updatedAt: true,
      company: { select: { id: true, name: true, active: true, parentId: true } },
    },
  });
  if (!inquiry) notFound();

  const number = formatInquiryNumber(inquiry.id);
  const isBusiness = inquiry.customerType === "BUSINESS";
  const email = inquiry.email.trim().toLowerCase();

  // Ist die Person schon bekannt? (Benutzerkonto, frühere Anfragen, Tickets als Privatkunde)
  const [knownUser, otherInquiries, privateTickets] = await Promise.all([
    db.user.findFirst({
      where: { email, role: { in: [...CUSTOMER_ROLES] } },
      select: {
        id: true,
        name: true,
        role: true,
        active: true,
        company: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      },
    }),
    db.inquiry.findMany({
      where: { email: inquiry.email, id: { not: inquiry.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, status: true, createdAt: true, topic: true },
    }),
    db.ticket.findMany({
      where: { companyId: null, contactEmail: inquiry.email },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, subject: true, status: true },
    }),
  ]);

  const ticketParams = new URLSearchParams({
    kontaktName: inquiry.name,
    kontaktEmail: inquiry.email,
    betreff: subjectFromMessage(inquiry.message, labelOf(INQUIRY_TOPIC_LABELS, inquiry.topic)),
  });
  if (inquiry.phone) ticketParams.set("kontaktTelefon", inquiry.phone);
  if (inquiry.company) ticketParams.set("firma", inquiry.company.id);
  const ticketHref = `/admin/tickets/neu?${ticketParams.toString()}`;

  const canCreateCompany = isAdmin && isBusiness && !inquiry.company;
  const companyHref = inquiry.company ? `/admin/kunden/${inquiry.company.parentId ?? inquiry.company.id}` : null;
  const hasHistory = Boolean(knownUser) || otherInquiries.length > 0 || privateTickets.length > 0;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Anfragen", href: "/admin/anfragen" }, { label: number }]}
        title={<span className="break-words">{inquiry.companyName || inquiry.name}</span>}
        description={labelOf(INQUIRY_TOPIC_LABELS, inquiry.topic)}
        meta={
          <>
            <InquiryStatusBadge status={inquiry.status} />
            <Badge tone={isBusiness ? "blue" : "gray"}>{isBusiness ? "Unternehmen" : "Privatkunde"}</Badge>
            <span className="text-sm text-ink-muted">
              {number} · eingegangen am {formatDateTime(inquiry.createdAt)}
            </span>
          </>
        }
        actions={
          <>
            {canCreateCompany ? (
              <ButtonLink href={`/admin/kunden/neu?anfrage=${inquiry.id}`}>Als Firmenkunde anlegen</ButtonLink>
            ) : null}
            <ButtonLink href={ticketHref} variant="secondary">
              Ticket anlegen
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Chat mit dem Interessenten – die ursprüngliche Nachricht aus dem Formular steht als erster Eintrag darin */}
          <InquiryChatPanel inquiryId={inquiry.id} staffUser={user} />

          <Card>
            <CardHeader
              title="Kontakt"
              actions={
                <>
                  {inquiry.phone ? (
                    <a
                      href={telHref(inquiry.phone)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-700 ring-1 ring-line-strong ring-inset hover:bg-brand-50"
                    >
                      <Phone className="size-4" aria-hidden />
                      Anrufen
                    </a>
                  ) : null}
                  <a
                    href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Ihre Anfrage ${number}`)}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand-700 ring-1 ring-line-strong ring-inset hover:bg-brand-50"
                  >
                    <Mail className="size-4" aria-hidden />
                    E-Mail
                  </a>
                </>
              }
            />
            <CardBody>
              <DetailList>
                <Detail label="Name">{inquiry.name}</Detail>
                {isBusiness ? <Detail label="Firma">{inquiry.companyName || <Missing>nicht angegeben</Missing>}</Detail> : null}
                <Detail label="E-Mail">
                  <a href={`mailto:${inquiry.email}`} className="break-all text-brand-700 hover:underline">
                    {inquiry.email}
                  </a>
                </Detail>
                <Detail label="Telefon">
                  {inquiry.phone ? (
                    <a href={telHref(inquiry.phone)} className="text-brand-700 hover:underline">
                      {inquiry.phone}
                    </a>
                  ) : (
                    <Missing>nicht angegeben</Missing>
                  )}
                </Detail>
                <Detail label="PLZ und Ort">{inquiry.zipCity || <Missing>nicht angegeben</Missing>}</Detail>
                {isBusiness ? (
                  <Detail label="Arbeitsplätze">
                    {inquiry.workplaces ? labelOf(WORKPLACE_LABELS, inquiry.workplaces) : <Missing>nicht angegeben</Missing>}
                  </Detail>
                ) : null}
                <Detail label="Thema">{labelOf(INQUIRY_TOPIC_LABELS, inquiry.topic)}</Detail>
                <Detail label="Rückmeldung gewünscht">{labelOf(CONTACT_PREFERENCE_LABELS, inquiry.preferredContact)}</Detail>
              </DetailList>
            </CardBody>
          </Card>

          {hasHistory ? (
            <Card>
              <CardHeader title="Schon bekannt" description={`Weitere Einträge mit der Adresse ${inquiry.email}`} />
              <CardBody className="space-y-5 text-sm">
                {knownUser?.company ? (
                  <div>
                    <h3 className="font-bold text-ink">Benutzerkonto im Kundenportal</h3>
                    <p className="mt-1 text-ink-soft">
                      {knownUser.name} ist {labelOf(ROLE_LABELS, knownUser.role)} bei{" "}
                      <Link
                        href={`/admin/kunden/${knownUser.company.id}`}
                        className="font-semibold text-brand-700 hover:underline"
                      >
                        {knownUser.company.parent
                          ? `${knownUser.company.parent.name} › ${knownUser.company.name}`
                          : knownUser.company.name}
                      </Link>
                      {knownUser.active ? "." : " (Zugang deaktiviert)."}
                    </p>
                  </div>
                ) : null}
                {otherInquiries.length > 0 ? (
                  <div>
                    <h3 className="font-bold text-ink">Frühere Anfragen</h3>
                    <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                      {otherInquiries.map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                          <span className="min-w-0">
                            <Link href={`/admin/anfragen/${o.id}`} className="font-semibold text-brand-700 hover:underline">
                              {formatInquiryNumber(o.id)}
                            </Link>
                            <span className="text-ink-muted"> · {formatDateTime(o.createdAt)}</span>
                          </span>
                          <InquiryStatusBadge status={o.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {privateTickets.length > 0 ? (
                  <div>
                    <h3 className="font-bold text-ink">Tickets als Privatkunde</h3>
                    <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                      {privateTickets.map((t) => (
                        <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                          <span className="min-w-0">
                            <Link href={`/admin/tickets/${t.id}`} className="font-semibold text-brand-700 hover:underline">
                              {formatTicketNumber(t.id)}
                            </Link>
                            <span className="break-words text-ink-soft"> {t.subject}</span>
                          </span>
                          <StatusBadge status={t.status} audience="staff" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-6">
          {inquiry.company && companyHref ? (
            <Card>
              <CardHeader title="Firmenkunde" />
              <CardBody className="space-y-3 text-sm">
                <p className="text-ink-soft">
                  Aus dieser Anfrage ist der Firmenkunde{" "}
                  <Link href={companyHref} className="font-semibold text-brand-700 hover:underline">
                    {inquiry.company.name}
                  </Link>{" "}
                  entstanden{inquiry.company.active ? "." : " (inzwischen deaktiviert)."}
                </p>
                <ButtonLink href={companyHref} variant="secondary" size="sm">
                  Kunde öffnen
                </ButtonLink>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Bearbeitung" description={`Zuletzt geändert am ${formatDateTime(inquiry.updatedAt)}`} />
            <CardBody>
              <InquiryUpdateForm id={inquiry.id} status={inquiry.status} internalNote={inquiry.internalNote} />
            </CardBody>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader title="Anfrage löschen" />
              <CardBody className="space-y-4">
                <p className="text-sm leading-relaxed text-ink-soft">
                  Die Anfrage enthält personenbezogene Daten. Kommt kein Auftrag zustande, löschen Sie sie, sobald sie nicht mehr
                  gebraucht wird. Gelöscht ist gelöscht – Name, Kontaktdaten, Nachricht und Notiz lassen sich nicht
                  wiederherstellen.
                </p>
                <InquiryDeleteForm id={inquiry.id} number={number} />
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

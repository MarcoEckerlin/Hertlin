import Link from "next/link";
import type { ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import { mainUrl } from "@/lib/hosts";
import { ROLE_LABELS, labelOf } from "@/lib/constants";
import { languageLabel } from "@/lib/languages";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { ResendLinkForm } from "@/components/admin/tickets/resend-link-form";
import type { StaffTicketDetail } from "@/components/admin/tickets/data";

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function isCustomerRole(role: string | null | undefined): boolean {
  return role === "CUSTOMER_ADMIN" || role === "CUSTOMER_USER";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{children}</dd>
    </div>
  );
}

function MailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className="inline-flex max-w-full items-center gap-1.5 text-brand-700 hover:underline">
      <Mail className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{email}</span>
    </a>
  );
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a href={telHref(phone)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-brand-700 hover:underline">
      <Phone className="size-3.5 shrink-0" aria-hidden />
      {phone}
    </a>
  );
}

/** Kunde und Kontaktdaten zum Ticket; bei Privatkunden mit Status-Link. */
export function ContactCard({ ticket }: { ticket: StaffTicketDetail }) {
  const company = ticket.company;
  const rootId = company ? (company.parent?.id ?? company.id) : null;
  const creator = ticket.createdBy && isCustomerRole(ticket.createdBy.role) ? ticket.createdBy : null;
  const staffCreator = ticket.createdBy && !creator ? ticket.createdBy : null;

  // Kontaktangaben am Ticket nur zeigen, wenn sie etwas über den Ersteller hinaus verraten
  const contactName = ticket.contactName && ticket.contactName !== creator?.name ? ticket.contactName : null;
  const contactEmail =
    ticket.contactEmail && ticket.contactEmail.toLowerCase() !== creator?.email.toLowerCase() ? ticket.contactEmail : null;
  const contactPhone = ticket.contactPhone && ticket.contactPhone !== creator?.phone ? ticket.contactPhone : null;
  const contactLanguage = ticket.contactLanguage && ticket.contactLanguage !== "de" ? ticket.contactLanguage : null;
  const hasContact = Boolean(contactName || contactEmail || contactPhone || ticket.contactAddress || contactLanguage);

  const statusLink = !company && ticket.guestToken ? mainUrl(`/status/${ticket.guestToken}`) : null;
  const creatorCompanyLabel =
    creator?.company && creator.company.id !== company?.id
      ? creator.company.parent
        ? `${creator.company.parent.name} › ${creator.company.name}`
        : creator.company.name
      : null;

  return (
    <Card>
      <CardHeader title="Kunde und Kontakt" />
      <CardBody className="space-y-5 text-sm">
        <dl className="space-y-4">
          <Row label="Kunde">
            {company && rootId ? (
              <Link href={`/admin/kunden/${rootId}`} className="font-semibold text-brand-700 hover:underline">
                {company.parent ? `${company.parent.name} › ${company.name}` : company.name}
              </Link>
            ) : (
              <span className="font-semibold">Privatkunde</span>
            )}
            {company && (!company.active || company.parent?.active === false) ? (
              <span className="mt-0.5 block text-xs text-amber-800">Kunde ist deaktiviert</span>
            ) : null}
          </Row>

          {creator ? (
            <Row label={ticket.source === "STAFF" ? "Ansprechpartner" : "Gemeldet von"}>
              <span className="block font-semibold">{creator.name}</span>
              <span className="block text-xs text-ink-muted">
                {[labelOf(ROLE_LABELS, creator.role), creator.position, creatorCompanyLabel].filter(Boolean).join(" · ")}
                {creator.active ? null : " · Zugang deaktiviert"}
              </span>
              <span className="mt-1.5 flex flex-col gap-1">
                <MailLink email={creator.email} />
                {creator.phone ? <PhoneLink phone={creator.phone} /> : null}
              </span>
              {creator.language && creator.language !== "de" ? (
                <span className="mt-1.5 block text-xs text-ink-muted">Bevorzugte Sprache: {languageLabel(creator.language)}</span>
              ) : null}
            </Row>
          ) : null}

          {hasContact ? (
            <Row label={creator ? "Abweichende Kontaktangaben" : "Kontakt"}>
              {contactName ? <span className="block font-semibold">{contactName}</span> : null}
              <span className="mt-1 flex flex-col gap-1">
                {contactEmail ? <MailLink email={contactEmail} /> : null}
                {contactPhone ? <PhoneLink phone={contactPhone} /> : null}
              </span>
              {ticket.contactAddress ? (
                <span className="mt-1.5 block whitespace-pre-line text-ink-soft">{ticket.contactAddress}</span>
              ) : null}
              {contactLanguage ? (
                <span className="mt-1.5 block text-xs text-ink-muted">Bevorzugte Sprache: {languageLabel(contactLanguage)}</span>
              ) : null}
            </Row>
          ) : null}

          {!creator && !hasContact ? (
            <Row label="Kontakt">
              <span className="text-ink-muted">Keine Kontaktdaten hinterlegt.</span>
            </Row>
          ) : null}

          {staffCreator ? <Row label="Erfasst von">{staffCreator.name} (Hertlin)</Row> : null}
        </dl>

        {statusLink ? (
          <div className="space-y-2.5 border-t border-line pt-4">
            <p className="text-xs font-semibold text-ink-muted">Status-Link des Kunden</p>
            <p className="truncate rounded-lg bg-mist px-3 py-2 font-mono text-xs text-ink-soft ring-1 ring-line ring-inset" title={statusLink}>
              {statusLink}
            </p>
            <div className="flex flex-wrap items-start gap-2">
              <CopyButton value={statusLink} label="Link kopieren" />
              {ticket.contactEmail ? <ResendLinkForm ticketId={ticket.id} /> : null}
            </div>
            <p className="text-xs text-ink-muted">Wer den Link kennt, kann das Ticket lesen und antworten. Nur an den Kunden geben.</p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

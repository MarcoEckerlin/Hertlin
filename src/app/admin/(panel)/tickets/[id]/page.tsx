import type { Metadata } from "next";
import Link from "next/link";
import { cache, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { UserCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getStaffUser, requireStaff } from "@/lib/auth";
import { CATEGORY_LABELS, SOURCE_LABELS, TYPE_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatMoney, formatRelative, formatTicketNumber } from "@/lib/format";
import { customerRecipient } from "@/lib/tickets";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { isLangCode, languageLabel } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { translateForViewer } from "@/lib/chat-translation";
import { takeTicketAction } from "@/lib/actions/admin-tickets";
import { Alert } from "@/components/ui/alert";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { LiveConversation } from "@/components/realtime/live-conversation";
import {
  customerLabel,
  loadCustomerGroups,
  loadStaffOptions,
  loadTicketCosts,
  parseTicketIdParam,
  staffTicketDetailSelect,
  type StaffTicketDetail,
} from "@/components/admin/tickets/data";
import { PRIVATE_CUSTOMER } from "@/components/admin/tickets/filters";
import { ContactCard } from "@/components/admin/tickets/contact-card";
import { LinkedCallsCard } from "@/components/admin/tickets/linked-calls-card";
import { StaffReplyForm } from "@/components/admin/tickets/staff-reply-form";
import { StaffTimeline, type TimelineTranslations } from "@/components/admin/tickets/staff-timeline";
import { TicketMetaForm, type MetaCompanyGroup } from "@/components/admin/tickets/ticket-meta-form";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const loadTicket = cache(
  async (id: number): Promise<StaffTicketDetail | null> =>
    db.ticket.findUnique({ where: { id }, select: staffTicketDetailSelect }),
);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const staff = await getStaffUser();
  const { id } = await params;
  const ticketId = parseTicketIdParam(id);
  const ticket = staff && ticketId ? await loadTicket(ticketId) : null;
  if (!ticket) return { title: "Ticket" };
  return { title: `${formatTicketNumber(ticket.id)} ${ticket.subject}` };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isCustomerRole(role: string | null | undefined): boolean {
  return role === "CUSTOMER_ADMIN" || role === "CUSTOMER_USER";
}

export default async function AdminTicketPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const user = await requireStaff();
  const { id } = await params;
  const query = await searchParams;

  const ticketId = parseTicketIdParam(id);
  if (!ticketId) notFound();
  // Abgetippte Anzeigeform („T-00042“) auf die richtige Adresse umleiten
  if (id !== String(ticketId)) redirect(`/admin/tickets/${ticketId}`);

  const ticket = await loadTicket(ticketId);
  if (!ticket) notFound();

  // Kosten ausschließlich für Administratoren laden – die Kostenkomponente wird für Techniker gar nicht erst importiert
  const showCosts = user.role === "ADMIN";
  const translate = translationEnabled();
  const viewerLang = isLangCode(user.language) ? user.language : "de";
  const customerItems = ticket.messages.filter((m) => !m.fromStaff && !m.internal).map((m) => ({ id: m.id, body: m.body }));

  const [staff, customerGroups, recipient, costs, costModule, translations] = await Promise.all([
    loadStaffOptions({ includeId: ticket.assigneeId }),
    loadCustomerGroups({ activeOnly: true, withUsers: false }),
    customerRecipient(ticket.id),
    showCosts ? loadTicketCosts(ticket.id) : Promise.resolve(null),
    showCosts ? import("@/components/admin/tickets/cost-section") : Promise.resolve(null),
    // Kundennachrichten in die Sprache des Mitarbeiters; ohne Dienst oder bei Fehlern bleibt es beim Original
    translate && customerItems.length > 0
      ? translateForViewer(customerItems, viewerLang).catch((error: unknown): TimelineTranslations => {
          console.error("[verwaltung] Übersetzung im Ticket fehlgeschlagen:", error instanceof Error ? error.message : error);
          return {};
        })
      : Promise.resolve<TimelineTranslations>({}),
  ]);
  const CostSection = costModule?.CostSection ?? null;

  const number = formatTicketNumber(ticket.id);
  const company = ticket.company;
  const rootId = company ? (company.parent?.id ?? company.id) : null;

  /* ---------- Zuordnung: welche Firmen kommen in Frage? ---------- */
  let companyGroups: MetaCompanyGroup[] = customerGroups.map((root) => ({
    id: root.id,
    name: root.name,
    companies: [
      { id: root.id, name: root.name, isRoot: true },
      ...root.children.map((child) => ({ id: child.id, name: child.name, isRoot: false })),
    ],
  }));
  let customerHint: string | undefined;
  const creator = ticket.createdBy && isCustomerRole(ticket.createdBy.role) ? ticket.createdBy : null;
  if (creator?.company) {
    // Wer im Portal gemeldet hat, muss das Ticket weiterhin sehen können
    const own = creator.company;
    const allowed = new Set<string>([own.id]);
    if (creator.role === "CUSTOMER_ADMIN" && !own.parent) {
      for (const g of customerGroups) if (g.id === own.id) for (const c of g.children) allowed.add(c.id);
    }
    companyGroups = companyGroups
      .map((g) => ({ ...g, companies: g.companies.filter((c) => allowed.has(c.id)) }))
      .filter((g) => g.companies.length > 0);
    customerHint =
      allowed.size > 1
        ? `${creator.name} sieht das Ticket im Kundenportal. Umhängen ist deshalb nur innerhalb dieses Firmenkunden möglich.`
        : `${creator.name} sieht das Ticket im Kundenportal. Die Zuordnung bleibt deshalb bei dieser Firma.`;
  }
  // Aktuelle (evtl. inzwischen deaktivierte) Firma immer auswählbar lassen
  if (company && !companyGroups.some((g) => g.companies.some((c) => c.id === company.id))) {
    companyGroups = [
      {
        id: `aktuell-${company.id}`,
        name: "Aktuelle Zuordnung",
        companies: [{ id: company.id, name: `${customerLabel(ticket)} (deaktiviert)`, isRoot: true }],
      },
      ...companyGroups,
    ];
  }

  // Sprache, in der der Kunde unsere Antworten liest: Konto des Erstellers, sonst Angabe im Ticket (Privatkunden)
  const readerLanguage = creator ? creator.language : ticket.contactLanguage;
  const customerLanguage =
    translate && isLangCode(readerLanguage) && readerLanguage !== "de" ? languageLabel(readerLanguage) : null;

  const isNew = first(query.neu) === "1";
  const mail = first(query.mail);
  const costTotal = costs ? costs.reduce((sum, c) => sum + c.totalCents, 0) : 0;
  const assignedToMe = ticket.assigneeId === user.id;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Übersicht", href: "/admin" },
          { label: "Tickets", href: "/admin/tickets" },
          { label: number },
        ]}
        title={<span className="break-words">{ticket.subject}</span>}
        meta={
          <>
            <span className="text-sm font-semibold text-ink-muted tabular-nums">{number}</span>
            <StatusBadge status={ticket.status} audience="staff" />
            <PriorityBadge priority={ticket.priority} />
            <Badge tone="gray">{labelOf(TYPE_LABELS, ticket.type)}</Badge>
            <span className="text-sm text-ink-muted">{labelOf(CATEGORY_LABELS, ticket.category)}</span>
          </>
        }
        actions={
          <>
            {costs ? (
              <a href="#kosten" className={buttonClasses("ghost", "sm")}>
                Kosten: {formatMoney(costTotal)}
              </a>
            ) : null}
            {!assignedToMe ? (
              <form action={takeTicketAction.bind(null, ticket.id)}>
                <SubmitButton variant="secondary" size="sm" pendingText="Einen Moment …">
                  <UserCheck className="size-4" aria-hidden />
                  {ticket.assignee ? "Selbst übernehmen" : "Übernehmen"}
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
        description={
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span>
              {company && rootId ? (
                <Link href={`/admin/kunden/${rootId}`} className="font-semibold text-brand-700 hover:underline">
                  {customerLabel(ticket)}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{customerLabel(ticket)}</span>
              )}
            </span>
            <span aria-hidden>·</span>
            <span>{labelOf(SOURCE_LABELS, ticket.source)}</span>
            <span aria-hidden>·</span>
            <span>erstellt {formatDateTime(ticket.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>
              aktualisiert{" "}
              <time dateTime={ticket.updatedAt.toISOString()} title={formatDateTime(ticket.updatedAt)}>
                {formatRelative(ticket.updatedAt)}
              </time>
            </span>
          </span>
        }
      />

      {isNew ? (
        <Alert tone="success" title={`Ticket ${number} ist angelegt`} className="mb-6">
          {mail === "1"
            ? "Der Kunde wird per E-Mail informiert."
            : mail === "0"
              ? "Eine E-Mail an den Kunden war nicht möglich, weil keine Adresse hinterlegt ist."
              : "Der Kunde wurde nicht per E-Mail informiert."}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="verlauf-titel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 id="verlauf-titel" className="text-lg font-bold text-ink">
                Verlauf
              </h2>
              <LiveConversation spec={{ t: "sub", ch: "ticket", id: ticket.id }} audience="staff" selfName={user.name} />
            </div>
            {ticket.messages.length > 0 || ticket.events.length > 0 ? (
              <StaffTimeline
                messages={ticket.messages}
                events={ticket.events}
                customerName={ticket.contactName ?? creator?.name ?? null}
                currentUserId={user.id}
                translations={translations}
              />
            ) : (
              <p className="rounded-2xl border border-dashed border-line-strong bg-white px-5 py-8 text-center text-sm text-ink-soft">
                Zu diesem Ticket gibt es noch keine Nachrichten.
              </p>
            )}
          </section>

          <StaffReplyForm
            ticketId={ticket.id}
            status={ticket.status}
            recipient={recipient ? { name: recipient.name, email: recipient.email } : null}
            customerChannel={company ? "im Kundenportal" : "über seinen Status-Link"}
            customerLanguage={customerLanguage}
            uploadRules={{
              accept: ACCEPT_ATTRIBUTE,
              maxFiles: MAX_FILES,
              maxFileSize: MAX_FILE_SIZE,
              allowedLabel: ALLOWED_EXTENSIONS_LABEL,
            }}
          />

          {costs && CostSection ? <CostSection ticketId={ticket.id} costs={costs} flash={first(query.kosten)} /> : null}
        </div>

        <aside aria-label="Bearbeitung und Kontakt" className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Bearbeitung" />
            <CardBody>
              <TicketMetaForm
                ticketId={ticket.id}
                current={{
                  status: ticket.status,
                  priority: ticket.priority,
                  type: ticket.type,
                  category: ticket.category,
                  assigneeId: ticket.assigneeId ?? "",
                  customer: ticket.companyId ?? PRIVATE_CUSTOMER,
                }}
                staff={staff.map((s) => ({ id: s.id, name: s.name, active: s.active }))}
                companyGroups={companyGroups}
                allowPrivate={ticket.companyId === null || Boolean(ticket.guestToken)}
                customerHint={customerHint}
                recipientEmail={recipient?.email ?? null}
              />
            </CardBody>
          </Card>

          <ContactCard ticket={ticket} />

          <LinkedCallsCard calls={ticket.phoneCalls} />

          <Card>
            <CardHeader title="Zeitpunkte" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm lg:grid-cols-1">
                <Detail label="Erstellt">{formatDateTime(ticket.createdAt)}</Detail>
                <Detail label="Letzte Änderung">{formatDateTime(ticket.updatedAt)}</Detail>
                {ticket.resolvedAt ? <Detail label="Gelöst">{formatDateTime(ticket.resolvedAt)}</Detail> : null}
                {ticket.closedAt ? <Detail label="Geschlossen">{formatDateTime(ticket.closedAt)}</Detail> : null}
                <Detail label="Quelle">{labelOf(SOURCE_LABELS, ticket.source)}</Detail>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{children}</dd>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getStaffUser, requireStaff } from "@/lib/auth";
import { CATEGORY_LABELS, SOURCE_LABELS, TYPE_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatMoney, formatRelative, formatTicketNumber, toDateInput } from "@/lib/format";
import { canRecordCosts, canSeeCostAmounts } from "@/lib/permissions";
import { locationOptions } from "@/lib/locations";
import { customerRecipient } from "@/lib/tickets";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { isLangCode, languageLabel } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { translateForViewer } from "@/lib/chat-translation";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FlashToast } from "@/components/ui/toaster";
import { LiveConversation } from "@/components/realtime/live-conversation";
import {
  customerLabel,
  loadCustomerGroups,
  loadPresetOptions,
  loadStaffOptions,
  loadTicketCosts,
  loadTicketCostsForStaff,
  parseTicketIdParam,
  staffTicketDetailSelect,
  type StaffTicketDetail,
} from "@/components/admin/tickets/data";
import { CostSection } from "@/components/admin/tickets/cost-section";
import { PRIVATE_CUSTOMER } from "@/components/admin/tickets/filters";
import { ContactCard } from "@/components/admin/tickets/contact-card";
import { LinkedCallsCard } from "@/components/admin/tickets/linked-calls-card";
import { StaffReplyForm } from "@/components/admin/tickets/staff-reply-form";
import { StaffTimeline, type TimelineTranslations } from "@/components/admin/tickets/staff-timeline";
import { TicketMetaForm, type MetaCompanyGroup } from "@/components/admin/tickets/ticket-meta-form";
import { TicketQuickBar } from "@/components/admin/tickets/ticket-quick-bar";

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

  // Leistungen und Material erfassen alle Mitarbeiter; Beträge werden nur für Administratoren geladen
  const recordCosts = canRecordCosts(user.role);
  const showAmounts = canSeeCostAmounts(user.role);
  const translate = translationEnabled();
  const viewerLang = isLangCode(user.language) ? user.language : "de";
  const customerItems = ticket.messages.filter((m) => !m.fromStaff && !m.internal).map((m) => ({ id: m.id, body: m.body }));

  const [staff, customerGroups, recipient, adminCosts, staffCosts, presets, locations, translations] = await Promise.all([
    loadStaffOptions({ includeId: ticket.assigneeId }),
    loadCustomerGroups({ activeOnly: true, withUsers: false }),
    customerRecipient(ticket.id),
    showAmounts ? loadTicketCosts(ticket.id) : Promise.resolve(null),
    recordCosts && !showAmounts ? loadTicketCostsForStaff(ticket.id) : Promise.resolve(null),
    recordCosts ? loadPresetOptions({ withPrices: showAmounts }) : Promise.resolve([]),
    locationOptions(),
    // Kundennachrichten in die Sprache des Mitarbeiters; ohne Dienst oder bei Fehlern bleibt es beim Original
    translate && customerItems.length > 0
      ? translateForViewer(customerItems, viewerLang).catch((error: unknown): TimelineTranslations => {
          console.error("[verwaltung] Übersetzung im Ticket fehlgeschlagen:", error instanceof Error ? error.message : error);
          return {};
        })
      : Promise.resolve<TimelineTranslations>({}),
  ]);
  // Aktuellen (inzwischen deaktivierten) Standort weiter anzeigen, damit Speichern ihn nicht stillschweigend entfernt
  const locationChoices =
    ticket.location && !locations.some((l) => l.value === ticket.location?.id)
      ? [...locations, { value: ticket.location.id, label: `${ticket.location.name} (deaktiviert)` }]
      : locations;

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

  const mail = first(query.mail);
  const costTotal = adminCosts ? adminCosts.filter((c) => !c.needsPrice).reduce((sum, c) => sum + c.totalCents, 0) : 0;
  const costMissingPrice = adminCosts ? adminCosts.filter((c) => c.needsPrice && !c.invoiceId).length : 0;
  const costCount = adminCosts?.length ?? staffCosts?.length ?? 0;
  const staffChoices = staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, active: s.active }));
  const createdNote =
    mail === "1"
      ? "Der Kunde wird per E-Mail informiert."
      : mail === "0"
        ? "Eine E-Mail an den Kunden war nicht möglich, weil keine Adresse hinterlegt ist."
        : "Der Kunde wurde nicht per E-Mail informiert.";

  return (
    <>
      {/* Rückmeldung nach „Ticket anlegen“; beide Parameter verschwinden danach aus der Adresse */}
      <FlashToast param="neu" value={first(query.neu)} messages={{ "1": `Ticket ${number} ist angelegt. ${createdNote}` }} />
      <FlashToast param="mail" value={mail} messages={{}} />

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
        description={
          <span className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
            <span>
              {company && rootId ? (
                <Link href={`/admin/kunden/${rootId}`} className="font-semibold text-brand-700 hover:underline">
                  {customerLabel(ticket)}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{customerLabel(ticket)}</span>
              )}
            </span>
            {ticket.location ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="sr-only">Standort: </span>
                    {ticket.location.name}
                    {ticket.location.active ? "" : " (deaktiviert)"}
                  </span>
                </span>
              </>
            ) : null}
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
            {ticket.closedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>geschlossen {formatDateTime(ticket.closedAt)}</span>
              </>
            ) : ticket.resolvedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>gelöst {formatDateTime(ticket.resolvedAt)}</span>
              </>
            ) : null}
          </span>
        }
      />

      <TicketQuickBar
        ticketId={ticket.id}
        current={{ status: ticket.status, assigneeId: ticket.assigneeId ?? "" }}
        staff={staff.map((s) => ({ id: s.id, name: s.name, active: s.active }))}
        currentUserId={user.id}
        recipientEmail={recipient?.email ?? null}
        costLink={
          adminCosts && adminCosts.length > 0
            ? { label: `Kosten ${formatMoney(costTotal)}`, warning: costMissingPrice > 0 ? "Preis fehlt" : undefined }
            : recordCosts
              ? { label: costCount > 0 ? `Leistungen (${costCount})` : "Leistungen" }
              : null
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="verlauf-titel" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
              <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-8 text-center text-sm text-ink-soft">
                Zu diesem Ticket gibt es noch keine Nachrichten.
              </p>
            )}

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
          </section>

          {adminCosts ? (
            <CostSection
              amounts
              costs={adminCosts}
              ticketId={ticket.id}
              viewer={{ id: user.id, role: user.role }}
              presets={presets}
              staff={staffChoices}
              today={toDateInput()}
              flash={first(query.kosten)}
            />
          ) : staffCosts ? (
            <CostSection
              amounts={false}
              costs={staffCosts}
              ticketId={ticket.id}
              viewer={{ id: user.id, role: user.role }}
              presets={presets}
              staff={staffChoices}
              today={toDateInput()}
              flash={first(query.kosten)}
            />
          ) : null}
        </div>

        <aside aria-label="Bearbeitung und Kontakt" className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <TicketMetaForm
                ticketId={ticket.id}
                current={{
                  priority: ticket.priority,
                  type: ticket.type,
                  category: ticket.category,
                  customer: ticket.companyId ?? PRIVATE_CUSTOMER,
                  locationId: ticket.locationId ?? "",
                }}
                locations={locationChoices}
                companyGroups={companyGroups}
                allowPrivate={ticket.companyId === null || Boolean(ticket.guestToken)}
                customerHint={customerHint}
              />
            </CardBody>
          </Card>

          <ContactCard ticket={ticket} />

          <LinkedCallsCard calls={ticket.phoneCalls} />
        </aside>
      </div>
    </>
  );
}

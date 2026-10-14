import type { Metadata } from "next";
import Link from "next/link";
import { cache, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPortalContext, requirePortalContext } from "@/lib/auth";
import { portalTicketWhere } from "@/lib/permissions";
import { CATEGORY_LABELS, TYPE_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatRelative, formatTicketNumber } from "@/lib/format";
import { canCustomerReply } from "@/lib/tickets";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { getSiteSettings } from "@/lib/settings";
import { languageLabel } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { Alert } from "@/components/ui/alert";
import { Badge, PriorityBadge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LiveConversation } from "@/components/realtime/live-conversation";
import {
  parseTicketParam,
  portalMessageTranslations,
  portalTicketDetailSelect,
  viewerLanguage,
  type PortalTicketDetail,
} from "@/components/portal/portal-data";
import { LiveTimeline } from "@/components/portal/live-timeline";
import { ReplyForm } from "@/components/portal/reply-form";
import { TicketStatusActions } from "@/components/portal/ticket-status-actions";
import { TicketTimeline, timelineTail } from "@/components/portal/ticket-timeline";

type Params = Promise<{ slug: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Ticket im Sichtbereich des angemeldeten Portalbenutzers (pro Anfrage zwischengespeichert). */
const loadTicket = cache(async (id: number): Promise<PortalTicketDetail | null> => {
  const ctx = await getPortalContext();
  if (!ctx) return null;
  return db.ticket.findFirst({ where: { AND: [{ id }, portalTicketWhere(ctx)] }, select: portalTicketDetailSelect });
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const ticketId = parseTicketParam(id);
  const ticket = ticketId ? await loadTicket(ticketId) : null;
  if (!ticket) return { title: "Ticket nicht gefunden" };
  return { title: `${formatTicketNumber(ticket.id)} ${ticket.subject}` };
}

export default async function PortalTicketPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const ctx = await requirePortalContext();
  const { id } = await params;
  const query = await searchParams;

  const ticketId = parseTicketParam(id);
  if (!ticketId) notFound();
  // Abgetippte Anzeigeform („T-00042“) auf die richtige Adresse umleiten
  if (id !== String(ticketId)) redirect(`/tickets/${ticketId}`);

  const ticket = await loadTicket(ticketId);
  if (!ticket) notFound();

  // Nachrichten in der Sprache des Lesers (Profil → „Sprache für Nachrichten“)
  const lang = viewerLanguage(ctx.user.language);
  const translating = lang !== "de" && translationEnabled();
  const [site, translations] = await Promise.all([
    getSiteSettings(),
    portalMessageTranslations(ticket.messages, { id: ctx.user.id, language: lang }),
  ]);
  const tail = timelineTail(ticket.messages, ticket.events, ctx.user.id, ticket.contactName);
  const number = formatTicketNumber(ticket.id);
  const canReply = canCustomerReply(ticket.status);
  const isNew = query.neu === "1" && ticket.messages.filter((m) => !m.fromStaff).length <= 1;
  const hinweis = typeof query.hinweis === "string" ? query.hinweis : undefined;
  const justResolved = hinweis === "geloest" && ticket.status === "RESOLVED";
  const creator = ticket.createdBy?.name ?? ticket.contactName;
  const company = ticket.company;
  const showCompany = ctx.scopeCompanyIds.length > 1 || (company !== null && company.id !== ctx.company.id);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Übersicht", href: "/" },
          { label: "Tickets", href: "/tickets" },
          { label: number },
        ]}
        title={<span className="break-words">{ticket.subject}</span>}
        meta={
          <>
            <span className="text-sm font-semibold text-ink-muted tabular-nums">{number}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <Badge tone="gray">{labelOf(TYPE_LABELS, ticket.type)}</Badge>
          </>
        }
        actions={<TicketStatusActions ticketId={ticket.id} status={ticket.status} />}
      />

      <div className="space-y-4">
        {isNew ? (
          <Alert tone="success" title="Ihr Ticket ist angelegt">
            Die Nummer lautet {number}. Eine Bestätigung ist unterwegs
            {ticket.contactEmail ? ` an ${ticket.contactEmail}` : null}. Sobald wir antworten, bekommen Sie eine E-Mail –
            und hier sehen Sie jederzeit den Stand.
          </Alert>
        ) : null}
        {justResolved ? (
          <Alert tone="success" title="Danke für die Rückmeldung">
            Das Ticket ist als gelöst markiert. Sollte das Problem wieder auftauchen, öffnen Sie es oben einfach wieder.
          </Alert>
        ) : null}
        {hinweis === "wieder-offen" && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" ? (
          <Alert tone="info" title="Das Ticket ist wieder offen">
            Schreiben Sie uns bitte kurz, was noch nicht funktioniert – dann wissen wir, wo wir weitermachen.{" "}
            <a href="#antworten" className="font-semibold underline underline-offset-2">
              Zur Nachricht
            </a>
          </Alert>
        ) : null}
        {hinweis === "fehler" ? (
          <Alert tone="error">
            Der Status konnte gerade nicht geändert werden. Bitte versuchen Sie es noch einmal oder rufen Sie uns an:{" "}
            {site.phone}.
          </Alert>
        ) : null}
        {justResolved ? null : <StatusNotice ticket={ticket} currentUserId={ctx.user.id} />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="verlauf-titel">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="verlauf-titel" className="text-lg font-bold text-ink">
                Verlauf
              </h2>
              {translating ? (
                <p className="text-sm text-ink-muted">
                  Antworten von Hertlin auf {languageLabel(lang)} ·{" "}
                  <Link href="/profil#sprache" className="font-semibold text-brand-700 hover:underline">
                    Sprache ändern
                  </Link>
                </p>
              ) : null}
            </div>
            <LiveTimeline lastKey={tail.key} lastFromSelf={tail.fromSelf} announcement={tail.announcement}>
              {ticket.messages.length > 0 || ticket.events.length > 0 ? (
                <TicketTimeline
                  messages={ticket.messages}
                  events={ticket.events}
                  currentUserId={ctx.user.id}
                  fallbackAuthor={ticket.contactName}
                  translations={translations}
                />
              ) : (
                <p className="rounded-2xl border border-dashed border-line-strong bg-white px-5 py-8 text-center text-sm text-ink-soft">
                  Zu diesem Ticket gibt es noch keine Nachrichten.
                </p>
              )}
            </LiveTimeline>
            {/* Live-Leiste direkt unter der letzten Nachricht: dort, wo Neues erscheint */}
            <LiveConversation
              spec={{ t: "sub", ch: "ticket", id: ticket.id }}
              audience="customer"
              selfName={ctx.user.name}
              className="mt-4 min-h-5 px-1"
            />
          </section>

          <section id="antworten" aria-labelledby="antworten-titel" className="scroll-mt-24">
            {canReply ? (
              <Card>
                <CardHeader
                  title={
                    <span id="antworten-titel">
                      {ticket.status === "WAITING_CUSTOMER"
                        ? "Rückfrage beantworten"
                        : ticket.status === "RESOLVED"
                          ? "Doch noch nicht gelöst?"
                          : "Nachricht schreiben"}
                    </span>
                  }
                  description={
                    translating
                      ? `Ihre Nachricht landet direkt im Ticket. Schreiben Sie gern auf ${languageLabel(lang)} – wir lesen sie automatisch übersetzt.`
                      : "Ihre Nachricht landet direkt im Ticket. Screenshots und Dateien können Sie gleich mitschicken."
                  }
                />
                <CardBody>
                  <ReplyForm
                    ticketId={ticket.id}
                    status={ticket.status}
                    uploadRules={{
                      accept: ACCEPT_ATTRIBUTE,
                      maxFiles: MAX_FILES,
                      maxFileSize: MAX_FILE_SIZE,
                      allowedLabel: ALLOWED_EXTENSIONS_LABEL,
                    }}
                  />
                </CardBody>
              </Card>
            ) : (
              <div className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
                <h2 id="antworten-titel" className="font-bold text-ink">
                  Dieses Ticket ist geschlossen
                </h2>
                <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">
                  Antworten sind hier nicht mehr möglich. Taucht das Problem wieder auf oder gibt es etwas Neues, legen Sie
                  bitte ein neues Ticket an – gern mit Verweis auf {number}.
                </p>
                <div className="mt-4">
                  <ButtonLink href="/tickets/neu" variant="secondary" size="sm">
                    Neues Ticket
                  </ButtonLink>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside aria-label="Angaben zum Ticket">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm lg:grid-cols-1">
                <Detail label="Status">
                  <StatusBadge status={ticket.status} />
                </Detail>
                <Detail label="Priorität">
                  <PriorityBadge priority={ticket.priority} />
                </Detail>
                <Detail label="Art">{labelOf(TYPE_LABELS, ticket.type)}</Detail>
                <Detail label="Bereich">{labelOf(CATEGORY_LABELS, ticket.category)}</Detail>
                {showCompany && company ? (
                  <Detail label="Firma">
                    {company.name}
                    {company.parentId ? <span className="block text-xs text-ink-muted">Unterkunde</span> : null}
                  </Detail>
                ) : null}
                <Detail label="Gemeldet von">
                  {creator ? (ticket.createdById === ctx.user.id ? `${creator} (Sie)` : creator) : "–"}
                </Detail>
                {ticket.contactPhone ? (
                  <Detail label="Rückrufnummer">
                    <a href={`tel:${ticket.contactPhone.replace(/[^\d+]/g, "")}`} className="text-brand-700 hover:underline">
                      {ticket.contactPhone}
                    </a>
                  </Detail>
                ) : null}
                <Detail label="Erstellt">{formatDateTime(ticket.createdAt)}</Detail>
                <Detail label="Letzte Änderung">
                  <time dateTime={ticket.updatedAt.toISOString()} title={formatDateTime(ticket.updatedAt)}>
                    {formatRelative(ticket.updatedAt)}
                  </time>
                </Detail>
                <Detail label="Bearbeitet von">{ticket.assignee?.name ?? "wird noch zugeteilt"}</Detail>
              </dl>
            </CardBody>
          </Card>
          <p className="mt-4 px-1 text-sm leading-relaxed text-ink-muted">
            Lieber telefonieren? Unter{" "}
            <a href={`tel:${site.phoneHref}`} className="font-semibold whitespace-nowrap text-brand-700 hover:underline">
              {site.phone}
            </a>{" "}
            erreichen Sie uns – nennen Sie dabei bitte die Nummer {number}.
          </p>
          <p className="mt-2 px-1 text-sm">
            <Link href="/tickets" className="font-semibold text-brand-700 hover:underline">
              Zurück zur Ticketliste
            </Link>
          </p>
        </aside>
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1 break-words text-ink">{children}</dd>
    </div>
  );
}

/** Kurze Erklärung, was der aktuelle Status für den Kunden bedeutet. */
function StatusNotice({ ticket, currentUserId }: { ticket: PortalTicketDetail; currentUserId: string }) {
  switch (ticket.status) {
    case "WAITING_CUSTOMER":
      return (
        <Alert tone="warning" title="Wir haben eine Rückfrage an Sie">
          Die Frage steht unten im Verlauf. Sobald Sie geantwortet haben, machen wir weiter.{" "}
          <a href="#antworten" className="font-semibold underline underline-offset-2">
            Jetzt antworten
          </a>
        </Alert>
      );
    case "RESOLVED": {
      // Wer hat das Ticket als gelöst markiert – Hertlin oder jemand auf Kundenseite?
      const resolvedEvent = ticket.events.findLast((e) => e.toValue === "RESOLVED");
      const byStaff = resolvedEvent?.actor ? resolvedEvent.actor.role === "ADMIN" || resolvedEvent.actor.role === "TECHNICIAN" : true;
      const who =
        byStaff || !resolvedEvent?.actor
          ? null
          : resolvedEvent.actorId === currentUserId
            ? "von Ihnen"
            : `von ${resolvedEvent.actor.name}`;
      return (
        <Alert tone="success" title={byStaff ? "Aus unserer Sicht erledigt" : `Als gelöst markiert${who ? ` ${who}` : ""}`}>
          {ticket.resolvedAt ? `Gelöst am ${formatDateTime(ticket.resolvedAt)}. ` : null}
          Falls doch noch etwas nicht funktioniert, schreiben Sie uns unten oder öffnen Sie das Ticket wieder.
        </Alert>
      );
    }
    case "CLOSED":
      return (
        <Alert tone="info" title="Dieses Ticket ist abgeschlossen">
          {ticket.closedAt ? `Geschlossen am ${formatDateTime(ticket.closedAt)}. ` : null}
          Den Verlauf können Sie hier weiterhin nachlesen.
        </Alert>
      );
    default:
      return null;
  }
}

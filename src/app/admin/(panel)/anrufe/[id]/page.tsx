import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { CallDirection, CallStatusBadge, TestCallBadge } from "@/components/admin/calls/call-badges";
import { CallNoteForm } from "@/components/admin/calls/call-note-form";
import { CallsLiveRefresh } from "@/components/admin/calls/calls-live-refresh";
import { CreateTicketFromCallForm } from "@/components/admin/calls/create-ticket-form";
import { LinkTicketForm } from "@/components/admin/calls/link-ticket-form";
import { PRIVATE_CUSTOMER, type CustomerGroup, type TicketFormDefaults } from "@/components/admin/calls/types";
import {
  createTicketFromCallAction,
  linkCallToSuggestedTicketAction,
  linkCallToTicketAction,
  saveCallNoteAction,
  setCallHandledAction,
  unlinkCallTicketAction,
} from "@/lib/actions/admin-calls";
import { requireStaff } from "@/lib/auth";
import { CUSTOMER_ROLES, OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatInquiryNumber, formatTicketNumber } from "@/lib/format";
import {
  CALL_PROVIDER_LABELS,
  counterpartNumber,
  formatCallDateTime,
  formatCallDuration,
  formatCallTime,
  formatPhoneDisplay,
  hangupCauseLabel,
  normalizePhone,
  phoneHref,
  type CallProvider,
} from "@/lib/phone";
import { companyPath, describeCall, isAmbiguousCaller, matchCaller, storedCallerLabel } from "@/lib/telephony";

export const metadata: Metadata = { title: "Anruf" };

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium break-words text-ink">{children}</dd>
    </div>
  );
}

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;

  const call = await db.phoneCall.findUnique({
    where: { id },
    select: {
      id: true,
      provider: true,
      direction: true,
      status: true,
      fromNumber: true,
      toNumber: true,
      answeredBy: true,
      hangupCause: true,
      callerLabel: true,
      startedAt: true,
      answeredAt: true,
      endedAt: true,
      handledAt: true,
      note: true,
      ticketId: true,
      companyId: true,
      userId: true,
      company: { select: { id: true, name: true, parentId: true, parent: { select: { id: true, name: true } } } },
      user: { select: { id: true, name: true, email: true, phone: true, position: true } },
      handledBy: { select: { name: true } },
      ticket: { select: { id: true, subject: true, status: true, priority: true } },
    },
  });
  if (!call) notFound();

  const now = new Date();
  const number = counterpartNumber(call);
  const normalized = normalizePhone(number);
  const tel = phoneHref(number);
  // Für Links und Vorschläge: Anrufer (erneut) suchen
  const match = await matchCaller(number);
  const title = call.callerLabel ?? storedCallerLabel(match) ?? formatPhoneDisplay(number);
  const duration = formatCallDuration(call.answeredAt, call.endedAt);
  const cause = hangupCauseLabel(call.hangupCause);
  const isOut = call.direction === "OUT";

  const [history, suggestions, customers] = await Promise.all([
    normalized
      ? db.phoneCall.findMany({
          where: {
            id: { not: call.id },
            OR: [
              { direction: "IN", fromNumber: normalized },
              { direction: "OUT", toNumber: normalized },
            ],
          },
          orderBy: { startedAt: "desc" },
          take: 8,
          select: {
            id: true,
            direction: true,
            status: true,
            startedAt: true,
            answeredAt: true,
            answeredBy: true,
            handledAt: true,
            ticket: { select: { id: true } },
          },
        })
      : [],
    call.ticketId
      ? []
      : db.ticket.findMany({
          where: {
            status: { in: [...OPEN_STATUSES] },
            OR: [
              ...(call.companyId ? [{ companyId: call.companyId }] : []),
              ...(!call.companyId && match?.companyId ? [{ companyId: match.companyId }] : []),
              ...(match?.ticketId ? [{ id: match.ticketId }] : []),
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, subject: true, status: true },
        }),
    call.ticketId ? Promise.resolve([]) : loadCustomers(),
  ]);

  // Vorbelegung für „Ticket aus Anruf“
  const defaultCompanyId = call.companyId ?? match?.companyId ?? null;
  const knownCompany = defaultCompanyId ? customers.some((g) => g.companies.some((c) => c.id === defaultCompanyId)) : false;
  const defaults: TicketFormDefaults = {
    customer:
      knownCompany && defaultCompanyId
        ? defaultCompanyId
        : match && !match.companyId && !isAmbiguousCaller(match)
          ? PRIVATE_CUSTOMER
          : "",
    contactUserId: call.userId ?? (match?.companyId === defaultCompanyId ? (match?.userId ?? "") : ""),
    contactName: match?.userId ? "" : (match?.contactName ?? ""),
    contactPhone: normalized ? formatPhoneDisplay(normalized) : "",
    contactEmail: match?.userId ? "" : (match?.contactEmail ?? ""),
  };

  const rootId = call.company ? (call.company.parentId ?? call.company.id) : (match?.rootCompanyId ?? null);
  const handledLabel = call.status === "MISSED" ? "Zurückgerufen – erledigt" : "Als erledigt markieren";

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: "Anrufe", href: "/admin/anrufe" }, { label: formatCallTime(call.startedAt, now) }]}
        title={<span className="break-words">{title}</span>}
        description={`${isOut ? "Ausgehender Anruf" : "Anruf"} vom ${formatCallDateTime(call.startedAt)}`}
        meta={
          <>
            <CallStatusBadge call={call} now={now} />
            <CallDirection direction={call.direction} status={call.status} withLabel />
            <TestCallBadge provider={call.provider} />
            <CallsLiveRefresh callId={call.id} />
          </>
        }
        actions={
          <>
            {tel ? (
              <a href={tel} className={buttonClasses("primary")}>
                <Phone className="size-4" aria-hidden />
                {isOut ? "Erneut anrufen" : "Zurückrufen"}
              </a>
            ) : null}
            {call.handledAt ? (
              <form action={setCallHandledAction.bind(null, call.id, false)}>
                <SubmitButton variant="ghost" pendingText="Einen Moment …">
                  Wieder als offen markieren
                </SubmitButton>
              </form>
            ) : call.status !== "RINGING" ? (
              <form action={setCallHandledAction.bind(null, call.id, true)}>
                <SubmitButton variant="secondary" pendingText="Einen Moment …">
                  {handledLabel}
                </SubmitButton>
              </form>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {call.ticket ? (
            <Card>
              <CardHeader title="Ticket zu diesem Anruf" />
              <CardBody className="space-y-4">
                <div>
                  <Link href={`/admin/tickets/${call.ticket.id}`} className="font-semibold text-brand-700 hover:underline">
                    {formatTicketNumber(call.ticket.id)}
                  </Link>
                  <p className="mt-0.5 font-semibold break-words text-ink">{call.ticket.subject}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={call.ticket.status} audience="staff" />
                    <PriorityBadge priority={call.ticket.priority} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href={`/admin/tickets/${call.ticket.id}`}>Ticket öffnen</ButtonLink>
                  <form action={unlinkCallTicketAction.bind(null, call.id)}>
                    <SubmitButton variant="ghost" pendingText="Einen Moment …">
                      Verknüpfung lösen
                    </SubmitButton>
                  </form>
                </div>
              </CardBody>
            </Card>
          ) : (
            <>
              <Card id="ticket-anlegen" className="scroll-mt-24">
                <CardHeader
                  title="Ticket aus Anruf anlegen"
                  description="Die Gesprächsnotiz landet als interne Notiz im Ticket. Der Anruf wird mit dem Ticket verknüpft und gilt als erledigt."
                />
                <CardBody>
                  {customers.length === 0 ? (
                    <p className="mb-4 text-sm text-ink-muted">
                      Es gibt noch keine aktiven Firmenkunden. Sie können das Ticket als Privatkunde anlegen.
                    </p>
                  ) : null}
                  <CreateTicketFromCallForm
                    action={createTicketFromCallAction.bind(null, call.id)}
                    customers={customers}
                    defaults={defaults}
                    callSummary={describeCall(call)}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Mit bestehendem Ticket verknüpfen"
                  description="Wenn der Anruf zu einem Ticket gehört, das es schon gibt – zum Beispiel eine Rückfrage."
                />
                <CardBody className="space-y-6">
                  {suggestions.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-bold text-ink">Offene Tickets dieses Kunden</h3>
                      <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                        {suggestions.map((t) => (
                          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <Link href={`/admin/tickets/${t.id}`} className="text-sm font-semibold text-brand-700 hover:underline">
                                {formatTicketNumber(t.id)}
                              </Link>
                              <p className="truncate text-sm text-ink">{t.subject}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <StatusBadge status={t.status} audience="staff" />
                              <form action={linkCallToSuggestedTicketAction.bind(null, call.id, t.id)}>
                                <SubmitButton variant="secondary" size="sm" pendingText="…">
                                  Verknüpfen
                                </SubmitButton>
                              </form>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <LinkTicketForm action={linkCallToTicketAction.bind(null, call.id)} />
                </CardBody>
              </Card>
            </>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title={isOut ? "Angerufen" : "Anrufer"} />
            <CardBody className="space-y-3 text-sm">
              {call.company ? (
                <>
                  <p className="font-semibold text-ink">{companyPath(call.company)}</p>
                  {call.user ? (
                    <p className="text-ink-soft">
                      {call.user.name}
                      {call.user.position ? `, ${call.user.position}` : ""}
                      <br />
                      <a href={`mailto:${call.user.email}`} className="break-all hover:underline">
                        {call.user.email}
                      </a>
                    </p>
                  ) : null}
                </>
              ) : isAmbiguousCaller(match) ? (
                <>
                  <p className="font-semibold text-ink">{match?.label}</p>
                  <p className="text-ink-soft">
                    Verschiedene Kunden haben diese Nummer eingetragen. Klären Sie im Gespräch, wer anruft, und wählen Sie den
                    Kunden beim Ticket selbst aus.
                  </p>
                </>
              ) : match ? (
                <p className="font-semibold text-ink">{match.label}</p>
              ) : (
                <p className="text-ink-soft">
                  Diese Nummer ist bei keinem Kunden, Ansprechpartner, Ticket und keiner Anfrage hinterlegt. Wählen Sie beim Ticket
                  einen Kunden aus, dann wird der Anruf ihm zugeordnet. Damit künftige Anrufe automatisch erkannt werden, tragen Sie
                  die Nummer beim Kunden oder Ansprechpartner ein.
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {rootId ? (
                  <Link href={`/admin/kunden/${rootId}`} className="font-semibold text-brand-700 hover:underline">
                    Kunde öffnen
                  </Link>
                ) : null}
                {!rootId && match?.inquiryId ? (
                  <Link href={`/admin/anfragen/${match.inquiryId}`} className="font-semibold text-brand-700 hover:underline">
                    Anfrage {formatInquiryNumber(match.inquiryId)} öffnen
                  </Link>
                ) : null}
                {!rootId && match?.ticketId ? (
                  <Link href={`/admin/tickets/${match.ticketId}`} className="font-semibold text-brand-700 hover:underline">
                    Ticket {formatTicketNumber(match.ticketId)} öffnen
                  </Link>
                ) : null}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Angaben zum Anruf" />
            <CardBody>
              <dl className="divide-y divide-line">
                <Detail label="Zeitpunkt">{formatCallDateTime(call.startedAt)}</Detail>
                <Detail label={isOut ? "Angerufene Nummer" : "Nummer"}>
                  {tel ? (
                    <a href={tel} className="hover:underline">
                      {formatPhoneDisplay(number)}
                    </a>
                  ) : (
                    "Rufnummer unterdrückt"
                  )}
                </Detail>
                {!isOut && call.toNumber ? <Detail label="Gewählte Nummer">{formatPhoneDisplay(call.toNumber)}</Detail> : null}
                {isOut && call.fromNumber ? <Detail label="Von Nummer">{formatPhoneDisplay(call.fromNumber)}</Detail> : null}
                <Detail label={isOut ? "Geführt von" : "Angenommen von"}>{call.answeredBy ?? "–"}</Detail>
                {call.answeredAt ? <Detail label="Angenommen um">{formatCallDateTime(call.answeredAt)}</Detail> : null}
                <Detail label="Dauer">{duration ?? (call.status === "ANSWERED" ? "Gespräch läuft" : "–")}</Detail>
                {cause ? <Detail label="Ende">{cause}</Detail> : null}
                {call.handledAt ? (
                  <Detail label="Erledigt">
                    {formatCallDateTime(call.handledAt)}
                    {call.handledBy ? ` von ${call.handledBy.name}` : ""}
                  </Detail>
                ) : null}
                <Detail label="Gemeldet über">{CALL_PROVIDER_LABELS[call.provider as CallProvider] ?? call.provider}</Detail>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CallNoteForm action={saveCallNoteAction.bind(null, call.id)} note={call.note} />
            </CardBody>
          </Card>

          {history.length > 0 ? (
            <Card>
              <CardHeader title="Frühere Anrufe dieser Nummer" />
              <CardBody>
                <ul className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-start gap-2">
                        <CallDirection direction={h.direction} status={h.status} />
                        <div className="min-w-0">
                          <Link href={`/admin/anrufe/${h.id}`} className="font-medium text-ink hover:underline">
                            {formatCallTime(h.startedAt, now)}
                          </Link>
                          {h.ticket ? <span className="text-ink-muted"> · {formatTicketNumber(h.ticket.id)}</span> : null}
                          {h.answeredBy ? <p className="text-xs text-ink-muted">{h.answeredBy}</p> : null}
                        </div>
                      </div>
                      <CallStatusBadge call={h} now={now} />
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

/** Aktive Firmenkunden mit Unterkunden und ihren aktiven Benutzern (für die Kundenauswahl). */
async function loadCustomers(): Promise<CustomerGroup[]> {
  const companies = await db.company.findMany({
    where: { active: true, OR: [{ parentId: null }, { parent: { active: true } }] },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      parentId: true,
      users: {
        where: { active: true, role: { in: [...CUSTOMER_ROLES] } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      },
    },
  });
  const roots = companies.filter((c) => c.parentId === null);
  return roots.map((root) => ({
    rootId: root.id,
    rootName: root.name,
    companies: [
      { id: root.id, name: root.name, isRoot: true, users: root.users },
      ...companies
        .filter((c) => c.parentId === root.id)
        .map((c) => ({ id: c.id, name: c.name, isRoot: false, users: c.users })),
    ],
  }));
}

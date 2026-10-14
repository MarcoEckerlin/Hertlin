import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Paperclip } from "lucide-react";
import { site } from "@/config/site";
import { cn } from "@/lib/cn";
import { CATEGORY_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatFileSize, formatRelative, formatTicketNumber } from "@/lib/format";
import { canCustomerReply } from "@/lib/tickets";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GuestReplyForm } from "@/components/forms/guest-reply-form";
import { PRIVATE_CATEGORY_LABELS } from "@/components/forms/form-options";
import { loadGuestTicket, type GuestTicket } from "./guest-ticket";

export const metadata: Metadata = {
  title: "Status Ihrer Anfrage",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function GuestStatusPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const ticket = await loadGuestTicket(token);
  if (!ticket) return <InvalidLink />;

  const categoryLabel =
    (PRIVATE_CATEGORY_LABELS as Record<string, string>)[ticket.category] ?? labelOf(CATEGORY_LABELS, ticket.category);
  const canReply = canCustomerReply(ticket.status);

  return (
    <>
      <section className="border-b border-line bg-brand-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">
            Ihre Anfrage {formatTicketNumber(ticket.id)}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight break-words text-ink sm:text-4xl">{ticket.subject}</h1>
          <p className="mt-2 text-ink-soft">{categoryLabel}</p>

          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:grid-cols-4 sm:p-6">
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Status</dt>
              <dd className="mt-1.5">
                <StatusBadge status={ticket.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Eingegangen</dt>
              <dd className="mt-1.5 text-sm text-ink">{formatDateTime(ticket.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Letzte Änderung</dt>
              <dd className="mt-1.5 text-sm text-ink">
                <time dateTime={ticket.updatedAt.toISOString()} title={formatDateTime(ticket.updatedAt)}>
                  {formatRelative(ticket.updatedAt)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Ihr Ansprechpartner</dt>
              <dd className="mt-1.5 text-sm text-ink">{ticket.assignee?.name ?? "wird noch zugeteilt"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
        <StatusNotice ticket={ticket} />

        <section aria-labelledby="verlauf">
          <h2 id="verlauf" className="text-xl font-bold text-ink">
            Verlauf
          </h2>
          {ticket.messages.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Noch keine Nachrichten">
                Sobald wir uns Ihre Anfrage angesehen haben, steht unsere Antwort hier.
              </EmptyState>
            </div>
          ) : (
            <ol className="mt-5 space-y-4">
              {ticket.messages.map((message) => (
                <MessageItem key={message.id} message={message} token={token} contactName={ticket.contactName} />
              ))}
            </ol>
          )}
        </section>

        <section id="antworten" aria-labelledby="antworten-titel" className="scroll-mt-28">
          {canReply ? (
            <Card>
              <CardHeader
                title={<span id="antworten-titel">{ticket.status === "RESOLVED" ? "Doch noch nicht gelöst?" : "Antworten"}</span>}
                description="Ihre Nachricht landet direkt bei uns im Ticket. Fotos und Screenshots können Sie gleich mitschicken."
              />
              <CardBody>
                <GuestReplyForm
                  token={token}
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
            <div className="rounded-2xl border border-line bg-mist p-6">
              <h2 id="antworten-titel" className="font-bold text-ink">
                Antworten nicht mehr möglich
              </h2>
              <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink-soft">
                Diese Anfrage ist geschlossen. Wenn ein neues Problem auftaucht, schreiben Sie uns bitte über das Formular –
                Sie bekommen dann eine neue Ticketnummer.
              </p>
              <div className="mt-4">
                <ButtonLink href="/privatkunden#hilfe-anfordern" variant="secondary" size="sm">
                  Neue Anfrage stellen
                </ButtonLink>
              </div>
            </div>
          )}
        </section>

        <p className="border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
          Diese Seite ist nur über Ihren persönlichen Link erreichbar. Bitte geben Sie ihn nicht weiter. Fragen beantworten
          wir auch gern am Telefon unter{" "}
          <a href={`tel:${site.phoneHref}`} className="font-semibold whitespace-nowrap text-brand-700 hover:underline">
            {site.phone}
          </a>
          . Bitte nennen Sie dabei Ihre Ticketnummer {formatTicketNumber(ticket.id)}.
        </p>
      </div>
    </>
  );
}

/** Kurze Erklärung, was der aktuelle Status für den Kunden bedeutet. */
function StatusNotice({ ticket }: { ticket: GuestTicket }) {
  switch (ticket.status) {
    case "NEW":
      return (
        <Alert tone="info" title="Ihre Anfrage ist bei uns eingegangen">
          Wir sehen sie uns an und melden uns in der Regel innerhalb eines Werktags, meistens mit einem kurzen Anruf.
        </Alert>
      );
    case "IN_PROGRESS":
      return (
        <Alert tone="info" title="Wir kümmern uns darum">
          Sobald es Neuigkeiten gibt, lesen Sie sie hier. Zusätzlich bekommen Sie eine E-Mail.
        </Alert>
      );
    case "WAITING_CUSTOMER":
      return (
        <Alert tone="warning" title="Wir warten auf Ihre Antwort">
          Wir haben Ihnen eine Rückfrage geschickt (siehe Verlauf). Sobald Sie geantwortet haben, machen wir weiter.{" "}
          <a href="#antworten" className="font-semibold underline underline-offset-2">
            Jetzt antworten
          </a>
        </Alert>
      );
    case "RESOLVED":
      return (
        <Alert tone="success" title="Gelöst">
          Aus unserer Sicht ist das Problem behoben{ticket.resolvedAt ? ` (seit ${formatDateTime(ticket.resolvedAt)})` : ""}.
          Falls nicht, antworten Sie einfach unten – dann öffnen wir die Anfrage wieder.
        </Alert>
      );
    case "CLOSED":
      return (
        <Alert tone="info" title="Diese Anfrage ist abgeschlossen">
          {ticket.closedAt ? `Geschlossen am ${formatDateTime(ticket.closedAt)}. ` : null}
          Den Verlauf können Sie hier weiterhin nachlesen.
        </Alert>
      );
    default:
      return null;
  }
}

function MessageItem({
  message,
  token,
  contactName,
}: {
  message: GuestTicket["messages"][number];
  token: string;
  contactName: string | null;
}) {
  const fromStaff = message.fromStaff;
  const author = fromStaff
    ? (message.author?.name ?? message.authorName ?? site.name)
    : (message.authorName ?? contactName ?? "Sie");

  return (
    <li className={cn("flex", fromStaff ? "justify-start" : "justify-end")}>
      <article
        className={cn(
          "w-full max-w-2xl rounded-2xl border p-4 sm:p-5",
          fromStaff ? "border-line bg-white shadow-card sm:mr-10" : "border-brand-200 bg-brand-50 sm:ml-10",
        )}
        aria-label={fromStaff ? `Nachricht von ${site.name}` : "Ihre Nachricht"}
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <span className="break-words">{author}</span>
            {fromStaff ? (
              author !== site.name ? <Badge tone="blue">{site.name}</Badge> : null
            ) : (
              <span className="text-xs font-normal text-ink-muted">Ihre Nachricht</span>
            )}
          </p>
          <time dateTime={message.createdAt.toISOString()} className="text-xs text-ink-muted">
            {formatDateTime(message.createdAt)}
          </time>
        </header>
        <div className="mt-2.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
          {message.body}
        </div>
        {message.attachments.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Anhänge">
            {message.attachments.map((attachment) => (
              <li key={attachment.id} className="max-w-full">
                <a
                  href={`/status/${token}/dateien/${attachment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink ring-1 ring-line ring-inset hover:bg-brand-50 hover:ring-brand-300"
                >
                  <Paperclip className="size-3.5 shrink-0 text-ink-muted" aria-hidden />
                  <span className="truncate">{attachment.fileName}</span>
                  <span className="shrink-0 text-xs text-ink-muted">{formatFileSize(attachment.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </li>
  );
}

function InvalidLink() {
  return (
    <section className="bg-brand-50">
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Status-Link</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Dieser Link funktioniert leider nicht</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          Vielleicht wurde er beim Kopieren abgeschnitten. Am sichersten öffnen Sie ihn direkt aus unserer E-Mail. Finden Sie
          die E-Mail nicht mehr, schicken wir Ihnen den Link gern noch einmal.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href="/status">Link erneut anfordern</ButtonLink>
          <ButtonLink href="/privatkunden#hilfe-anfordern" variant="secondary">
            Neue Anfrage stellen
          </ButtonLink>
        </div>
        <p className="mt-8 text-sm text-ink-muted">
          Oder rufen Sie uns an:{" "}
          <a href={`tel:${site.phoneHref}`} className="font-semibold text-brand-700 hover:underline">
            {site.phone}
          </a>
          {" · "}
          <Link href="/kontakt" className="font-semibold text-brand-700 hover:underline">
            Kontakt
          </Link>
        </p>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import { CATEGORY_LABELS, STATUS_LABELS, labelOf } from "@/lib/constants";
import { formatDateTime, formatFileSize, formatRelative, formatTicketNumber } from "@/lib/format";
import { LANGUAGE_COOKIE } from "@/lib/languages";
import { getSiteSettings, type SiteSettings } from "@/lib/settings";
import { translationEnabled } from "@/lib/translate";
import { canCustomerReply } from "@/lib/tickets";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { guestTicketLanguageAction } from "@/lib/actions/public";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GuestReplyForm } from "@/components/forms/guest-reply-form";
import { PRIVATE_CATEGORY_LABELS } from "@/components/forms/form-options";
import { LiveConversation } from "@/components/realtime/live-conversation";
import { TranslatedBody } from "@/components/translate/translated-body";
import { ChatLanguageSelect } from "@/components/inquiry-chat/language-select";
import { LiveTimeline } from "@/components/portal/live-timeline";
import {
  guestMessageTranslations,
  guestViewerLanguage,
  loadGuestTicket,
  type GuestTicket,
  type GuestTranslations,
} from "./guest-ticket";

export const metadata: Metadata = {
  title: "Status Ihrer Anfrage",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function GuestStatusPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const [ticket, site] = await Promise.all([loadGuestTicket(token), getSiteSettings()]);
  if (!ticket) return <InvalidLink site={site} />;

  const categoryLabel =
    (PRIVATE_CATEGORY_LABELS as Record<string, string>)[ticket.category] ?? labelOf(CATEGORY_LABELS, ticket.category);
  const canReply = canCustomerReply(ticket.status);

  // Sprache für unsere Antworten: gespeicherte Wahl, sonst die des Website-Übersetzers (nur vorausgewählt)
  const enabled = translationEnabled();
  const cookieLanguage = (await cookies()).get(LANGUAGE_COOKIE)?.value;
  const { lang, fromCookie } = guestViewerLanguage(ticket.contactLanguage, cookieLanguage);
  const translations = enabled ? await guestMessageTranslations(ticket.messages, lang) : {};
  const tail = guestTimelineTail(ticket, site);

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

        {enabled ? (
          <div className="rounded-2xl border border-line bg-white px-4 py-4 shadow-card sm:px-6">
            <ChatLanguageSelect
              action={guestTicketLanguageAction}
              hidden={{ token }}
              current={lang === "de" ? null : lang}
              id="status-sprache"
              label="Antworten übersetzen in …"
              sublabel="Translate our replies into …"
              sublabelLang="en"
              emptyLabel="Nicht übersetzen (Deutsch)"
            />
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              {fromCookie
                ? "Vorausgewählt nach der Sprache, die Sie auf unserer Website eingestellt haben. "
                : null}
              Wir schreiben auf Deutsch und zeigen Ihnen unsere Antworten maschinell übersetzt an. Sie selbst können gern in
              Ihrer Sprache schreiben.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="verlauf">
          <h2 id="verlauf" className="text-xl font-bold text-ink">
            Verlauf
          </h2>
          <div className="mt-5">
            <LiveTimeline
              lastKey={tail.key}
              lastFromSelf={tail.fromSelf}
              announcement={tail.announcement}
              follow={tail.follow}
            >
              {ticket.messages.length === 0 ? (
                <EmptyState title="Noch keine Nachrichten">
                  Sobald wir uns Ihre Anfrage angesehen haben, steht unsere Antwort hier.
                </EmptyState>
              ) : (
                <ol className="space-y-4">
                  {ticket.messages.map((message) => (
                    <MessageItem
                      key={message.id}
                      message={message}
                      token={token}
                      contactName={ticket.contactName}
                      companyName={site.name}
                      translation={translations[message.id]}
                    />
                  ))}
                </ol>
              )}
            </LiveTimeline>
          </div>
          {/* Live-Leiste direkt unter der letzten Nachricht: Ist jemand von uns da, schreibt gerade jemand? */}
          <LiveConversation
            spec={{ t: "sub", ch: "ticket", id: ticket.id, token }}
            audience="customer"
            selfName={ticket.contactName ?? undefined}
            className="mt-4 min-h-5 px-1"
          />
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

/**
 * Letzter Eintrag – für das weiche Mitscrollen und die Ansage bei Neuem.
 * Statuswechsel stehen hier nicht im Verlauf, sondern oben in der Statusanzeige: angesagt, aber nicht angesteuert.
 */
function guestTimelineTail(
  ticket: GuestTicket,
  site: SiteSettings,
): { key: string; fromSelf: boolean; announcement: string; follow: boolean } {
  const message = ticket.messages.at(-1);
  const event = ticket.events[0];
  if (event && (!message || event.createdAt.getTime() > message.createdAt.getTime())) {
    return {
      key: `e:${event.id}`,
      // Änderungen über den Status-Link haben keinen Benutzer (actorId null)
      fromSelf: event.actorId === null,
      announcement: `Neuer Status: ${labelOf(STATUS_LABELS, ticket.status)}`,
      follow: false,
    };
  }
  if (!message) return { key: "leer", fromSelf: true, announcement: "", follow: true };
  const name = message.author?.name ?? message.authorName;
  return {
    key: `m:${message.id}`,
    fromSelf: !message.fromStaff,
    announcement: `Neue Antwort von ${site.name}${name && name !== site.name ? ` (${name})` : ""}`,
    follow: true,
  };
}

function MessageItem({
  message,
  token,
  contactName,
  companyName,
  translation,
}: {
  message: GuestTicket["messages"][number];
  token: string;
  contactName: string | null;
  companyName: string;
  translation?: GuestTranslations[string];
}) {
  const fromStaff = message.fromStaff;
  const author = fromStaff
    ? (message.author?.name ?? message.authorName ?? companyName)
    : (message.authorName ?? contactName ?? "Sie");
  const bodyClass = "text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-ink-soft";

  return (
    <li className={cn("flex", fromStaff ? "justify-start" : "justify-end")}>
      <article
        className={cn(
          "w-full max-w-2xl rounded-2xl border p-4 sm:p-5",
          fromStaff ? "border-line bg-white shadow-card sm:mr-10" : "border-brand-200 bg-brand-50 sm:ml-10",
        )}
        aria-label={fromStaff ? `Nachricht von ${companyName}` : "Ihre Nachricht"}
      >
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            <span className="break-words">{author}</span>
            {fromStaff ? (
              author !== companyName ? <Badge tone="blue">{companyName}</Badge> : null
            ) : (
              <span className="text-xs font-normal text-ink-muted">Ihre Nachricht</span>
            )}
          </p>
          <time dateTime={message.createdAt.toISOString()} className="text-xs text-ink-muted">
            {formatDateTime(message.createdAt)}
          </time>
        </header>
        {translation ? (
          // Schon übersetzt: Der Website-Übersetzer soll weder Übersetzung noch Original ein zweites Mal übersetzen
          <div className="mt-2.5" data-no-translate>
            <TranslatedBody original={message.body} translation={translation} className={bodyClass} />
          </div>
        ) : (
          <div className={cn("mt-2.5", bodyClass)}>{message.body}</div>
        )}
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

function InvalidLink({ site }: { site: SiteSettings }) {
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

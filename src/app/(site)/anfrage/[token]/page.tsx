import type { Metadata } from "next";
import { connection } from "next/server";
import { getSiteSettings, type SiteSettings } from "@/lib/settings";
import { formatDateTime, formatInquiryNumber } from "@/lib/format";
import { portalHost, portalUrl } from "@/lib/hosts";
import { INQUIRY_TOPIC_LABELS, labelOf, type CustomerType } from "@/lib/constants";
import { isLangCode } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { translateForViewer } from "@/lib/chat-translation";
import { INQUIRY_MESSAGE_MAX, customerInquiryStatus, loadGuestInquiryChat } from "@/lib/inquiry-chat";
import { guestInquiryLanguageAction, guestInquiryMessageAction } from "@/lib/actions/inquiry-chat";
import { inquiryTopicLabel, isInquiryTopic } from "@/components/forms/form-options";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { LiveConversation } from "@/components/realtime/live-conversation";
import { ChatThread, type ChatTranslations } from "@/components/inquiry-chat/chat-thread";
import { ChatComposer } from "@/components/inquiry-chat/chat-composer";
import { ChatLanguageSelect } from "@/components/inquiry-chat/language-select";

export const metadata: Metadata = {
  title: "Ihre Anfrage",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function InquiryChatPage({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const site = await getSiteSettings();
  const chat = await loadGuestInquiryChat(token, site.name);
  if (!chat) return <InvalidLink site={site} />;

  const number = formatInquiryNumber(chat.id);
  const status = customerInquiryStatus(chat.status);
  const topic = isInquiryTopic(chat.topic)
    ? inquiryTopicLabel(chat.topic, chat.customerType as CustomerType)
    : labelOf(INQUIRY_TOPIC_LABELS, chat.topic);

  // Nachrichten von Hertlin in der gewählten Sprache zeigen (Deutsch = Original)
  const enabled = translationEnabled();
  const viewerLang = isLangCode(chat.language) && chat.language !== "de" ? chat.language : null;
  const translations: ChatTranslations =
    enabled && viewerLang
      ? await translateForViewer(
          chat.entries.filter((e) => e.fromStaff).map((e) => ({ id: e.id, body: e.body })),
          viewerLang,
        ).catch((error: unknown) => {
          console.error("[anfrage-chat] Übersetzung fehlgeschlagen:", error);
          return {};
        })
      : {};

  return (
    <>
      <section className="border-b border-line bg-brand-50">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Ihre Anfrage {number}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight break-words text-ink sm:text-4xl">{topic}</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Hier schreiben Sie direkt mit unserem Team. Solange diese Seite offen ist, sehen Sie unsere Antworten sofort.
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:grid-cols-3 sm:p-6">
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Status</dt>
              <dd className="mt-1.5">
                <Badge tone={status.tone}>
                  <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
                  {status.label}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-ink-muted">Eingegangen</dt>
              <dd className="mt-1.5 text-sm text-ink">{formatDateTime(chat.createdAt)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <dt className="text-xs font-semibold text-ink-muted">Ihr Ansprechpartner</dt>
              <dd className="mt-1.5 text-sm text-ink">{chat.contactPerson ?? "wird noch zugeteilt"}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-ink-soft">{status.note}</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
        {chat.portalSlug ? (
          <Alert tone="info" title="Sie sind inzwischen Kunde bei uns">
            Für Störungen und neue Anliegen nutzen Sie bitte Ihr Kundenportal unter{" "}
            <a href={portalUrl(chat.portalSlug, "/")} className="font-semibold underline underline-offset-2">
              {portalHost(chat.portalSlug)}
            </a>
            . Dort sehen Sie auch den Stand Ihrer Tickets.
          </Alert>
        ) : null}

        {enabled ? (
          <div className="rounded-2xl border border-line bg-white px-4 py-4 shadow-card sm:px-6">
            <ChatLanguageSelect
              action={guestInquiryLanguageAction}
              hidden={{ token }}
              current={chat.language}
              id="chat-sprache"
              label="Nachrichten übersetzen in …"
              sublabel="Translate our messages into …"
              sublabelLang="en"
              emptyLabel="Nicht übersetzen (Deutsch)"
            />
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              Wir schreiben auf Deutsch. Mit einer Sprache aus der Liste zeigen wir Ihnen unsere Nachrichten maschinell
              übersetzt an. Sie selbst können gern in Ihrer Sprache schreiben.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="chat-titel" className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line px-4 py-3 sm:px-6">
            <h2 id="chat-titel" className="text-base font-bold text-ink">
              Chat mit {site.name}
            </h2>
            <LiveConversation spec={{ t: "sub", ch: "inquiry", token }} audience="customer" selfName={chat.name} />
          </div>

          <ChatThread
            entries={chat.entries}
            perspective="guest"
            translations={translations}
            companyName={site.name}
            className="max-h-[min(60dvh,34rem)] min-h-48 bg-mist"
          />

          <div className="border-t border-line px-3 py-3 sm:px-5 sm:py-4">
            <ChatComposer
              action={guestInquiryMessageAction}
              hidden={{ token }}
              typingKey={`inquiry:${chat.id}`}
              id="chat-nachricht"
              label="Ihre Nachricht"
              placeholder={`Ihre Nachricht an ${site.name} …`}
              maxLength={INQUIRY_MESSAGE_MAX}
            />
          </div>
        </section>

        <div className="space-y-2 border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
          <p>
            Sie können diese Seite jederzeit schließen. Wenn wir Ihnen schreiben, während Sie nicht hier sind, bekommen Sie
            eine E-Mail mit diesem Link.
          </p>
          <p>
            Die Seite ist nur über Ihren persönlichen Link erreichbar. Bitte geben Sie ihn nicht weiter – wer ihn kennt, kann
            den Chat lesen. Lieber telefonisch? Sie erreichen uns unter{" "}
            <a href={`tel:${site.phoneHref}`} className="font-semibold whitespace-nowrap text-brand-700 hover:underline">
              {site.phone}
            </a>
            . Nennen Sie dabei bitte die Nummer {number}.
          </p>
        </div>
      </div>
    </>
  );
}

function InvalidLink({ site }: { site: SiteSettings }) {
  return (
    <section className="bg-brand-50">
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 sm:py-28">
        <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Chat zu Ihrer Anfrage</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl">Dieser Link funktioniert leider nicht</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-soft">
          Vielleicht wurde er beim Kopieren abgeschnitten. Am sichersten öffnen Sie ihn direkt aus unserer E-Mail. Finden Sie
          die E-Mail nicht mehr, rufen Sie uns kurz an – wir schicken Ihnen den Link gern noch einmal.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={`tel:${site.phoneHref}`}>{site.phone} anrufen</ButtonLink>
          <ButtonLink href="/kontakt" variant="secondary">
            Neue Anfrage stellen
          </ButtonLink>
        </div>
        <p className="mt-8 text-sm text-ink-muted">
          Oder schreiben Sie uns:{" "}
          <a href={`mailto:${site.email}`} className="font-semibold text-brand-700 hover:underline">
            {site.email}
          </a>
        </p>
      </div>
    </section>
  );
}

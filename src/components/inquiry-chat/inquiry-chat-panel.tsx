import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { isLangCode, languageLabel } from "@/lib/languages";
import { translationEnabled } from "@/lib/translate";
import { translateForViewer } from "@/lib/chat-translation";
import { INQUIRY_MESSAGE_MAX, inquiryChatUrl, loadStaffInquiryChat } from "@/lib/inquiry-chat";
import { staffInquiryLanguageAction, staffInquiryMessageAction } from "@/lib/actions/inquiry-chat";
import { Alert } from "@/components/ui/alert";
import { LiveConversation } from "@/components/realtime/live-conversation";
import { ChatThread, type ChatTranslations } from "@/components/inquiry-chat/chat-thread";
import { ChatComposer } from "@/components/inquiry-chat/chat-composer";
import { ChatLinkBox } from "@/components/inquiry-chat/chat-link-box";
import { ChatLanguageSelect, SuggestLanguageButton } from "@/components/inquiry-chat/language-select";

/**
 * Anfragen-Chat in der Verwaltung (/admin/anfragen/[id]).
 * Lädt den Verlauf selbst (inkl. ursprünglicher Anfrage) und prüft dabei die Anmeldung.
 * Nachrichten des Interessenten werden in die Sprache des Mitarbeiters übersetzt (Standard: Deutsch).
 */
export async function InquiryChatPanel({
  inquiryId,
  staffUser,
}: {
  inquiryId: number;
  staffUser: Pick<SessionUser, "id" | "name">;
}) {
  const site = await getSiteSettings();
  const chat = await loadStaffInquiryChat(inquiryId, site.name);
  if (!chat) return null;

  const viewer = await db.user.findUnique({ where: { id: staffUser.id }, select: { language: true } });
  const viewerLang = isLangCode(viewer?.language) ? viewer.language : "de";
  const enabled = translationEnabled();

  const prospectItems = chat.entries.filter((e) => !e.fromStaff).map((e) => ({ id: e.id, body: e.body }));
  const translations: ChatTranslations = enabled
    ? await translateForViewer(prospectItems, viewerLang).catch((error: unknown) => {
        console.error("[anfrage-chat] Übersetzung fehlgeschlagen:", error);
        return {};
      })
    : {};

  // Schreibt der Interessent erkennbar in einer anderen Sprache als eingestellt, auf die Umstellung hinweisen
  const prospectLang = chat.language ?? "de";
  const detected = [...chat.entries]
    .reverse()
    .map((e) => translations[e.id]?.from ?? null)
    .find((lang): lang is string => lang !== null);
  const suggestion = enabled && isLangCode(detected) && detected !== prospectLang && detected !== "de" ? detected : null;

  const url = chat.guestToken ? inquiryChatUrl(chat.guestToken) : null;
  const headingId = `anfrage-chat-${chat.id}`;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-bold text-ink">
            Chat mit {chat.name}
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Ist {chat.name} gerade auf der Chat-Seite, erscheinen Ihre Nachrichten dort sofort. Sonst geht eine E-Mail mit
            dem Link raus.
          </p>
        </div>
      </div>

      <div className="space-y-4 border-b border-line bg-mist px-5 py-4 sm:px-6">
        <ChatLinkBox inquiryId={chat.id} url={url} name={chat.name} email={chat.email} />
        {enabled ? (
          <ChatLanguageSelect
            action={staffInquiryLanguageAction}
            hidden={{ inquiryId: String(chat.id) }}
            current={chat.language}
            id={`anfrage-${chat.id}-sprache`}
            label="Sprache des Interessenten"
            sublabel="Ihre Nachrichten sieht er automatisch übersetzt. Sie schreiben weiter auf Deutsch."
            emptyLabel="Deutsch (keine Übersetzung)"
          />
        ) : null}
      </div>

      {suggestion ? (
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <Alert tone="info" title={`${chat.name} schreibt offenbar auf ${languageLabel(suggestion)}`}>
            {chat.language
              ? `Eingestellt ist ${languageLabel(chat.language)}. `
              : "Bisher sieht der Interessent Ihre Nachrichten auf Deutsch. "}
            Stellen Sie um, damit Ihre Antworten bei ihm übersetzt ankommen. Sie schreiben weiter auf Deutsch.
            <SuggestLanguageButton action={staffInquiryLanguageAction} inquiryId={chat.id} language={suggestion} />
          </Alert>
        </div>
      ) : null}

      <div className="border-b border-line px-5 py-2.5 sm:px-6">
        <LiveConversation spec={{ t: "sub", ch: "inquiry", id: chat.id }} audience="staff" selfName={staffUser.name} />
      </div>

      <ChatThread
        entries={chat.entries}
        perspective="staff"
        translations={translations}
        companyName={site.name}
        selfId={staffUser.id}
        className="max-h-[min(70dvh,36rem)] min-h-40 bg-mist"
      />

      <div className="border-t border-line px-4 py-4 sm:px-6">
        <ChatComposer
          action={staffInquiryMessageAction}
          hidden={{ inquiryId: String(chat.id) }}
          typingKey={`inquiry:${chat.id}`}
          id={`anfrage-${chat.id}-antwort`}
          label={`Antwort an ${chat.name}`}
          placeholder={`Nachricht an ${chat.name} …`}
          maxLength={INQUIRY_MESSAGE_MAX}
          mailedNote={`${chat.name} ist gerade nicht im Chat und bekommt eine E-Mail-Benachrichtigung.`}
        />
      </div>
    </section>
  );
}

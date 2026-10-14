"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { initialFormState } from "@/lib/forms";
import { sendInquiryChatLinkAction } from "@/lib/actions/inquiry-chat";
import { CopyButton } from "@/components/ui/copy-button";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Chat-Link des Interessenten in der Verwaltung:
 * noch keiner da → per E-Mail senden (legt ihn an); sonst anzeigen, kopieren, erneut senden.
 */
export function ChatLinkBox({
  inquiryId,
  url,
  name,
  email,
}: {
  inquiryId: number;
  url: string | null;
  name: string;
  email: string;
}) {
  const [state, formAction] = useActionState(sendInquiryChatLinkAction, initialFormState);

  return (
    <div className="space-y-3">
      <FormMessage state={state} />
      {url ? (
        <div className="space-y-2">
          <label htmlFor={`chat-link-${inquiryId}`} className="block text-sm font-semibold text-ink">
            Persönlicher Chat-Link
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              id={`chat-link-${inquiryId}`}
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 font-mono text-xs text-ink-soft focus:border-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
            <div className="flex shrink-0 flex-wrap gap-2">
              <CopyButton value={url} label="Link kopieren" />
              <form action={formAction}>
                <input type="hidden" name="inquiryId" value={inquiryId} />
                <SubmitButton variant="secondary" size="sm" pendingText="Wird gesendet …">
                  <Mail className="size-4" aria-hidden />
                  Link erneut senden
                </SubmitButton>
              </form>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Wer den Link kennt, kann den Chat lesen. Geben Sie ihn nur an {name} weiter.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-soft">
            {name} hat noch keinen Chat-Link. Mit Ihrer ersten Antwort geht er automatisch per E-Mail an{" "}
            <span className="font-medium break-all text-ink">{email}</span> – oder Sie schicken ihn jetzt schon.
          </p>
          <form action={formAction} className="shrink-0">
            <input type="hidden" name="inquiryId" value={inquiryId} />
            <SubmitButton variant="secondary" size="sm" pendingText="Wird gesendet …">
              <Mail className="size-4" aria-hidden />
              Chat-Link per E-Mail senden
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

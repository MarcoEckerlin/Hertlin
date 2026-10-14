import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { PrivateSupportFormClient } from "@/components/forms/private-support-form-client";

/**
 * Hilfe-Formular für Privatkunden (eingebunden auf /privatkunden#hilfe-anfordern).
 * Aus dem Formular entsteht ein Ticket; der Kunde bekommt eine Ticketnummer und einen persönlichen Status-Link.
 *
 * Server-Komponente, weil die Upload-Regeln aus @/lib/uploads (server-only) kommen.
 * Bitte nur aus Server-Komponenten (z. B. einer page.tsx) rendern.
 */
export function PrivateSupportForm() {
  return (
    <PrivateSupportFormClient
      uploadRules={{
        accept: ACCEPT_ATTRIBUTE,
        maxFiles: MAX_FILES,
        maxFileSize: MAX_FILE_SIZE,
        allowedLabel: ALLOWED_EXTENSIONS_LABEL,
      }}
    />
  );
}

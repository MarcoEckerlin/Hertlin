/** Gemeinsame Werte für playwright.config.ts und die Tests. */
// E2E_PORT: eigener Port, z. B. wenn mehrere Testläufe parallel in getrennten Arbeitskopien laufen
export const PORT = Number(process.env.E2E_PORT) || 3200;

/** Fester Zugangsschlüssel für den Telefonie-Webhook – gilt nur für den Testserver. */
export const E2E_TELEPHONY_TOKEN = "e2e-telefonie-zugangsschluessel-0123456789abcdef";

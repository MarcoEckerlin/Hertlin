import { defineConfig, devices } from "@playwright/test";
import { E2E_TELEPHONY_TOKEN, PORT } from "./tests/e2e/env";

/**
 * Ende-zu-Ende-Tests gegen einen Produktions-Build.
 * Voraussetzung: npm run build. Aufruf: npm run test:e2e
 *
 * Der Testserver ist der eigene Server aus server.ts (Next.js + WebSocket für Live-Chats und Anrufe).
 * Die Tests nutzen eine eigene Datenbank (prisma/e2e.db), die tests/e2e/prepare-db.ts vor jedem Lauf neu
 * anlegt und mit den Beispieldaten aus prisma/seed.ts befüllt. Mails landen ohne SMTP in storage/mails.log.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "node_modules/.bin/tsx tests/e2e/prepare-db.ts && node_modules/.bin/tsx server.ts",
    url: `http://localhost:${PORT}/`,
    // Nur zum Entwickeln der Tests: E2E_REUSE_SERVER=1 nutzt einen bereits laufenden Testserver (Datenbank wird dann nicht neu angelegt)
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      NODE_ENV: "production",
      PORT: String(PORT),
      LISTEN_HOST: "127.0.0.1",
      ROOT_DOMAIN: `localhost:${PORT}`,
      APP_PROTOCOL: "http",
      DATABASE_URL: "file:./e2e.db",
      UPLOAD_DIR: "storage/e2e-uploads",
      TELEPHONY_WEBHOOK_TOKEN: E2E_TELEPHONY_TOKEN,
      TELEPHONY_ALLOWED_IPS: "",
      // Deterministisch: keine Mails per SMTP, keine maschinelle Übersetzung
      SMTP_HOST: "",
      TRANSLATION_PROVIDER: "off",
    },
  },
});

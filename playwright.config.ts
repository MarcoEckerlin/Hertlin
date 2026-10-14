import { defineConfig, devices } from "@playwright/test";

/**
 * Ende-zu-Ende-Tests gegen einen Produktions-Build.
 * Voraussetzung: npm run build. Aufruf: npm run test:e2e
 * Die Tests nutzen eine eigene Datenbank (prisma/e2e.db), die vor jedem Lauf neu angelegt wird.
 */
const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx prisma migrate reset --force --skip-generate && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      ROOT_DOMAIN: `localhost:${PORT}`,
      APP_PROTOCOL: "http",
      UPLOAD_DIR: "storage/e2e-uploads",
    },
  },
});

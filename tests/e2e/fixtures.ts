import { test as base, expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { PORT } from "./env";

export { PORT };
export const PASSWORD = "demo-passwort-2026";
export const main = (path = "/") => `http://localhost:${PORT}${path}`;
export const portal = (slug: string, path = "/") => `http://${slug}.localhost:${PORT}${path}`;

/** Demo-Konten aus prisma/seed.ts */
export const ACCOUNTS = {
  admin: { email: "admin@hertlin.de", name: "Anna Hertlin" },
  tech: { email: "technik@hertlin.de", name: "Jonas Keller" },
  berger: { email: "berger@muster.example", name: "Claudia Berger" },
  yilmaz: { email: "yilmaz@muster.example", name: "Deniz Yilmaz" },
  ulm: { email: "ulm@muster.example", name: "Peter Wagner" },
  baecker: { email: "chef@baeckerei.example", name: "Tobias Brandt" },
} as const;

let ipCounter = 0;

/** Jede Browser-Sitzung bekommt eine eigene (fiktive) Client-IP, damit sich Rate-Limits nicht in die Quere kommen. */
export function nextClientIp(): string {
  ipCounter += 1;
  return `10.${90 + Math.floor(ipCounter / 250)}.${process.pid % 250}.${(ipCounter % 250) + 1}`;
}

/**
 * Jeder Test bekommt eine eigene (fiktive) Client-IP, damit sich die Rate-Limits
 * der Formulare und Anmeldungen zwischen Tests nicht in die Quere kommen.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.setExtraHTTPHeaders({ "X-Forwarded-For": nextClientIp() });
    await use(context);
  },
});

export { expect };

/** Weiterer, unabhängiger Browser-Kontext (z. B. zweite Person im Live-Chat) mit eigener Client-IP. */
export async function newContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    viewport: { width: 1440, height: 900 },
  });
  await context.setExtraHTTPHeaders({ "X-Forwarded-For": nextClientIp() });
  return context;
}

/** Eindeutiger Text für diesen Lauf, z. B. für Betreffzeilen. */
export function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Füllt die Anmeldeseite aus und schickt sie ab (ohne auf das Ergebnis zu warten). */
export async function login(page: Page, url: string, email: string, password = PASSWORD) {
  await page.goto(url);
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

/** Anmeldung in der Verwaltung, wartet bis die Übersicht offen ist. */
export async function loginStaff(page: Page, email: string) {
  await login(page, main("/admin/login"), email);
  await expect(page).toHaveURL(main("/admin"));
}

/** Anmeldung im Kundenportal, wartet bis die Startseite des Portals offen ist. */
export async function loginPortal(page: Page, slug: string, email: string, password = PASSWORD) {
  await login(page, portal(slug, "/login"), email, password);
  await expect(page).toHaveURL(portal(slug, "/"));
}

/** Ticketnummer aus einer URL wie …/tickets/12?neu=1 */
export function ticketIdFrom(url: string): number {
  const id = Number(new URL(url).pathname.match(/\/tickets\/(\d+)/)?.[1]);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Keine Ticketnummer in ${url}`);
  return id;
}

/** 1×1-Pixel-PNG als Testanhang */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export function pngFile(name: string) {
  return { name, mimeType: "image/png", buffer: PNG_1PX };
}

/**
 * Ticket im Kundenportal anlegen (Benutzer muss angemeldet sein). Gibt die Ticketnummer zurück.
 * Die Seite steht danach auf der Detailansicht des neuen Tickets.
 */
export async function createPortalTicket(
  page: Page,
  slug: string,
  opts: { subject: string; description: string; type?: "Störung" | "Anfrage"; attachment?: string; company?: string },
): Promise<number> {
  await page.goto(portal(slug, "/tickets/neu"));
  if (opts.type) await page.getByRole("radio", { name: opts.type }).check();
  await page.getByLabel("Bereich").selectOption({ index: 1 });
  if (opts.company) await page.getByLabel("Für welche Firma?").selectOption({ label: opts.company });
  await page.getByLabel("Betreff").fill(opts.subject);
  await page.getByLabel("Beschreibung").fill(opts.description);
  if (opts.attachment) await page.getByLabel("Screenshots oder Dateien").setInputFiles(pngFile(opts.attachment));
  await page.getByRole("button", { name: "Ticket absenden" }).click();
  await expect(page).toHaveURL(/\/tickets\/\d+\?neu=1/);
  await expect(page.getByRole("heading", { level: 1, name: opts.subject })).toBeVisible();
  return ticketIdFrom(page.url());
}

/** Formatiert eine Ticketnummer wie die App: 7 -> "T-00007" */
export function ticketNumber(id: number): string {
  return `T-${String(id).padStart(5, "0")}`;
}

/**
 * Lädt eine Adresse mit den Cookies der Seite im Browser (fetch). Für Subdomains wie muster.localhost,
 * die Node.js selbst nicht auflöst. Gibt Status, Inhaltstyp und Inhalt (Base64) zurück.
 */
export async function fetchInPage(page: Page, url: string) {
  return page.evaluate(async (target) => {
    const response = await fetch(target, { redirect: "manual", credentials: "same-origin" });
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return { status: response.status, contentType: response.headers.get("content-type") ?? "", base64: btoa(binary) };
  }, url);
}

/**
 * Negative Prüfung für Live-Ereignisse: Der Locator darf während der ganzen Zeitspanne nicht auftauchen.
 * (Ein einzelnes toHaveCount(0) wäre sofort erfüllt, auch wenn das Ereignis Millisekunden später käme.)
 */
export async function expectAbsentFor(locator: Locator, ms = 1500) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    expect(await locator.count(), `${locator} ist aufgetaucht`).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

/**
 * Wartet, bis die Seite den Live-Kanal abonniert hat (WebSocket-Antwort „subscribed“).
 * Vor page.goto aufrufen, damit kein Frame verpasst wird.
 */
export function waitForSubscription(page: Page, key: string): Promise<void> {
  return new Promise((resolve) => {
    page.on("websocket", (ws) => {
      ws.on("framereceived", (frame) => {
        const payload = typeof frame.payload === "string" ? frame.payload : frame.payload.toString("utf8");
        if (payload.includes(`"t":"subscribed","key":"${key}"`)) resolve();
      });
    });
  });
}

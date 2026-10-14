import { test as base, expect, type Page } from "@playwright/test";

export const PORT = 3200;
export const PASSWORD = "demo-passwort-2026";
export const main = (path = "/") => `http://localhost:${PORT}${path}`;
export const portal = (slug: string, path = "/") => `http://${slug}.localhost:${PORT}${path}`;

let counter = 0;

/**
 * Jeder Test bekommt eine eigene (fiktive) Client-IP, damit sich die Rate-Limits
 * der Formulare und Anmeldungen zwischen Tests nicht in die Quere kommen.
 */
export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    counter += 1;
    await context.setExtraHTTPHeaders({ "X-Forwarded-For": `10.99.${testInfo.workerIndex}.${counter % 250}` });
    await use(context);
  },
});

export { expect };

export async function login(page: Page, url: string, email: string, password = PASSWORD) {
  await page.goto(url);
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
}

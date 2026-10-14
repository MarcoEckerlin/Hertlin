import { test, expect, login, main, portal, PASSWORD } from "./fixtures";
import { lastMailTo, linkIn } from "./mail";

test.describe("Anmeldung und Mandantentrennung", () => {
  test("Portal-Anmeldung auf der eigenen Subdomain", async ({ page }) => {
    await login(page, portal("muster", "/login"), "berger@muster.example");
    await expect(page).toHaveURL(portal("muster", "/"));
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" }).first()).toBeVisible();
  });

  test("Benutzer eines Kunden können sich nicht im Portal eines anderen anmelden", async ({ page }) => {
    await login(page, portal("baeckerei", "/login"), "berger@muster.example");
    await expect(page.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();
    await expect(page).toHaveURL(portal("baeckerei", "/login"));
  });

  test("Kundenkonten kommen nicht in die Verwaltung", async ({ page }) => {
    await login(page, main("/admin/login"), "berger@muster.example");
    await expect(page.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();
  });

  test("Mitarbeiterkonten kommen nicht ins Kundenportal", async ({ page }) => {
    await login(page, portal("muster", "/login"), "admin@hertlin.de");
    await expect(page.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();
  });

  test("Portalseiten sind über die Hauptdomain nicht erreichbar", async ({ page }) => {
    const res = await page.goto(main("/portal/muster/login"));
    expect(res?.status()).toBe(404);
  });

  test("Unbekannte und reservierte Subdomains liefern 404", async ({ page }) => {
    expect((await page.goto(portal("gibtsnicht", "/login")))?.status()).toBe(404);
    expect((await page.goto(portal("admin", "/login")))?.status()).toBe(404);
    expect((await page.goto(portal("muster", "/admin/login")))?.status()).toBe(404);
  });

  test("Sitzungen gelten nur auf ihrer Subdomain", async ({ page }) => {
    await login(page, portal("muster", "/login"), "berger@muster.example");
    await expect(page).toHaveURL(portal("muster", "/"));
    await page.goto(portal("baeckerei", "/"));
    await expect(page).toHaveURL(portal("baeckerei", "/login"));
  });

  test("Portal-Finder leitet zur richtigen Anmeldeseite", async ({ page }) => {
    await page.goto(main("/login"));
    await page.getByLabel("Adresse Ihres Kundenportals").fill("muster");
    await page.getByRole("button", { name: "Weiter zur Anmeldung" }).click();
    await expect(page).toHaveURL(portal("muster", "/login"));
  });

  test("Abmelden beendet die Sitzung", async ({ page }) => {
    await login(page, main("/admin/login"), "technik@hertlin.de");
    await expect(page).toHaveURL(main("/admin"));
    await page.getByRole("button", { name: "Abmelden" }).first().click();
    await expect(page).toHaveURL(main("/admin/login"));
    await page.goto(main("/admin"));
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("Passwort zurücksetzen im Kundenportal", async ({ page }) => {
    await page.goto(portal("baeckerei", "/passwort-vergessen"));
    await page.getByLabel("E-Mail-Adresse").fill("chef@baeckerei.example");
    await page.getByRole("button", { name: "Link anfordern" }).click();
    await expect(page.getByText(/haben wir Ihnen gerade eine E-Mail/)).toBeVisible();

    const mail = await lastMailTo("chef@baeckerei.example");
    const link = mail && linkIn(mail.body, /http:\/\/baeckerei\.localhost:3200\/passwort\/[A-Za-z0-9_-]+/);
    expect(link).toBeTruthy();

    await page.goto(link!);
    await page.getByLabel("Neues Passwort").fill("ein-neues-passwort-123");
    await page.getByLabel("Passwort wiederholen").fill("ein-neues-passwort-123");
    await page.getByRole("button", { name: "Passwort speichern und anmelden" }).click();
    await expect(page).toHaveURL(portal("baeckerei", "/"));

    // Link ist danach verbraucht
    await page.goto(link!);
    await expect(page.getByText("Link nicht mehr gültig")).toBeVisible();

    // Altes Passwort gilt nicht mehr, neues schon
    const other = await page.context().browser()!.newPage();
    await login(other, portal("baeckerei", "/login"), "chef@baeckerei.example", PASSWORD);
    await expect(other.getByText("E-Mail-Adresse oder Passwort stimmen nicht.")).toBeVisible();
    await login(other, portal("baeckerei", "/login"), "chef@baeckerei.example", "ein-neues-passwort-123");
    await expect(other).toHaveURL(portal("baeckerei", "/"));
    await other.close();
  });
});

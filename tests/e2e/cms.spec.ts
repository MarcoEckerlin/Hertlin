import { test, expect, loginStaff, main, newContext, unique, ACCOUNTS } from "./fixtures";

test.describe("Website-Editor", () => {
  test("Text eines Moduls ändern: Entwurf, Vorschau, Veröffentlichen", async ({ page, browser }) => {
    const heading = unique("So arbeiten wir mit Ihnen");

    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main("/admin/website"));
    await page.getByRole("link", { name: "Über uns", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/website\/seiten\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Über uns" })).toBeVisible();
    const pageId = new URL(page.url()).pathname.split("/").pop()!;

    // Zweites Modul (Text) aufklappen und Überschrift ändern
    const modules = page.getByRole("list", { name: "Module der Seite" });
    await modules.getByRole("button", { name: /^Modul 2:/ }).click();
    const textModule = modules.getByRole("listitem").nth(1);
    await textModule.getByLabel("Überschrift", { exact: true }).fill(heading);
    await expect(page.getByRole("status").filter({ hasText: "Ungespeicherte Änderungen" })).toBeVisible();

    // Als Entwurf speichern
    await page.getByRole("button", { name: "Entwurf speichern" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Entwurf gespeichert – noch nicht veröffentlicht" })).toBeVisible();

    // Vorschau zeigt den Entwurf, die Website noch nicht
    await page.goto(main(`/vorschau/${pageId}`));
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();

    const visitorContext = await newContext(browser);
    const visitor = await visitorContext.newPage();
    await visitor.goto(main("/ueber-uns"));
    await expect(visitor.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(visitor.getByText(heading)).toHaveCount(0);

    // Vorschau ist nicht öffentlich
    const anonymousPreview = await visitor.goto(main(`/vorschau/${pageId}`));
    expect(anonymousPreview?.url()).toContain("/admin/login");
    await expect(visitor.getByText(heading)).toHaveCount(0);

    // Veröffentlichen
    await page.goto(main(`/admin/website/seiten/${pageId}`));
    await page.getByRole("button", { name: "Veröffentlichen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alles gespeichert" })).toBeVisible();

    await visitor.goto(main("/ueber-uns"));
    await expect(visitor.getByRole("heading", { name: heading })).toBeVisible();
    await visitorContext.close();
  });

  test("neue eigene Seite anlegen, veröffentlichen und im Hauptmenü aufrufen", async ({ page, browser }) => {
    const stamp = Date.now().toString(36);
    const title = `Stellenangebote ${stamp}`;
    const slug = `stellen-${stamp}`;
    const navLabel = `Jobs ${stamp}`;

    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main("/admin/website/seiten/neu"));
    await page.locator("#new-title").fill(title);
    await page.locator("#new-slug").fill(slug);
    await page.locator("#new-navLabel").fill(navLabel);
    await page.getByRole("checkbox", { name: /^Hauptmenü/ }).check();
    await page.getByRole("button", { name: "Seite anlegen und bearbeiten" }).click();
    // Der Editor nimmt den Hinweis ?neu=1 nach dem Anzeigen wieder aus der Adresse
    await expect(page).toHaveURL(/\/admin\/website\/seiten\/(?!neu\b)[^/?]+/);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    // Vor dem Veröffentlichen nicht erreichbar
    const visitorContext = await newContext(browser);
    const visitor = await visitorContext.newPage();
    expect((await visitor.goto(main(`/${slug}`)))?.status()).toBe(404);

    await page.getByRole("button", { name: "Veröffentlichen" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Alles gespeichert" })).toBeVisible();

    // Im Hauptmenü und aufrufbar
    await visitor.goto(main("/"));
    const nav = visitor.getByRole("navigation", { name: "Hauptnavigation" });
    await nav.getByRole("link", { name: navLabel, exact: true }).click();
    await expect(visitor).toHaveURL(main(`/${slug}`));
    await expect(visitor.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await visitorContext.close();
  });

  test("Firmendaten ändern – die Fußzeile zeigt die neue Telefonnummer", async ({ page, browser }) => {
    const phone = `0711 ${String(Math.floor(100_000 + Math.random() * 899_999))}`;

    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main("/admin/website/firmendaten"));
    await page.getByLabel("Telefonnummer", { exact: true }).fill(phone);
    await page.getByRole("button", { name: /^Aus der Telefonnummer übernehmen/ }).click();
    await page.getByRole("button", { name: "Firmendaten speichern" }).click();
    await expect(page.getByText(/^Firmendaten gespeichert\./)).toBeVisible();
    await expect(page.getByText("Ungespeicherte Änderungen")).toHaveCount(0);

    const visitorContext = await newContext(browser);
    const visitor = await visitorContext.newPage();
    await visitor.goto(main("/kontakt"));
    const footer = visitor.getByRole("contentinfo");
    await expect(footer.getByRole("link", { name: phone })).toBeVisible();
    await expect(footer.getByRole("link", { name: phone })).toHaveAttribute("href", `tel:+49711${phone.slice(5)}`);
    await visitorContext.close();
  });

  test("Techniker hat keinen Zugriff auf den Website-Editor", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.tech.email);
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" }).first();
    await expect(nav.getByRole("link", { name: /^Website/ })).toHaveCount(0);

    for (const path of ["/admin/website", "/admin/website/firmendaten", "/admin/website/seiten/neu", "/admin/website/medien"]) {
      await page.goto(main(path));
      await expect(page, path).toHaveURL(main("/admin?hinweis=kein-zugriff"));
    }
    await expect(page.getByText("Kein Zugriff")).toBeVisible();
  });
});

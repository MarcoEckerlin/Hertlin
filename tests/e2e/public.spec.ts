import { PORT } from "./env";
import { test, expect, loginStaff, main, newContext, pngFile, unique, ACCOUNTS, PNG_1PX } from "./fixtures";
import { lastMailTo, linkIn } from "./mail";

const PAGES = [
  "/",
  "/leistungen",
  "/unternehmen",
  "/privatkunden",
  "/ueber-uns",
  "/support",
  "/kontakt",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/login",
  "/status",
];

test.describe("Website", () => {
  test("alle Seiten der Website sind erreichbar", async ({ page }) => {
    for (const path of PAGES) {
      const response = await page.goto(main(path));
      expect(response?.status(), `Status für ${path}`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 }).first(), `Überschrift auf ${path}`).toBeVisible();
    }
  });

  test("Hauptmenü führt zu den Seiten und markiert die aktuelle", async ({ page }) => {
    await page.goto(main("/"));
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
    const expected = [
      { label: "Leistungen", path: "/leistungen" },
      { label: "Für Unternehmen", path: "/unternehmen" },
      { label: "Für Privatkunden", path: "/privatkunden" },
      { label: "Über uns", path: "/ueber-uns" },
      { label: "Kontakt", path: "/kontakt" },
    ];
    for (const item of expected) {
      await nav.getByRole("link", { name: item.label, exact: true }).click();
      await expect(page).toHaveURL(main(item.path));
      await expect(nav.getByRole("link", { name: item.label, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    }
    // Logo führt zurück zur Startseite
    await page.getByRole("link", { name: /zur Startseite/ }).first().click();
    await expect(page).toHaveURL(main("/"));
  });

  test("unbekannte Seite liefert 404 mit Weg zurück", async ({ page }) => {
    const response = await page.goto(main("/gibt-es-nicht-xyz"));
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: /Startseite/ }).first()).toBeVisible();
  });
});

test.describe("Anfrage von Neukunden mit Live-Chat", () => {
  test("Firma stellt Anfrage, chattet mit Hertlin und sieht die Antwort live", async ({ page, browser }) => {
    const company = unique("Testfirma Anfrage");
    const name = "Petra Neumann";
    const email = `anfrage-${Date.now()}@firma.example`;

    await page.goto(main("/kontakt"));
    await expect(page.getByRole("radio", { name: "Unternehmen" })).toBeChecked();
    await page.locator("#anfrage-name").fill(name);
    await page.locator("#anfrage-companyName").fill(company);
    await page.locator("#anfrage-email").fill(email);
    await page.locator("#anfrage-topic").selectOption({ index: 1 });
    await page.locator("#anfrage-message").fill("Wir sind zwölf Leute im Büro und suchen eine laufende IT-Betreuung.");
    await page.locator("#anfrage-privacy").check();
    await page.getByRole("button", { name: "Anfrage senden" }).click();

    await expect(page.getByRole("heading", { name: "Danke, Ihre Anfrage ist angekommen." })).toBeVisible();
    const numberText = await page.locator("strong", { hasText: /^A-\d{5}$/ }).textContent();
    expect(numberText).toMatch(/^A-\d{5}$/);
    const inquiryId = Number(numberText!.slice(2));

    // Persönlicher Chat-Link
    await page.getByRole("link", { name: "Chat öffnen" }).click();
    await expect(page).toHaveURL(/\/anfrage\/[A-Za-z0-9_-]{10,}$/);
    await expect(page.getByText(`Ihre Anfrage ${numberText}`)).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();

    const guestMessage = unique("Frage vom Interessenten");
    await page.getByRole("textbox", { name: "Ihre Nachricht" }).fill(guestMessage);
    await page.getByRole("button", { name: "Senden", exact: true }).click();
    await expect(page.getByText(guestMessage)).toBeVisible();

    // Bestätigung mit Chat-Link per E-Mail
    await expect.poll(async () => (await lastMailTo(email))?.body ?? "").toContain("/anfrage/");

    // Merker: Erscheint die Antwort, ohne dass die Seite neu geladen wurde?
    await page.evaluate(() => {
      (window as unknown as { __ohneNeuladen?: boolean }).__ohneNeuladen = true;
    });

    // Verwaltung sieht Anfrage und Chat und antwortet
    const staffContext = await newContext(browser);
    const staff = await staffContext.newPage();
    await loginStaff(staff, ACCOUNTS.admin.email);
    await staff.goto(main("/admin/anfragen"));
    await expect(staff.getByRole("link", { name: company })).toBeVisible();
    await staff.getByRole("link", { name: company }).click();
    await expect(staff).toHaveURL(main(`/admin/anfragen/${inquiryId}`));
    await expect(staff.getByRole("heading", { level: 1, name: company })).toBeVisible();
    await expect(staff.getByText(guestMessage)).toBeVisible();

    const reply = unique("Antwort von Hertlin");
    await staff.getByLabel(`Antwort an ${name}`).fill(reply);
    await staff.getByRole("button", { name: "Senden", exact: true }).click();
    await expect(staff.getByText(reply)).toBeVisible();

    // Interessent sieht die Antwort live
    await expect(page.getByText(reply)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __ohneNeuladen?: boolean }).__ohneNeuladen)).toBe(true);

    await staffContext.close();
  });
});

test.describe("Hilfe-Formular für Privatkunden", () => {
  test("Meldung mit Foto, Status-Link, Antwort von Hertlin und Anhänge herunterladen", async ({ page, browser }) => {
    const subject = unique("Laptop startet nicht");
    const email = `privat-${Date.now()}@privat.example`;

    await page.goto(main("/privatkunden#hilfe-anfordern"));
    await page.locator("#hilfe-category").selectOption({ index: 1 });
    await page.locator("#hilfe-subject").fill(subject);
    await page.locator("#hilfe-description").fill("Seit dem letzten Update bleibt der Bildschirm nach dem Einschalten schwarz.");
    await page.locator("#hilfe-attachments").setInputFiles(pngFile("fehlermeldung.png"));
    await expect(page.getByText("fehlermeldung.png")).toBeVisible();
    await page.locator("#hilfe-name").fill("Karin Sommer");
    await page.locator("#hilfe-email").fill(email);
    await page.locator("#hilfe-phone").fill("0171 2345678");
    await page.locator("#hilfe-privacy").check();
    await page.getByRole("button", { name: "Meldung absenden" }).click();

    await expect(page.getByRole("heading", { name: "Danke, Ihre Meldung ist angekommen." })).toBeVisible();
    const number = await page.locator("strong", { hasText: /^T-\d{5}$/ }).textContent();
    const ticketId = Number(number!.slice(2));

    // Status-Link aus der Bestätigung und aus der E-Mail führen zum selben Ticket
    await expect.poll(async () => (await lastMailTo(email))?.body ?? "").toMatch(/\/status\/[A-Za-z0-9_-]+/);
    const mailLink = linkIn((await lastMailTo(email))!.body, new RegExp(`http://localhost:${PORT}/status/[A-Za-z0-9_-]+`));
    expect(mailLink).toBeTruthy();

    await page.getByRole("link", { name: "Status ansehen" }).click();
    await expect(page).toHaveURL(mailLink!);
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(page.getByText("Ihr Ticket ist bei uns eingegangen")).toBeVisible();

    // Eigenes Foto herunterladen
    const ownAttachment = page.getByRole("list", { name: "Anhänge" }).getByRole("link", { name: /fehlermeldung\.png/ });
    await expect(ownAttachment).toBeVisible();
    const ownHref = await ownAttachment.getAttribute("href");
    const ownDownload = await page.request.get(main(ownHref!));
    expect(ownDownload.status()).toBe(200);
    expect(ownDownload.headers()["content-type"]).toContain("image/png");
    expect(Buffer.compare(await ownDownload.body(), PNG_1PX)).toBe(0);

    // Hertlin antwortet mit Anhang
    const staffContext = await newContext(browser);
    const staff = await staffContext.newPage();
    await loginStaff(staff, ACCOUNTS.tech.email);
    await staff.goto(main(`/admin/tickets/${ticketId}`));
    await expect(staff.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    const reply = unique("Bitte halten Sie den Einschaltknopf 30 Sekunden gedrückt");
    await staff.getByLabel("Nachricht", { exact: true }).fill(reply);
    await staff.locator("#antwort-attachments").setInputFiles(pngFile("anleitung.png"));
    await staff.getByRole("button", { name: "Antwort senden" }).click();
    await expect(staff.getByText(reply)).toBeVisible();
    await staffContext.close();

    // Privatkunde sieht die Antwort (live) und kann den Anhang laden
    await expect(page.getByText(reply)).toBeVisible();
    const staffAttachment = page.getByRole("link", { name: /anleitung\.png/ });
    await expect(staffAttachment).toBeVisible();
    const staffDownload = await page.request.get(main((await staffAttachment.getAttribute("href"))!));
    expect(staffDownload.status()).toBe(200);
    expect(staffDownload.headers()["content-type"]).toContain("image/png");

    // Privatkunde antwortet über den Status-Link
    const answer = unique("Danke, jetzt startet er wieder");
    await page.getByRole("textbox", { name: "Ihre Nachricht" }).fill(answer);
    await page.getByRole("button", { name: "Nachricht senden" }).click();
    await expect(page.getByText(answer)).toBeVisible();
  });

  test("Status-Link lässt sich über /status neu anfordern", async ({ page }) => {
    const subject = unique("Drucker druckt nicht");
    const email = `statuslink-${Date.now()}@privat.example`;

    await page.goto(main("/privatkunden#hilfe-anfordern"));
    await page.locator("#hilfe-category").selectOption({ index: 1 });
    await page.locator("#hilfe-subject").fill(subject);
    await page.locator("#hilfe-description").fill("Der Drucker zeigt einen Papierstau an, es steckt aber kein Papier fest.");
    await page.locator("#hilfe-name").fill("Gerd Winter");
    await page.locator("#hilfe-email").fill(email);
    await page.locator("#hilfe-phone").fill("0171 9876543");
    await page.locator("#hilfe-privacy").check();
    await page.getByRole("button", { name: "Meldung absenden" }).click();
    await expect(page.getByRole("heading", { name: "Danke, Ihre Meldung ist angekommen." })).toBeVisible();
    const number = (await page.locator("strong", { hasText: /^T-\d{5}$/ }).textContent())!;
    await expect.poll(async () => (await lastMailTo(email))?.subject ?? "").toContain(number);

    // Falsche Kombination: gleiche neutrale Antwort, keine Mail
    await page.goto(main("/status"));
    await page.getByLabel("E-Mail-Adresse").fill("niemand@privat.example");
    await page.getByLabel("Ticketnummer").fill(number);
    await page.getByRole("button", { name: "Link zusenden" }).click();
    await expect(page.getByText(/Wenn E-Mail-Adresse und Ticketnummer zusammenpassen/)).toBeVisible();

    // Richtige Kombination: Link kommt per Mail
    await page.goto(main("/status"));
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await page.getByLabel("Ticketnummer").fill(number);
    await page.getByRole("button", { name: "Link zusenden" }).click();
    await expect(page.getByText(/Wenn E-Mail-Adresse und Ticketnummer zusammenpassen/)).toBeVisible();

    await expect.poll(async () => (await lastMailTo(email))?.subject ?? "").toBe(`Ihr Link zu ${number}`);
    const link = linkIn((await lastMailTo(email))!.body, new RegExp(`http://localhost:${PORT}/status/[A-Za-z0-9_-]+`));
    expect(link).toBeTruthy();
    await page.goto(link!);
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();

    // Ungültiger Link: verständliche Seite
    await page.goto(main("/status/das-ist-kein-gueltiger-link-123"));
    await expect(page.getByRole("heading", { name: "Dieser Link funktioniert leider nicht" })).toBeVisible();
  });
});

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  test,
  expect,
  createPortalTicket,
  fetchInPage,
  loginPortal,
  loginStaff,
  main,
  newContext,
  portal,
  ticketNumber,
  unique,
  ACCOUNTS,
} from "./fixtures";
import { lastMailTo, linkIn } from "./mail";

test.describe("Verwaltung: Tickets bearbeiten", () => {
  test("interne Notiz bleibt intern, Antwort und Statuswechsel erreichen den Kunden", async ({ page, browser }) => {
    // Kunde meldet eine Störung
    const customerContext = await newContext(browser);
    const customer = await customerContext.newPage();
    await loginPortal(customer, "muster", ACCOUNTS.berger.email);
    const subject = unique("Outlook fragt ständig nach dem Passwort");
    const ticketId = await createPortalTicket(customer, "muster", {
      subject,
      description: "Seit gestern kommt alle paar Minuten die Passwortabfrage.",
    });

    await loginStaff(page, ACCOUNTS.tech.email);
    await page.goto(main(`/admin/tickets/${ticketId}`));
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();

    // Interne Notiz
    const note = unique("Intern: Kennwort im Tresor geprüft, Konto ist gesperrt");
    await page.getByText("Interne Notiz", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Interne Notiz schreiben" })).toBeVisible();
    await page.getByLabel("Notiz", { exact: true }).fill(note);
    await page.getByRole("button", { name: "Interne Notiz speichern" }).click();
    await expect(page.getByText(note)).toBeVisible();

    // Antwort an den Kunden mit Rückfrage
    const reply = unique("Bitte melden Sie sich einmal ab und wieder an");
    await page.getByText("Antwort an Kunden", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Antwort schreiben" })).toBeVisible();
    await page.getByLabel("Nachricht", { exact: true }).fill(reply);
    await page.getByLabel("Status danach").selectOption({ label: "Wartet auf Kunde" });
    await page.getByRole("button", { name: "Antwort senden" }).click();
    await expect(page.getByText(reply)).toBeVisible();

    // Kunde sieht Antwort und Rückfrage, aber nie die Notiz
    await customer.goto(portal("muster", `/tickets/${ticketId}`));
    await expect(customer.getByText(reply)).toBeVisible();
    await expect(customer.getByText("Rückfrage an Sie").first()).toBeVisible();
    await expect(customer.getByText(note)).toHaveCount(0);
    const raw = await fetchInPage(customer, `/tickets/${ticketId}`);
    expect(Buffer.from(raw.base64, "base64").toString("utf8")).not.toContain(note);

    // Statuswechsel in der Verwaltung
    await page.getByLabel("Status", { exact: true }).selectOption({ label: "Gelöst" });
    await page.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(page.getByText("Gelöst", { exact: true }).first()).toBeVisible();
    await customer.reload();
    await expect(customer.getByText("Gelöst", { exact: true }).first()).toBeVisible();
    await expect(customer.getByRole("button", { name: "Wieder öffnen" })).toBeVisible();

    // Keine E-Mail enthält die interne Notiz
    const log = await readFile(path.join(process.cwd(), "storage", "mails.log"), "utf8").catch(() => "");
    expect(log).not.toContain(note);
    await customerContext.close();
  });

  test("Ticket für einen Privatkunden anlegen – der Status-Link funktioniert", async ({ page, browser }) => {
    await loginStaff(page, ACCOUNTS.tech.email);
    await page.goto(main("/admin/tickets/neu"));
    const subject = unique("Telefonische Meldung: Router blinkt rot");
    const email = `anrufer-${Date.now()}@privat.example`;

    await page.locator("#neu-customer").selectOption({ label: "Privatkunde (ohne Kundenkonto)" });
    await page.locator("#neu-contactName").fill("Herbert Lang");
    await page.locator("#neu-contactEmail").fill(email);
    await page.locator("#neu-contactPhone").fill("0170 5550123");
    await page.locator("#neu-subject").fill(subject);
    await page.locator("#neu-body").fill("Kunde hat angerufen: Seit dem Gewitter blinkt der Router rot, kein Internet.");
    await page.getByRole("button", { name: "Ticket anlegen" }).click();

    await expect(page).toHaveURL(/\/admin\/tickets\/\d+\?neu=1/);
    const ticketId = Number(new URL(page.url()).pathname.split("/").pop());
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(page.getByText("Status-Link des Kunden")).toBeVisible();

    // Status-Link aus der Bestätigungsmail
    await expect.poll(async () => (await lastMailTo(email))?.subject ?? "").toContain(ticketNumber(ticketId));
    const link = linkIn((await lastMailTo(email))!.body, /http:\/\/localhost:3200\/status\/[A-Za-z0-9_-]+/);
    expect(link).toBeTruthy();

    const guestContext = await newContext(browser);
    const guest = await guestContext.newPage();
    await guest.goto(link!);
    await expect(guest.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(guest.getByText("Seit dem Gewitter blinkt der Router rot")).toBeVisible();
    // Status-Link-Seiten werden nicht indexiert und geben keinen Referrer weiter
    await expect(guest.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(guest.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    await guestContext.close();
  });
});

test.describe("Verwaltung: Kunden und Team", () => {
  test("Firmenkunde mit eigener Subdomain anlegen – Einladung einlösen – Portal funktioniert", async ({ page, browser }) => {
    const slug = `e2e${Date.now().toString(36)}`;
    const companyName = unique("Elektro Test GmbH");
    const contactEmail = `chefin-${Date.now()}@elektro.example`;

    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main("/admin/kunden/neu"));
    await page.locator("#company-name").fill(companyName);
    await page.locator("#company-slug").fill(slug);
    await page.locator("#contact-name").fill("Sandra Elektra");
    await page.locator("#contact-email").fill(contactEmail);
    await page.getByRole("button", { name: "Firmenkunde anlegen" }).click();

    await expect(page.getByText("Firmenkunde angelegt")).toBeVisible();
    await expect(page.getByText(`${slug}.localhost:3200`).first()).toBeVisible();

    // Einladung einlösen
    await expect.poll(async () => (await lastMailTo(contactEmail))?.body ?? "").toContain("/passwort/");
    const link = linkIn(
      (await lastMailTo(contactEmail))!.body,
      new RegExp(`http://${slug}\\.localhost:3200/passwort/[A-Za-z0-9_-]+`),
    );
    expect(link).toBeTruthy();

    const contactContext = await newContext(browser);
    const contact = await contactContext.newPage();
    // Neues Portal ist sofort unter der eigenen Subdomain erreichbar
    const portalLogin = await contact.goto(portal(slug, "/login"));
    expect(portalLogin?.status()).toBe(200);
    await contact.goto(link!);
    await contact.getByLabel("Neues Passwort").fill("elektro-passwort-2026");
    await contact.getByLabel("Passwort wiederholen").fill("elektro-passwort-2026");
    await contact.getByRole("button", { name: "Passwort speichern und anmelden" }).click();
    await expect(contact).toHaveURL(portal(slug, "/"));
    await expect(contact.getByText(companyName).first()).toBeVisible();

    // Ticket im neuen Portal anlegen
    const subject = unique("Erstes Ticket im neuen Portal");
    const ticketId = await createPortalTicket(contact, slug, { subject, description: "Testmeldung aus dem neuen Portal." });

    // Verwaltung sieht das Ticket beim neuen Kunden
    await page.goto(main(`/admin/tickets/${ticketId}`));
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(page.getByText(companyName).first()).toBeVisible();

    // Abmelden und erneut über die Anmeldeseite des neuen Portals anmelden
    await contactContext.clearCookies();
    await loginPortal(contact, slug, contactEmail, "elektro-passwort-2026");
    await contactContext.close();
  });

  test("Techniker ins Team einladen – Einladung einlösen – Verwaltung ohne Kosten", async ({ page, browser }) => {
    const email = `techniker-${Date.now()}@hertlin.de`;
    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main("/admin/team/neu"));
    await page.locator("#staff-name").fill("Mara Schuster");
    await page.locator("#staff-email").fill(email);
    await expect(page.getByRole("radio", { name: /^Techniker/ })).toBeChecked();
    await page.getByRole("button", { name: "Einladen" }).click();
    await expect(page.getByText("Teammitglied angelegt")).toBeVisible();

    await page.goto(main("/admin/team"));
    await expect(page.getByText("Mara Schuster")).toBeVisible();

    await expect.poll(async () => (await lastMailTo(email))?.body ?? "").toContain("/admin/passwort/");
    const link = linkIn((await lastMailTo(email))!.body, /http:\/\/localhost:3200\/admin\/passwort\/[A-Za-z0-9_-]+/);
    expect(link).toBeTruthy();

    const techContext = await newContext(browser);
    const tech = await techContext.newPage();
    await tech.goto(link!);
    await tech.getByLabel("Neues Passwort").fill("techniker-passwort-2026");
    await tech.getByLabel("Passwort wiederholen").fill("techniker-passwort-2026");
    await tech.getByRole("button", { name: "Passwort speichern und anmelden" }).click();
    await expect(tech).toHaveURL(main("/admin"));
    const nav = tech.getByRole("navigation", { name: "Hauptnavigation" }).first();
    await expect(nav.getByRole("link", { name: /^Tickets/ })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Kosten/ })).toHaveCount(0);
    await techContext.close();
  });
});

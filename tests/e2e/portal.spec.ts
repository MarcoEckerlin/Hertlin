import { PORT } from "./env";
import {
  test,
  expect,
  createPortalTicket,
  fetchInPage,
  loginPortal,
  newContext,
  portal,
  unique,
  ACCOUNTS,
  PNG_1PX,
} from "./fixtures";
import { lastMailTo, linkIn } from "./mail";

test.describe("Kundenportal: Tickets", () => {
  test("Störung mit Anhang melden, antworten, als gelöst markieren und wieder öffnen", async ({ page }) => {
    await loginPortal(page, "muster", ACCOUNTS.berger.email);
    const subject = unique("Scanner im Sekretariat meldet Fehler");
    const ticketId = await createPortalTicket(page, "muster", {
      type: "Störung",
      subject,
      description: "Der Scanner bricht jeden Scan mit Fehler 0x42 ab.",
      attachment: "scanner-fehler.png",
    });

    // Detailansicht
    await expect(page.getByText("Ihr Ticket ist angelegt")).toBeVisible();
    await expect(page.getByText("Neu", { exact: true }).first()).toBeVisible();
    const attachment = page.getByRole("list", { name: "Anhänge" }).getByRole("link", { name: /scanner-fehler\.png/ });
    await expect(attachment).toBeVisible();
    const download = await fetchInPage(page, (await attachment.getAttribute("href"))!);
    expect(download.status).toBe(200);
    expect(download.contentType).toContain("image/png");
    expect(download.base64).toBe(PNG_1PX.toString("base64"));

    // Ticket steht in der Liste
    await page.goto(portal("muster", "/tickets"));
    await expect(page.getByRole("link", { name: subject })).toBeVisible();
    await page.getByRole("link", { name: subject }).click();
    await expect(page).toHaveURL(portal("muster", `/tickets/${ticketId}`));

    // Antwort schreiben
    const message = unique("Nachtrag: betrifft auch den zweiten Scanner");
    await page.getByRole("textbox", { name: "Ihre Nachricht" }).fill(message);
    await page.getByRole("button", { name: "Nachricht senden" }).click();
    await expect(page.getByText(message)).toBeVisible();

    // Als gelöst markieren
    await page.getByRole("button", { name: "Problem ist gelöst" }).click();
    await expect(page.getByText("Danke für die Rückmeldung")).toBeVisible();
    await expect(page.getByText("Gelöst", { exact: true }).first()).toBeVisible();

    // Wieder öffnen
    await page.getByRole("button", { name: "Wieder öffnen" }).click();
    await expect(page.getByText("Das Ticket ist wieder offen")).toBeVisible();
    await expect(page.getByRole("button", { name: "Problem ist gelöst" })).toBeVisible();
  });
});

test.describe("Kundenportal: Unterkunden und Benutzer", () => {
  test("Hauptansprechpartnerin legt Unterkunde und Benutzer an, der Benutzer sieht nur seine Unterkunde", async ({
    page,
    browser,
  }) => {
    await loginPortal(page, "muster", ACCOUNTS.berger.email);

    // Unterkunde anlegen
    const subName = unique("Filiale Augsburg");
    await page.goto(portal("muster", "/unterkunden/neu"));
    await page.getByLabel("Name der Unterkunde").fill(subName);
    await page.getByLabel("Ort").fill("Augsburg");
    await page.getByRole("button", { name: "Unterkunde anlegen" }).click();
    await expect(page).toHaveURL(/\/unterkunden\/[^/?]+\?angelegt=1/);
    await expect(page.getByRole("heading", { level: 1, name: subName })).toBeVisible();

    // Benutzer in der Unterkunde anlegen (als Hauptansprechpartner der Unterkunde)
    const email = `filiale-${Date.now()}@muster.example`;
    const name = "Lena Hoffmann";
    await page.getByRole("link", { name: "Benutzer anlegen" }).click();
    await expect(page).toHaveURL(/\/benutzer\/neu\?firma=/);
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("E-Mail-Adresse").fill(email);
    await expect(page.getByLabel("Firma oder Unterkunde").locator("option:checked")).toHaveText(subName);
    await page.getByRole("radio", { name: /^Hauptansprechpartner/ }).check();
    await page.getByRole("button", { name: "Benutzer anlegen und einladen" }).click();
    await expect(page.getByText(`${name} ist angelegt (${subName})`)).toBeVisible();

    // Zwei Tickets: eines für die Unterkunde, eines für die Firma selbst
    const subTicket = unique("Kassensystem Filiale druckt keine Bons");
    await createPortalTicket(page, "muster", {
      subject: subTicket,
      description: "Seit heute früh kommt kein Bon mehr aus dem Drucker.",
      company: `${subName} (Unterkunde)`,
    });
    const rootTicket = unique("Zentrale: Server-Wartung planen");
    await createPortalTicket(page, "muster", {
      type: "Anfrage",
      subject: rootTicket,
      description: "Bitte einen Termin für die Wartung vorschlagen.",
      company: "Muster Steuerberatung GmbH",
    });

    // Einladung aus der Mail einlösen
    await expect.poll(async () => (await lastMailTo(email))?.body ?? "").toContain("/passwort/");
    const link = linkIn((await lastMailTo(email))!.body, new RegExp(`http://muster\\.localhost:${PORT}/passwort/[A-Za-z0-9_-]+`));
    expect(link).toBeTruthy();

    const inviteeContext = await newContext(browser);
    const invitee = await inviteeContext.newPage();
    await invitee.goto(link!);
    await invitee.getByLabel("Neues Passwort").fill("filiale-passwort-2026");
    await invitee.getByLabel("Passwort wiederholen").fill("filiale-passwort-2026");
    await invitee.getByRole("button", { name: "Passwort speichern und anmelden" }).click();
    await expect(invitee).toHaveURL(portal("muster", "/"));
    await expect(invitee.getByText(name).first()).toBeVisible();

    // Nur Tickets der eigenen Unterkunde
    await invitee.goto(portal("muster", "/tickets"));
    await expect(invitee.getByRole("link", { name: subTicket })).toBeVisible();
    await expect(invitee.getByRole("link", { name: rootTicket })).toHaveCount(0);
    await expect(invitee.getByRole("link", { name: "Drucker im Empfang druckt nur noch leere Seiten" })).toHaveCount(0);

    // Direkter Aufruf eines Tickets der Firma: nicht gefunden
    await page.goto(portal("muster", "/tickets"));
    const rootHref = await page.getByRole("link", { name: rootTicket }).getAttribute("href");
    const response = await invitee.goto(portal("muster", rootHref!));
    expect(response?.status()).toBe(404);

    await inviteeContext.close();
  });

  test("Mitarbeiter sieht keine fremden Tickets und keine Benutzerverwaltung", async ({ page, browser }) => {
    // Ticket der Hauptansprechpartnerin
    const bergerContext = await newContext(browser);
    const berger = await bergerContext.newPage();
    await loginPortal(berger, "muster", ACCOUNTS.berger.email);
    const subject = unique("Vertrauliche Anfrage der Kanzleileitung");
    const foreignId = await createPortalTicket(berger, "muster", {
      type: "Anfrage",
      subject,
      description: "Angebot für neue Notebooks der Partner.",
    });
    await bergerContext.close();

    await loginPortal(page, "muster", ACCOUNTS.yilmaz.email);

    // Eigenes Ticket ja, fremdes nein
    await page.goto(portal("muster", "/tickets"));
    await expect(page.getByRole("link", { name: "Drucker im Empfang druckt nur noch leere Seiten" })).toBeVisible();
    await expect(page.getByRole("link", { name: subject })).toHaveCount(0);

    // URL-Manipulation
    const response = await page.goto(portal("muster", `/tickets/${foreignId}`));
    expect(response?.status()).toBe(404);
    await expect(page.getByText(subject)).toHaveCount(0);

    // Keine Benutzer- und Unterkundenverwaltung
    await page.goto(portal("muster", "/benutzer"));
    await expect(page).toHaveURL(portal("muster", "/?hinweis=kein-zugriff"));
    await expect(page.getByText("Für diese Seite fehlen Ihrem Zugang die Rechte.")).toBeVisible();
    await page.goto(portal("muster", "/unterkunden/neu"));
    await expect(page).toHaveURL(portal("muster", "/?hinweis=kein-zugriff"));
  });
});

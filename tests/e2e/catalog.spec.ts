import type { Locator, Page } from "@playwright/test";
import { test, expect, createPortalTicket, loginPortal, loginStaff, main, newContext, unique, ACCOUNTS } from "./fixtures";

/**
 * Kostenkatalog („Standardpositionen“): Auswahl im Ticket, neue Positionen landen im Katalog,
 * Techniker-Positionen ohne Preis ergänzt die Verwaltung. Dazu der zuständige Standort im Ticket.
 */

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Ticket über „Ticket anlegen“ in der Verwaltung (ohne E-Mail an den Kunden). Gibt die Nummer zurück. */
async function createStaffTicket(page: Page, opts: { customer: string; subject: string; location?: string }): Promise<number> {
  await page.goto(main("/admin/tickets/neu"));
  await page.getByRole("combobox", { name: "Kunde", exact: true }).selectOption({ label: opts.customer });
  await page.getByLabel("Betreff").fill(opts.subject);
  await page.getByRole("textbox", { name: "Beschreibung", exact: true }).fill("Für die Tests der Leistungserfassung angelegt.");
  if (opts.location) await page.getByLabel("Standort").selectOption({ label: opts.location });
  await page.getByLabel("Kunden per E-Mail informieren").uncheck();
  await page.getByRole("button", { name: "Ticket anlegen" }).click();
  // Die Rückmeldung „?neu=1“ verschwindet nach dem Anzeigen aus der Adresse
  await expect(page).toHaveURL(/\/admin\/tickets\/\d+(\?neu=1.*)?$/);
  return Number(new URL(page.url()).pathname.split("/").pop());
}

function costSection(page: Page): Locator {
  return page.locator("#kosten");
}

/** „Position erfassen“ aufklappen – eingeklappt stehen dort nur der Knopf und die Schnellwahl */
async function openCostForm(section: Locator) {
  const toggle = section.getByRole("button", { name: "Position erfassen" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await expect(section.locator("#kosten-erfassen")).toBeVisible();
}

/** Abschnitt „Leistungen und Material“ mit aufgeklapptem Erfassungsformular */
async function openCostSection(page: Page): Promise<Locator> {
  const section = costSection(page);
  await openCostForm(section);
  return section;
}

/** Zeile im Kostenkatalog (Verwaltung) zu einer Bezeichnung */
function catalogRow(page: Page, name: string): Locator {
  return page.getByRole("row").filter({ has: page.getByRole("link", { name, exact: true }) });
}

test.describe("Kostenkatalog im Ticket", () => {
  test("Katalogposition wählen füllt alles vor, der Preis kommt aus dem Katalog", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    const ticketId = await createStaffTicket(page, { customer: "Bäckerei Beispiel", subject: unique("Kasse im Filialnetz") });
    await page.goto(main(`/admin/tickets/${ticketId}`));
    const section = await openCostSection(page);

    await section.getByLabel("Katalog durchsuchen").fill("kilometer");
    await expect(section.getByRole("radio", { name: /Arbeitszeit Technik/ })).toHaveCount(0);
    await section.getByRole("radio", { name: /Fahrtkosten je Kilometer/ }).check();
    await expect(section.getByLabel("Menge (km)")).toHaveValue("20");
    await expect(section.getByLabel("Einzelpreis (€)")).toHaveValue("0,60");
    await expect(section.getByLabel("Gesamtbetrag")).toHaveText(euro.format(12));

    await section.getByLabel("Menge (km)").fill("35");
    await expect(section.getByLabel("Gesamtbetrag")).toHaveText(euro.format(21));
    await section.getByLabel("Notiz").fill("Ulm und zurück");
    await expect(section.getByText("„Fahrtkosten je Kilometer – Ulm und zurück“")).toBeVisible();
    await section.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByText(`Anfahrt über ${euro.format(21)} hinzugefügt.`)).toBeVisible();

    const row = section.getByRole("row").filter({ hasText: "Fahrtkosten je Kilometer – Ulm und zurück" });
    await expect(row).toContainText("35 km");
    await expect(row).toContainText(euro.format(0.6));
    await expect(row).toContainText(euro.format(21));
    await expect(row).toContainText(`erbracht von ${ACCOUNTS.admin.name}`);

    // Im Katalog gezählt
    await page.goto(main("/admin/kosten/katalog?suche=kilometer"));
    await expect(catalogRow(page, "Fahrtkosten je Kilometer")).toContainText(/\d+×/);
  });

  test("Neue Position landet im Katalog und steht danach zur Auswahl", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    const ticketId = await createStaffTicket(page, { customer: "Bäckerei Beispiel", subject: unique("Neuer Router") });
    const name = unique("Router einrichten");
    await page.goto(main(`/admin/tickets/${ticketId}`));
    const section = await openCostSection(page);

    await section.getByRole("radio", { name: "Neue Position" }).check();
    await section.getByLabel("Bezeichnung").fill(name);
    await section.getByLabel("Art", { exact: true }).selectOption({ label: "Arbeitszeit" });
    await section.getByLabel("Menge").fill("1,5");
    await section.getByLabel("Einzelpreis (€)").fill("80");
    await expect(section.getByLabel("In den Katalog aufnehmen")).toBeChecked();
    await section.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByText(`Arbeitszeit über ${euro.format(120)} hinzugefügt. Sie steht ab jetzt auch im Katalog.`)).toBeVisible();

    // Gleiche Bezeichnung in anderer Schreibweise: Hinweis auf den vorhandenen Eintrag
    await section.getByRole("radio", { name: "Neue Position" }).check();
    await section.getByLabel("Bezeichnung").fill(`  ${name.toUpperCase()} `);
    await expect(section.getByText(`„${name}“ steht schon im Katalog.`)).toBeVisible();
    await expect(section.getByLabel("In den Katalog aufnehmen")).toHaveCount(0);
    await section.getByRole("button", { name: "Aus dem Katalog wählen" }).click();
    await expect(section.getByRole("radio", { name: new RegExp(name) })).toBeChecked();
    await expect(section.getByLabel("Einzelpreis (€)")).toHaveValue("80,00");
    await expect(section.getByLabel("Menge (Std.)")).toHaveValue("1");

    // Katalog: genau ein Eintrag mit Preis und Einheit
    await page.goto(main(`/admin/kosten/katalog?suche=${encodeURIComponent(name)}`));
    const row = catalogRow(page, name);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(euro.format(80));
    await expect(row).toContainText("Std.");
    await expect(row).toContainText("1×");
    await expect(row).toContainText(`angelegt von ${ACCOUNTS.admin.name}`);
  });

  test("Techniker erfasst eine Position ohne Preis – die Verwaltung trägt ihn nach", async ({ page, browser }) => {
    const name = unique("Patchkabel 2 m");
    const subject = unique("Kabel im Lager getauscht");

    await loginStaff(page, ACCOUNTS.tech.email);
    const ticketId = await createStaffTicket(page, { customer: "Bäckerei Beispiel", subject });
    await page.goto(main(`/admin/tickets/${ticketId}`));
    const section = await openCostSection(page);
    await section.getByRole("radio", { name: "Neue Position" }).check();
    await section.getByLabel("Bezeichnung").fill(name);
    await section.getByLabel("Art", { exact: true }).selectOption({ label: "Material" });
    await section.getByLabel("Einheit").selectOption("Stk.");
    await section.getByLabel("Menge").fill("3");
    await expect(section.getByLabel("Einzelpreis (€)")).toHaveCount(0);
    await expect(section.getByLabel("In den Katalog aufnehmen")).toBeChecked();
    await section.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByText(`Hinzugefügt: „${name}“ (3 Stk.). Sie steht ab jetzt auch im Katalog.`)).toBeVisible();
    await expect(section.getByRole("row").filter({ hasText: name })).not.toContainText("Preis fehlt");

    // Verwaltung: Hinweis auf der Übersicht und im Ticket
    const adminContext = await newContext(browser);
    const admin = await adminContext.newPage();
    await loginStaff(admin, ACCOUNTS.admin.email);
    const card = admin.getByRole("region", { name: /Positionen ohne Preis/ });
    await expect(card).toBeVisible();
    await card.getByRole("link", { name: new RegExp(subject) }).click();
    await expect(admin).toHaveURL(new RegExp(`/admin/tickets/${ticketId}#kosten$`));

    const adminSection = costSection(admin);
    await expect(adminSection.getByRole("heading", { name: "Preis fehlt bei 1 Position" })).toBeVisible();
    const row = adminSection.getByRole("row").filter({ hasText: name });
    await expect(row).toContainText("Preis fehlt");
    await expect(adminSection.getByRole("row").filter({ hasText: "Summe" })).toContainText("1 Position ohne Preis nicht enthalten");

    const price = adminSection.getByLabel(`Einzelpreis (€) je Stk.: ${name}`);
    await price.fill("4,50");
    await expect(adminSection.getByText(`= ${euro.format(13.5)}`)).toBeVisible();
    await adminSection.getByLabel(`Preis auch im Katalog speichern („${name}“)`).check();
    await adminSection.getByRole("button", { name: "Preis speichern" }).click();
    await expect(admin.getByText("Der Preis ist gespeichert und gilt jetzt auch im Katalog.")).toBeVisible();
    await expect(adminSection.getByRole("heading", { name: /Preis fehlt/ })).toHaveCount(0);
    await expect(row).toContainText(euro.format(4.5));
    await expect(row).toContainText(euro.format(13.5));

    await admin.goto(main(`/admin/kosten/katalog?suche=${encodeURIComponent(name)}`));
    await expect(catalogRow(admin, name)).toContainText(euro.format(4.5));
    await adminContext.close();

    // Nächste Verwendung durch den Techniker: Preis kommt jetzt aus dem Katalog
    await page.goto(main(`/admin/tickets/${ticketId}`));
    await openCostForm(section);
    await section.getByLabel("Katalog durchsuchen").fill(name);
    await section.getByRole("radio", { name: new RegExp(name) }).check();
    await section.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(page.getByText(`Hinzugefügt: „${name}“ (1 Stk.).`)).toBeVisible();
    expect(await (await page.request.get(main(`/admin/tickets/${ticketId}`))).text()).not.toContain("4,50");
  });
});

test.describe("Kostenkatalog verwalten", () => {
  test("anlegen, Dublette abweisen, bearbeiten, deaktivieren und löschen", async ({ page }) => {
    const name = unique("Wartungspauschale Server");
    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main("/admin/kosten/katalog"));
    await expect(page.getByRole("heading", { level: 1, name: "Kostenkatalog" })).toBeVisible();
    await expect(page.getByText("Neue Positionen aus Tickets landen automatisch hier.")).toBeVisible();

    // Benutzte Einträge lassen sich nicht löschen
    await expect(catalogRow(page, "Arbeitszeit Technik").getByRole("button", { name: /Löschen/ })).toHaveCount(0);

    await page.getByRole("link", { name: "Position anlegen" }).first().click();
    await page.getByLabel("Bezeichnung").fill(name);
    await page.getByLabel("Art", { exact: true }).selectOption({ label: "Pauschale" });
    await expect(page.getByLabel("Einheit")).toHaveValue("Pauschale");
    await page.getByLabel(/Preis netto/).fill("150");
    await page.getByLabel("Standardmenge").fill("1");
    await page.getByRole("button", { name: "In den Katalog aufnehmen" }).click();
    await expect(page).toHaveURL(/\/admin\/kosten\/katalog(\?katalog=angelegt)?$/);
    await expect(page.getByText("Der Eintrag steht jetzt im Katalog.")).toBeVisible();
    await expect(catalogRow(page, name)).toContainText(euro.format(150));

    // Dublette (andere Schreibweise)
    await page.goto(main("/admin/kosten/katalog/neu"));
    await page.getByLabel("Bezeichnung").fill(name.toLowerCase());
    await page.getByLabel("Standardmenge").fill("1");
    await page.getByRole("button", { name: "In den Katalog aufnehmen" }).click();
    await expect(page.getByText(`„${name}“ steht schon im Katalog.`)).toBeVisible();

    // Bearbeiten
    await page.goto(main("/admin/kosten/katalog"));
    await catalogRow(page, name).getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.getByLabel(/Preis netto/).fill("175,50");
    await page.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(page).toHaveURL(/\/admin\/kosten\/katalog(\?katalog=gespeichert)?$/);
    await expect(page.getByText("Die Änderungen sind gespeichert.")).toBeVisible();
    await expect(catalogRow(page, name)).toContainText(euro.format(175.5));

    // Deaktivieren: im Ticket nicht mehr auswählbar
    await catalogRow(page, name).getByRole("button", { name: `Deaktivieren: ${name}` }).click();
    await expect(catalogRow(page, name)).toContainText("deaktiviert");
    const ticketId = await createStaffTicket(page, { customer: "Bäckerei Beispiel", subject: unique("Server-Wartung") });
    await page.goto(main(`/admin/tickets/${ticketId}`));
    await (await openCostSection(page)).getByLabel("Katalog durchsuchen").fill(name);
    await expect(costSection(page).getByText(`Nichts gefunden für „${name}“.`)).toBeVisible();

    // Wieder aktivieren und löschen (nie benutzt)
    await page.goto(main("/admin/kosten/katalog"));
    await catalogRow(page, name).getByRole("button", { name: `Aktivieren: ${name}` }).click();
    await expect(catalogRow(page, name).getByRole("button", { name: `Deaktivieren: ${name}` })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await catalogRow(page, name).getByRole("button", { name: `Löschen: ${name}` }).click();
    await expect(page).toHaveURL(/\/admin\/kosten\/katalog(\?katalog=geloescht)?$/);
    await expect(page.getByText("Der Eintrag ist gelöscht.")).toBeVisible();
    await expect(catalogRow(page, name)).toHaveCount(0);
  });
});

test.describe("Standort im Ticket", () => {
  test("neue Tickets bekommen den Standort des Kunden, änderbar in der Bearbeitung", async ({ page, browser }) => {
    // Portal: Unterkunde „Büro Ulm“ gehört zum Standort Ulm
    const customerContext = await newContext(browser);
    const customer = await customerContext.newPage();
    await loginPortal(customer, "muster", ACCOUNTS.ulm.email);
    const portalSubject = unique("Drucker in Ulm");
    const portalTicket = await createPortalTicket(customer, "muster", { subject: portalSubject, description: "Der Drucker zieht kein Papier ein." });
    await customerContext.close();

    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main(`/admin/tickets/${portalTicket}`));
    await expect(page.getByText("Standort: Hertlin Ulm")).toBeVisible();

    // Verwaltung: ohne Auswahl der Standort des Kunden, mit Auswahl der gewählte
    const fallback = await createStaffTicket(page, { customer: "Bäckerei Beispiel", subject: unique("Standort leer") });
    await page.goto(main(`/admin/tickets/${fallback}`));
    await expect(page.getByText("Standort: Hertlin Zentrale")).toBeVisible();

    const chosen = await createStaffTicket(page, {
      customer: "Bäckerei Beispiel",
      subject: unique("Standort gewählt"),
      location: "Hertlin Ulm",
    });
    await page.goto(main(`/admin/tickets/${chosen}`));
    await expect(page.getByText("Standort: Hertlin Ulm")).toBeVisible();

    // Bearbeitung: Standort ändern
    await page.goto(main(`/admin/tickets/${fallback}`));
    const meta = page.getByRole("complementary", { name: "Bearbeitung und Kontakt" });
    await meta.getByLabel("Standort").selectOption({ label: "Hertlin Ulm" });
    await meta.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(page.getByText("Gespeichert: Standort.")).toBeVisible();
    await expect(page.getByText("Standort: Hertlin Ulm")).toBeVisible();
  });
});

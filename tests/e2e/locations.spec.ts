import { test, expect, loginStaff, main, newContext, unique, ACCOUNTS } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Standorte: Verwaltung unter /admin/standorte, Anzeige auf der Website (Kontaktseite und Fußzeile),
 * Hauptsitz, Zuordnung von Mitarbeitern und Filter in Ticket- und Kundenliste.
 * Beispieldaten: „Hertlin Zentrale“ (Hauptsitz) und „Hertlin Ulm“.
 * Die Tests bauen aufeinander auf und stellen am Ende den Ausgangszustand wieder her.
 */

test.describe.configure({ mode: "serial" });

const NAME = unique("Hertlin Augsburg");
const STREET = "Maximilianstraße 10";
const STAFF_NAME = unique("Lena Vogt");

/** Öffnet die Bearbeitungsseite eines Standorts über die Liste. */
async function openLocation(page: Page, name: string) {
  await page.goto(main("/admin/standorte"));
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

/** Karte eines Standorts in der Liste der Verwaltung */
function listItem(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Standorte" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { level: 2, name, exact: true }) });
}

test("Standort anlegen – erscheint auf der Kontaktseite und in der Fußzeile", async ({ page, browser }) => {
  await loginStaff(page, ACCOUNTS.admin.email);
  await page.goto(main("/admin/standorte"));
  await expect(listItem(page, "Hertlin Zentrale").getByText("Hauptsitz")).toBeVisible();
  await page.getByRole("link", { name: "Standort anlegen" }).click();
  await expect(page).toHaveURL(main("/admin/standorte/neu"));

  // Pflichtfelder werden am Feld gemeldet
  await page.getByRole("button", { name: "Standort anlegen" }).click();
  await expect(page.getByText("Bitte einen Namen angeben.")).toBeVisible();
  await expect(page.getByText("Bitte die PLZ angeben.")).toBeVisible();

  await page.getByLabel("Name", { exact: true }).fill(NAME);
  await page.getByLabel("Straße und Hausnummer").fill(STREET);
  await page.getByLabel("PLZ").fill("86150");
  await page.getByLabel("Ort", { exact: true }).fill("Augsburg");
  await page.getByLabel("Telefon").fill("0821 / 55 66-0");
  await page.getByLabel("E-Mail-Adresse").fill("augsburg@hertlin.de");
  await page.getByLabel("Öffnungszeiten").fill("Mo–Do: 8:00 – 16:00 Uhr\nFr: 8:00 – 12:00 Uhr");
  await page.getByLabel("Hinweis für Besucher").fill("Eingang im Hinterhof");
  await expect(page.getByRole("checkbox", { name: /^Hauptsitz/ })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: /^Auf der Website zeigen/ })).toBeChecked();
  await page.getByRole("button", { name: "Standort anlegen" }).click();

  // Rückmeldung als Toast; der Hinweis verschwindet danach aus der Adresse
  await expect(page.getByText("Standort angelegt")).toBeVisible();
  await expect(page).toHaveURL(main("/admin/standorte"));
  await expect(listItem(page, NAME)).toContainText(`${STREET}, 86150 Augsburg`);
  await expect(listItem(page, NAME).getByText("Hauptsitz")).toHaveCount(0);

  // Doppelter Name wird abgelehnt
  await page.goto(main("/admin/standorte/neu"));
  await page.getByLabel("Name", { exact: true }).fill(NAME.toUpperCase());
  await page.getByLabel("Straße und Hausnummer").fill(STREET);
  await page.getByLabel("PLZ").fill("86150");
  await page.getByLabel("Ort", { exact: true }).fill("Augsburg");
  await page.getByRole("button", { name: "Standort anlegen" }).click();
  await expect(page.getByText("Einen Standort mit diesem Namen gibt es schon.")).toBeVisible();

  // Website: Modul „Standorte“ auf der Kontaktseite und Fußzeile
  const visitorContext = await newContext(browser);
  const visitor = await visitorContext.newPage();
  await visitor.goto(main("/kontakt"));
  const section = visitor.getByRole("region", { name: "Unsere Standorte" });
  await expect(section.getByRole("heading", { level: 3, name: NAME })).toBeVisible();
  const card = section.getByRole("listitem").filter({ has: visitor.getByRole("heading", { name: NAME }) });
  await expect(card.getByRole("link", { name: "0821 / 55 66-0" })).toHaveAttribute("href", "tel:082155660");
  await expect(card.getByRole("link", { name: "augsburg@hertlin.de" })).toHaveAttribute("href", "mailto:augsburg@hertlin.de");
  await expect(card).toContainText("Fr");
  await expect(card).toContainText("8:00 – 12:00 Uhr");
  await expect(card).toContainText("Eingang im Hinterhof");
  const route = card.getByRole("link", { name: /Route planen/ });
  await expect(route).toHaveAttribute("href", /^https:\/\/www\.openstreetmap\.org\/directions\?to=Maximilianstra%C3%9Fe%2010/);
  await expect(route).toHaveAttribute("target", "_blank");
  await expect(visitor.locator("iframe")).toHaveCount(0);

  const footer = visitor.getByRole("contentinfo");
  const footerLocations = footer.getByRole("region", { name: "Standorte" });
  await expect(footerLocations).toContainText(NAME);
  await expect(footerLocations).toContainText("Hertlin Ulm");
  await expect(footerLocations).toContainText("Hertlin Zentrale · Hauptsitz");
  await visitorContext.close();
});

test("Hauptsitz umschalten – genau einer, der Hauptsitz lässt sich nicht deaktivieren", async ({ page, browser }) => {
  await loginStaff(page, ACCOUNTS.admin.email);
  await openLocation(page, NAME);
  await page.getByRole("checkbox", { name: /^Zum Hauptsitz machen/ }).check();
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page.getByText(`Gespeichert. ${NAME} ist jetzt der Hauptsitz.`)).toBeVisible();
  await expect(page.getByText("Das ist der Hauptsitz.")).toBeVisible();

  // Hauptsitz deaktivieren geht nicht, solange es andere aktive Standorte gibt
  await page.getByRole("checkbox", { name: /^Standort aktiv/ }).uncheck();
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page.locator("#location-active-error")).toHaveText("Machen Sie zuerst einen anderen Standort zum Hauptsitz.");

  // Liste: neuer Hauptsitz steht vorn, die Zentrale ist ein normaler Standort
  await page.goto(main("/admin/standorte"));
  await expect(page.getByRole("list", { name: "Standorte" }).getByRole("heading", { level: 2 }).first()).toHaveText(NAME);
  await expect(listItem(page, NAME).getByText("Hauptsitz")).toBeVisible();
  await expect(listItem(page, "Hertlin Zentrale").getByText("Hauptsitz")).toHaveCount(0);

  // Website zeigt den neuen Hauptsitz zuerst
  const visitorContext = await newContext(browser);
  const visitor = await visitorContext.newPage();
  await visitor.goto(main("/kontakt"));
  const first = visitor.getByRole("region", { name: "Unsere Standorte" }).getByRole("listitem").first();
  await expect(first.getByRole("heading", { level: 3 })).toHaveText(NAME);
  await expect(first).toContainText("Hauptsitz");
  await visitorContext.close();

  // Zurück: Zentrale wird wieder Hauptsitz
  await openLocation(page, "Hertlin Zentrale");
  await page.getByRole("checkbox", { name: /^Zum Hauptsitz machen/ }).check();
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page.getByText("Gespeichert. Hertlin Zentrale ist jetzt der Hauptsitz.")).toBeVisible();
  await page.goto(main("/admin/standorte"));
  await expect(listItem(page, "Hertlin Zentrale").getByText("Hauptsitz")).toBeVisible();
  await expect(listItem(page, NAME).getByText("Hauptsitz")).toHaveCount(0);
});

test("Mitarbeiter einem Standort zuordnen", async ({ page }) => {
  await loginStaff(page, ACCOUNTS.admin.email);
  await page.goto(main("/admin/team/neu"));
  await page.locator("#staff-name").fill(STAFF_NAME);
  await page.locator("#staff-email").fill(`standort-${Date.now()}@hertlin.de`);
  await page.getByLabel("Standort", { exact: true }).selectOption({ label: NAME });
  await page.getByRole("button", { name: "Einladen" }).click();
  await expect(page.getByText("Teammitglied angelegt")).toBeVisible();

  await page.goto(main("/admin/team"));
  const row = page.getByRole("row").filter({ hasText: STAFF_NAME });
  await expect(row.getByRole("cell", { name: NAME })).toBeVisible();

  // Standort ändern
  await row.getByRole("link", { name: STAFF_NAME }).click();
  await expect(page.getByLabel("Standort", { exact: true })).toHaveValue(/.+/);
  await page.getByLabel("Standort", { exact: true }).selectOption({ label: "Hertlin Ulm" });
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page.getByText("Gespeichert.", { exact: true })).toBeVisible();
  await page.goto(main("/admin/team"));
  await expect(page.getByRole("row").filter({ hasText: STAFF_NAME }).getByRole("cell", { name: "Hertlin Ulm" })).toBeVisible();

  // Seed: der Techniker arbeitet in Ulm
  await expect(page.getByRole("row").filter({ hasText: ACCOUNTS.tech.name }).getByRole("cell", { name: "Hertlin Ulm" })).toBeVisible();
});

test("Ticketliste und Kundenliste nach Standort filtern", async ({ page }) => {
  const ulmTicket = "Neuer Mitarbeiter ab 1. des Monats: Zugang und Notebook";
  const zentraleTicket = "Drucker im Empfang druckt nur noch leere Seiten";

  await loginStaff(page, ACCOUNTS.admin.email);
  await page.goto(main("/admin/tickets?ansicht=alle"));
  await expect(page.getByRole("link", { name: zentraleTicket })).toBeVisible();
  await expect(page.getByLabel("Standort", { exact: true })).toHaveValue("");

  await page.getByLabel("Standort", { exact: true }).selectOption({ label: "Hertlin Ulm" });
  await expect(page).toHaveURL(/\/admin\/tickets\?ansicht=alle&standort=[A-Za-z0-9_-]+$/);
  await expect(page.getByRole("link", { name: ulmTicket })).toBeVisible();
  await expect(page.getByRole("link", { name: zentraleTicket })).toHaveCount(0);
  // Standort steht unaufdringlich beim Kunden
  await expect(page.getByRole("row").filter({ hasText: ulmTicket })).toContainText("Hertlin Ulm");

  await page.getByLabel("Standort", { exact: true }).selectOption({ label: "Ohne Standort" });
  await expect(page).toHaveURL(/standort=ohne/);
  await expect(page.getByRole("link", { name: ulmTicket })).toHaveCount(0);

  await page.getByRole("link", { name: "Filter zurücksetzen" }).first().click();
  await expect(page).toHaveURL(main("/admin/tickets?ansicht=alle"));
  await expect(page.getByRole("link", { name: zentraleTicket })).toBeVisible();

  // Kundenliste: Muster hat eine Unterkunde in Ulm, die Bäckerei nicht
  await page.goto(main("/admin/kunden"));
  await expect(page.getByRole("columnheader", { name: "Standort" })).toBeVisible();
  await page.getByLabel("Standort", { exact: true }).selectOption({ label: "Hertlin Ulm" });
  await expect(page).toHaveURL(/\/admin\/kunden\?standort=/);
  await expect(page.getByRole("link", { name: "Muster Steuerberatung GmbH", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bäckerei Beispiel", exact: true })).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: "Muster Steuerberatung GmbH" })).toContainText("Unterkunden: Hertlin Ulm");
});

test("Löschen nur ohne Zuordnungen", async ({ page, browser }) => {
  await loginStaff(page, ACCOUNTS.admin.email);

  // Ulm hat Kunden, Mitarbeiter und Tickets: kein Löschen, Hinweis auf Deaktivieren
  await openLocation(page, "Hertlin Ulm");
  await expect(page.getByText(/Löschen geht erst ohne Zuordnungen/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Standort löschen" })).toHaveCount(0);

  // Der neue Standort ist nach dem Umzug der Mitarbeiterin frei
  await openLocation(page, NAME);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Standort löschen" }).click();
  await expect(page.getByText("Der Standort ist gelöscht.")).toBeVisible();
  await expect(page).toHaveURL(main("/admin/standorte"));
  await expect(listItem(page, NAME)).toHaveCount(0);

  const visitorContext = await newContext(browser);
  const visitor = await visitorContext.newPage();
  await visitor.goto(main("/kontakt"));
  await expect(visitor.getByRole("region", { name: "Unsere Standorte" })).not.toContainText(NAME);
  await expect(visitor.getByRole("contentinfo")).not.toContainText(NAME);
  await visitorContext.close();
});

test("Techniker hat keinen Zugriff auf die Standortverwaltung", async ({ page }) => {
  await loginStaff(page, ACCOUNTS.tech.email);
  for (const path of ["/admin/standorte", "/admin/standorte/neu"]) {
    await page.goto(main(path));
    await expect(page, path).toHaveURL(main("/admin?hinweis=kein-zugriff"));
  }
});

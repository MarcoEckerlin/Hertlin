import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Browser, Page } from "@playwright/test";
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
  unique,
  ACCOUNTS,
} from "./fixtures";

/**
 * Kernanforderung: Leistungen und Material werden im Ticket erfasst – von Administratoren und Technikern.
 * Beträge (Preise, Summen, Kostenübersicht) sehen nur Administratoren; Kunden sehen gar nichts davon.
 * Jede Position hat einen zufälligen, eindeutigen Betrag und ein eigenes Leistungsdatum, damit sich die
 * Prüfungen über den Zeitraumfilter nicht mit anderen Positionen mischen.
 */

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const plain = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type CostCase = {
  ticketId: number;
  subject: string;
  description: string;
  /** Leistungsdatum yyyy-mm-dd */
  date: string;
  /** Eingaben wie im Formular */
  quantityInput: string;
  priceInput: string;
  /** "5.402,34" – ohne Währungszeichen, wie er in der Oberfläche steht */
  totalText: string;
  /** "5.402,34 €" */
  totalMoney: string;
  /** "5402,34" – wie in der CSV-Datei */
  totalCsv: string;
  /** "4.321,87" */
  priceText: string;
};

function randomCase(): Omit<CostCase, "ticketId" | "subject"> {
  // Einzelpreis zwischen 4.000,00 und 4.999,99 € mit zufälligen Cent, Menge 1,25 Std.
  const priceCents = 400_000 + Math.floor(Math.random() * 99_999);
  const totalCents = Math.round((125 * priceCents) / 100);
  // Zufälliger Tag in 2024 – liegt außerhalb aller Beispieldaten
  const day = new Date(Date.UTC(2024, 0, 1) + Math.floor(Math.random() * 360) * 86_400_000);
  return {
    description: unique("Fehlersuche Netzwerk vor Ort"),
    date: day.toISOString().slice(0, 10),
    quantityInput: "1,25",
    priceInput: plain.format(priceCents / 100),
    priceText: plain.format(priceCents / 100),
    totalText: plain.format(totalCents / 100),
    totalMoney: euro.format(totalCents / 100),
    totalCsv: (totalCents / 100).toFixed(2).replace(".", ","),
  };
}

/** Ticket der Bäckerei im Portal anlegen und als Admin eine Kostenposition erfassen. */
async function createTicketWithCost(browser: Browser): Promise<CostCase> {
  const customerContext = await newContext(browser);
  const customer = await customerContext.newPage();
  await loginPortal(customer, "baeckerei", ACCOUNTS.baecker.email);
  const subject = unique("Backofen-Steuerung verliert Netzwerk");
  const ticketId = await createPortalTicket(customer, "baeckerei", {
    subject,
    description: "Die Steuerung des Ofens ist morgens nicht mehr im Netz.",
  });
  await customerContext.close();

  const adminContext = await newContext(browser);
  const admin = await adminContext.newPage();
  await loginStaff(admin, ACCOUNTS.admin.email);
  const c = randomCase();
  await addCost(admin, ticketId, c);
  await adminContext.close();
  return { ticketId, subject, ...c };
}

/** Neue (freie) Position im Ticket, ohne sie in den Katalog aufzunehmen. */
async function addCost(admin: Page, ticketId: number, c: Omit<CostCase, "ticketId" | "subject">) {
  await admin.goto(main(`/admin/tickets/${ticketId}`));
  const section = admin.locator("#kosten");
  await expect(section.getByRole("heading", { name: "Leistungen und Material" })).toBeVisible();
  await section.getByRole("radio", { name: "Neue Position" }).check();
  await section.getByLabel("Bezeichnung").fill(c.description);
  await section.getByLabel("Art", { exact: true }).selectOption({ label: "Arbeitszeit" });
  await section.getByLabel("Datum").fill(c.date);
  await section.getByLabel("Menge").fill(c.quantityInput);
  await section.getByLabel("Einzelpreis (€)").fill(c.priceInput);
  // Vorschau rechnet mit deutschen Zahlen
  await expect(section.getByLabel("Gesamtbetrag")).toHaveText(c.totalMoney);
  await section.getByLabel("In den Katalog aufnehmen").uncheck();
  await section.getByRole("button", { name: "Position hinzufügen" }).click();
  await expect(section.getByText(`Arbeitszeit über ${c.totalMoney} hinzugefügt.`)).toBeVisible();
  await expect(section.getByRole("row").filter({ hasText: c.description })).toBeVisible();
}

async function htmlOf(page: Page, url: string): Promise<string> {
  const response = await page.request.get(url);
  return response.text();
}

test.describe("Leistungen und Kosten im Ticket", () => {
  let shared: CostCase;

  test.beforeAll(async ({ browser }) => {
    shared = await createTicketWithCost(browser);
  });

  test("Admin erfasst Kosten mit deutschen Zahlen und sieht Positionen und Summe", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main(`/admin/tickets/${shared.ticketId}`));
    const section = page.locator("#kosten");
    await expect(section.getByText("Preise und Summen sehen nur Administratoren")).toBeVisible();
    const row = section.getByRole("row").filter({ hasText: shared.description });
    await expect(row).toContainText("1,25 Std.");
    await expect(row).toContainText(`erbracht von ${ACCOUNTS.admin.name}`);
    await expect(row).toContainText(`${shared.priceText} €`);
    await expect(row).toContainText(shared.totalMoney);

    // Zweite Position: Tausenderpunkt und Komma. Anderes Leistungsdatum, damit die Prüfungen der Übersicht
    // (gefiltert auf das Datum der ersten Position) davon unberührt bleiben.
    const second = randomCase();
    const secondDate = second.date === shared.date ? "2023-06-15" : second.date;
    await section.getByRole("radio", { name: "Neue Position" }).check();
    await section.getByLabel("Bezeichnung").fill(second.description);
    await section.getByLabel("Art", { exact: true }).selectOption({ label: "Material" });
    await section.getByLabel("Datum").fill(secondDate);
    await section.getByLabel("Menge").fill("2");
    await section.getByLabel("Einheit").selectOption("Stk.");
    await section.getByLabel("Einzelpreis (€)").fill("1.234,5");
    await expect(section.getByLabel("Gesamtbetrag")).toHaveText(euro.format(2469));
    await section.getByLabel("In den Katalog aufnehmen").uncheck();
    await section.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(section.getByText(`Material über ${euro.format(2469)} hinzugefügt.`)).toBeVisible();

    const materialRow = section.getByRole("row").filter({ hasText: second.description });
    await expect(materialRow).toContainText("2 Stk.");
    await expect(materialRow).toContainText(euro.format(1234.5));
    await expect(materialRow).toContainText(euro.format(2469));

    // Summe beider Positionen
    const totalCents = Math.round(Number(shared.totalCsv.replace(",", ".")) * 100) + 246_900;
    const sumRow = section.getByRole("row").filter({ hasText: "Summe" });
    await expect(sumRow).toContainText(euro.format(totalCents / 100));
  });

  test("Techniker sieht Positionen ohne Beträge und erfasst selbst aus dem Katalog", async ({ page, browser }) => {
    await loginStaff(page, ACCOUNTS.tech.email);
    await page.goto(main(`/admin/tickets/${shared.ticketId}`));
    await expect(page.getByRole("heading", { level: 1, name: shared.subject })).toBeVisible();
    const section = page.locator("#kosten");
    await expect(section.getByRole("heading", { name: "Leistungen und Material" })).toBeVisible();
    await expect(section.getByText("die Preise ergänzt die Verwaltung")).toBeVisible();

    // Position des Administrators: sichtbar mit Menge und wer sie erbracht hat – ohne Preis und ohne Bearbeiten
    const adminRow = section.getByRole("row").filter({ hasText: shared.description });
    await expect(adminRow).toContainText("1,25 Std.");
    await expect(adminRow).toContainText(`erbracht von ${ACCOUNTS.admin.name}`);
    await expect(adminRow.getByRole("link", { name: /Bearbeiten/ })).toHaveCount(0);
    await expect(section.getByRole("columnheader", { name: "Einzelpreis" })).toHaveCount(0);
    await expect(section.getByLabel("Gesamtbetrag")).toHaveCount(0);

    // Keine Beträge im ausgelieferten HTML (inkl. Daten für React) – auch keine Katalogpreise
    const html = await htmlOf(page, main(`/admin/tickets/${shared.ticketId}`));
    expect(html).toContain(shared.subject);
    expect(html).toContain(shared.description);
    for (const secret of [shared.totalText, shared.priceText, shared.totalCsv, "95,00", "35,00", "unitPriceCents", "totalCents"]) {
      expect(html, `HTML enthält ${secret}`).not.toContain(secret);
    }

    // Aus dem Katalog erfassen: Der Preis kommt auf dem Server dazu, die Rückmeldung nennt keinen Betrag
    await section.getByLabel("Katalog durchsuchen").fill("anfahrt");
    await section.getByRole("radio", { name: "Anfahrt Stadtgebiet" }).check();
    await expect(section.getByLabel("Einzelpreis (€)")).toHaveCount(0);
    await section.getByLabel("Notiz").fill("zweiter Termin");
    await section.getByRole("button", { name: "Position hinzufügen" }).click();
    await expect(section.getByText("Hinzugefügt: „Anfahrt Stadtgebiet – zweiter Termin“ (1 Pauschale).")).toBeVisible();
    const ownRow = section.getByRole("row").filter({ hasText: "Anfahrt Stadtgebiet – zweiter Termin" });
    await expect(ownRow).toContainText(`erbracht von ${ACCOUNTS.tech.name}`);
    await expect(ownRow).not.toContainText("€");

    // Eigene Position bearbeiten – ohne Preisfeld
    await ownRow.getByRole("link", { name: /Bearbeiten/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Position bearbeiten" })).toBeVisible();
    await expect(page.getByLabel("Einzelpreis (€)")).toHaveCount(0);
    await page.getByLabel("Menge").fill("2");
    await page.getByRole("button", { name: "Änderungen speichern" }).click();
    await expect(page.getByText("Die Position ist gespeichert.")).toBeVisible();
    await expect(page.locator("#kosten").getByRole("row").filter({ hasText: "zweiter Termin" })).toContainText("2 Pauschale");

    // Der Administrator sieht die Position mit Katalogpreis
    const adminContext = await newContext(browser);
    const admin = await adminContext.newPage();
    await loginStaff(admin, ACCOUNTS.admin.email);
    await admin.goto(main(`/admin/tickets/${shared.ticketId}`));
    const techRowForAdmin = admin.locator("#kosten").getByRole("row").filter({ hasText: "zweiter Termin" });
    await expect(techRowForAdmin).toContainText(euro.format(35));
    await expect(techRowForAdmin).toContainText(euro.format(70));
    await adminContext.close();

    // Ticketliste und Übersicht nennen keine Beträge
    for (const listUrl of [main("/admin/tickets"), main("/admin")]) {
      const listHtml = await htmlOf(page, listUrl);
      expect(listHtml, `${listUrl} enthält Betrag`).not.toContain(shared.totalText);
    }

    // Kein Menüpunkt, Kostenseiten und Katalog leiten um, Export und Konto-Ansicht sind gesperrt
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" }).first().getByRole("link", { name: /Kosten/ })).toHaveCount(0);
    await page.goto(main("/admin/kosten"));
    await expect(page).toHaveURL(main("/admin?hinweis=kein-zugriff"));
    await expect(page.getByText("Kein Zugriff")).toBeVisible();
    const exportResponse = await page.request.get(main("/admin/kosten/export?abrechnung=alle"));
    expect(exportResponse.status()).toBe(404);
    expect(await exportResponse.text()).not.toContain(shared.description);
    await page.goto(main("/admin/kosten/privat"));
    await expect(page).toHaveURL(main("/admin?hinweis=kein-zugriff"));
    await page.goto(main("/admin/kosten/katalog"));
    await expect(page).toHaveURL(main("/admin?hinweis=kein-zugriff"));
  });

  test("Techniker kann Positionen von Kollegen nicht ändern", async ({ page, browser }) => {
    // Adresse der Admin-Position zum Bearbeiten (nur Administratoren sehen den Link)
    const adminContext = await newContext(browser);
    const admin = await adminContext.newPage();
    await loginStaff(admin, ACCOUNTS.admin.email);
    await admin.goto(main(`/admin/tickets/${shared.ticketId}`));
    const href = await admin
      .locator("#kosten")
      .getByRole("row")
      .filter({ hasText: shared.description })
      .getByRole("link", { name: /Bearbeiten/ })
      .getAttribute("href");
    await adminContext.close();
    expect(href).toMatch(/\/kosten\//);

    await loginStaff(page, ACCOUNTS.tech.email);
    await page.goto(main(href!));
    await expect(page.getByText("Diese Position hat jemand anderes erfasst.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Änderungen speichern" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Position löschen" })).toHaveCount(0);
    expect(await htmlOf(page, main(href!))).not.toContain(shared.priceText);
  });

  test("Kunde sieht im Portal keine Kosten", async ({ page }) => {
    await loginPortal(page, "baeckerei", ACCOUNTS.baecker.email);
    await page.goto(portal("baeckerei", `/tickets/${shared.ticketId}`));
    await expect(page.getByRole("heading", { level: 1, name: shared.subject })).toBeVisible();
    const raw = await fetchInPage(page, `/tickets/${shared.ticketId}`);
    expect(raw.status).toBe(200);
    const html = Buffer.from(raw.base64, "base64").toString("utf8");
    expect(html).toContain(shared.subject);
    for (const secret of [shared.description, shared.totalText, shared.priceText, shared.totalCsv, "zweiter Termin", "Leistungen und Material"]) {
      expect(html, `HTML enthält ${secret}`).not.toContain(secret);
    }

    // Auch keine E-Mail an den Kunden nennt die Position
    const log = await readFile(path.join(process.cwd(), "storage", "mails.log"), "utf8").catch(() => "");
    expect(log).not.toContain(shared.description);
  });

  test("Kostenübersicht pro Konto zeigt den Betrag beim richtigen Firmenkunden", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    const query = `zeitraum=frei&von=${shared.date}&bis=${shared.date}&abrechnung=alle`;
    await page.goto(main(`/admin/kosten?${query}`));
    await expect(page.getByRole("heading", { level: 1, name: "Kosten pro Konto" })).toBeVisible();

    const table = page.getByRole("table", { name: "Kosten pro Konto" });
    const baeckerei = table.getByRole("row").filter({ has: page.getByRole("link", { name: "Bäckerei Beispiel", exact: true }) });
    await expect(baeckerei).toContainText(shared.totalMoney);
    await expect(table.getByRole("link", { name: "Muster Steuerberatung GmbH", exact: true })).toHaveCount(0);

    // Positionen des Kontos
    await baeckerei.getByRole("link", { name: "Bäckerei Beispiel", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/kosten\/konto\//);
    const position = page.getByRole("row").filter({ hasText: shared.description });
    await expect(position).toContainText(shared.totalMoney);
  });

  test("CSV-Export enthält die Position (nur Admin)", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    const response = await page.request.get(
      main(`/admin/kosten/export?zeitraum=frei&von=${shared.date}&bis=${shared.date}&abrechnung=alle`),
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(response.headers()["content-disposition"]).toContain("attachment");
    const csv = await response.text();
    const line = csv.split("\n").find((l) => l.includes(shared.description));
    expect(line, "Zeile der Position").toBeTruthy();
    expect(line).toContain("Bäckerei Beispiel");
    expect(line).toContain(`T-${String(shared.ticketId).padStart(5, "0")}`);
    expect(line).toContain(shared.totalCsv);
  });
});

import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { test, expect, fetchInPage, loginPortal, loginStaff, main, newContext, portal, unique, ACCOUNTS } from "./fixtures";
import { lastMailTo } from "./mail";

/**
 * Rechnungen: aus offenen Positionen erstellen, PDF, Versand per E-Mail an die Rechnungsadresse des Kunden,
 * Unterkunde mit eigener Rechnung, Zahlung, Storno und die Rechnungen im Kundenportal.
 *
 * Kostenpositionen legt der Test direkt in der Testdatenbank an (prisma/e2e.db), damit er nicht vom
 * Erfassungsformular im Ticket abhängt. Jede Position hat eine eindeutige Beschreibung.
 */

test.describe.configure({ mode: "serial" });

const db = new PrismaClient({ datasources: { db: { url: `file:${path.join(process.cwd(), "prisma", "e2e.db")}` } } });
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
/** „193,36 €“ mit normalem Leerzeichen (die Oberfläche nutzt ein geschütztes, toHaveText normalisiert beides) */
const money = (cents: number) => euro.format(cents / 100).replace(/\s/g, " ");

const run = Date.now().toString(36);
const LABOR = `E2E Fehlersuche Netzwerk ${run}`;
const MATERIAL = `E2E Patchkabel ${run}`;
const UNPRICED = `E2E Kabelkanal ohne Preis ${run}`;
const ULM = `E2E Notebook eingerichtet ${run}`;

/** Gemeinsamer Stand über die Tests hinweg (seriell) */
const state = { musterId: "", ulmId: "", musterInvoiceId: "", musterNumber: "", ulmInvoiceId: "", ulmNumber: "" };

async function ticketWithCosts(
  companyId: string,
  subject: string,
  entries: { description: string; kind: string; quantity: number; unit: string; priceCents: number; needsPrice?: boolean }[],
) {
  const admin = await db.user.findUniqueOrThrow({ where: { email: ACCOUNTS.admin.email } });
  return db.ticket.create({
    data: {
      subject,
      companyId,
      source: "STAFF",
      costs: {
        create: entries.map((e) => ({
          kind: e.kind,
          description: e.description,
          quantityHundredths: e.quantity,
          unit: e.unit,
          unitPriceCents: e.needsPrice ? 0 : e.priceCents,
          totalCents: e.needsPrice ? 0 : Math.round((e.quantity * e.priceCents) / 100),
          needsPrice: e.needsPrice ?? false,
          performedAt: new Date(),
          createdById: admin.id,
          performedById: admin.id,
        })),
      },
    },
  });
}

function pdfToText(pdf: Buffer): string | null {
  try {
    return execFileSync("pdftotext", ["-layout", "-", "-"], { input: pdf }).toString("utf8");
  } catch {
    return null;
  }
}

async function openAccount(page: Page) {
  await page.goto(main(`/admin/kosten/konto/${state.musterId}`));
  await expect(page.getByRole("heading", { level: 1, name: "Muster Steuerberatung GmbH" })).toBeVisible();
}

test.beforeAll(async () => {
  const muster = await db.company.findFirstOrThrow({ where: { slug: "muster" } });
  const ulm = await db.company.findFirstOrThrow({ where: { name: "Büro Ulm", parentId: muster.id } });
  state.musterId = muster.id;
  state.ulmId = ulm.id;
  await ticketWithCosts(muster.id, unique("E2E Netzwerkstörung"), [
    { description: LABOR, kind: "LABOR", quantity: 150, unit: "Std.", priceCents: 9500 },
    { description: MATERIAL, kind: "MATERIAL", quantity: 100, unit: "Stk.", priceCents: 1999 },
    { description: UNPRICED, kind: "MATERIAL", quantity: 300, unit: "Stk.", priceCents: 0, needsPrice: true },
  ]);
  await ticketWithCosts(ulm.id, unique("E2E Neues Notebook Ulm"), [
    { description: ULM, kind: "LABOR", quantity: 200, unit: "Std.", priceCents: 9500 },
  ]);
});

test.afterAll(async () => {
  await db.$disconnect();
});

test.describe("Rechnungen", () => {
  test("Ohne Pflichtangaben keine Rechnung – Firmendaten und Rechnungseinstellungen ergänzen", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);

    // Vorgaben enthalten noch Platzhalter: Erstellen ist gesperrt
    await page.goto(main(`/admin/rechnungen/neu?konto=${state.musterId}`));
    await expect(page.getByText("Rechnungen sind noch nicht möglich")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Rechnung über .* erstellen$/ })).toBeDisabled();

    // Firmendaten (Absender)
    await page.goto(main("/admin/website/firmendaten"));
    const fill = (label: string, value: string) => page.getByLabel(label, { exact: true }).fill(value);
    await fill("Firmierung", "Hertlin IT-Service GmbH");
    await fill("Inhaber bzw. Geschäftsführer", "Anna Hertlin");
    await fill("Straße und Hausnummer", "Hauptstraße 21");
    await fill("PLZ", "12345");
    await fill("Ort", "Musterstadt");
    await fill("Telefonnummer", "01234 98760");
    await page.getByRole("button", { name: "Firmendaten speichern" }).click();
    await expect(page.getByText(/^Firmendaten gespeichert\./)).toBeVisible();

    // Rechnungseinstellungen: IBAN wird geprüft
    await page.goto(main("/admin/rechnungen/einstellungen"));
    await page.getByLabel("Steuernummer").fill("12/345/67890");
    await page.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 01");
    await page.getByRole("button", { name: "Einstellungen speichern" }).click();
    await expect(page.getByText("Die IBAN stimmt nicht. Bitte Tippfehler prüfen.")).toBeVisible();
    await page.getByLabel("IBAN").fill("DE89 3704 0044 0532 0130 00");
    await page.getByLabel("BIC").fill("COBADEFFXXX");
    await page.getByRole("button", { name: "Einstellungen speichern" }).click();
    await expect(page.getByText("Die Rechnungseinstellungen sind gespeichert.")).toBeVisible();
    await expect(page.getByText("Alle Pflichtangaben sind vorhanden")).toBeVisible();
  });

  test("Rechnung für Muster aus ausgewählten offenen Positionen erstellen – PDF herunterladen", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    await openAccount(page);

    await page.getByRole("checkbox", { name: new RegExp(`${LABOR} .* auswählen`) }).check();
    await page.getByRole("checkbox", { name: new RegExp(`${MATERIAL} .* auswählen`) }).check();
    await page.getByRole("button", { name: /Rechnung erstellen/ }).click();
    await expect(page).toHaveURL(/\/admin\/rechnungen\/neu\?konto=.+&pos=.+&pos=/);

    // Vorschau: nur die gewählten Positionen, Position ohne Preis gesperrt, Empfänger mit Rechnungs-E-Mail
    await expect(page.getByRole("heading", { level: 1, name: "Neue Rechnung an Muster Steuerberatung GmbH" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: `${LABOR} übernehmen` })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: `${MATERIAL} übernehmen` })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /Trommeleinheit Kyocera DK-1150 übernehmen/ })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: `${UNPRICED} übernehmen` })).toHaveCount(0);
    await expect(page.getByText(`„${UNPRICED}“`)).toBeVisible();
    await expect(page.getByLabel("Rechnung per E-Mail an")).toHaveValue("buchhaltung@muster.example");

    // 1,5 × 95,00 € + 19,99 € = 162,49 € netto; 19 % auf die Summe = 30,87 €; brutto 193,36 €
    await expect(page.getByTestId("invoice-net")).toHaveText(money(16_249));
    await expect(page.getByTestId("invoice-tax")).toHaveText(money(3087));
    await expect(page.getByTestId("invoice-gross")).toHaveText(money(19_336));

    await page.getByRole("button", { name: /^Rechnung über 193,36\s€ erstellen$/ }).click();
    // Die Rückmeldung „?erstellt=1“ verschwindet nach dem Anzeigen aus der Adresse
    await expect(page).toHaveURL(/\/admin\/rechnungen\/(?!neu\b)[a-z0-9]+(\?erstellt=1)?$/);
    const heading = page.getByRole("heading", { level: 1, name: /^Rechnung RE-\d{4}-\d{4}$/ });
    await expect(heading).toBeVisible();
    state.musterNumber = (await heading.textContent())!.replace("Rechnung ", "").trim();
    state.musterInvoiceId = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.getByText(`Rechnung ${state.musterNumber} ist erstellt`)).toBeVisible();
    await expect(page.getByText("Noch nicht versendet").first()).toBeVisible();

    // PDF: nur für Admins, als Datei mit Content-Disposition
    const response = await page.request.get(main(`/admin/rechnungen/${state.musterInvoiceId}/pdf?download=1`));
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["content-disposition"]).toContain(`attachment; filename="Rechnung-${state.musterNumber}.pdf"`);
    const pdf = await response.body();
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = pdfToText(pdf);
    if (text) {
      expect(text).toContain(`Rechnung ${state.musterNumber}`);
      expect(text).toContain(LABOR);
      expect(text).toContain("193,36");
      expect(text).toContain("DE89 3704 0044 0532 0130 00");
    }

    // Positionen sind abgerechnet und verweisen auf die Rechnung
    await openAccount(page);
    await page.getByLabel("Abrechnung").selectOption("alle");
    await expect(page).toHaveURL(/abrechnung=alle/);
    const row = page.getByRole("row").filter({ hasText: LABOR });
    await expect(row.getByRole("link", { name: state.musterNumber })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: UNPRICED })).toContainText("Preis fehlt");
  });

  test("Per E-Mail senden – an die Rechnungs-E-Mail des Kunden mit PDF im Anhang", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main(`/admin/rechnungen/${state.musterInvoiceId}`));
    await expect(page.getByLabel("An", { exact: true })).toHaveValue("buchhaltung@muster.example");
    await page.getByRole("button", { name: "Per E-Mail senden" }).click();
    await expect(page.getByText(`Die Rechnung ${state.musterNumber} ist an buchhaltung@muster.example verschickt.`)).toBeVisible();
    await expect(page.getByText("Versendet", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Erneut senden" })).toBeVisible();

    const mail = await lastMailTo("buchhaltung@muster.example");
    expect(mail?.subject).toBe(`Rechnung ${state.musterNumber} von Hertlin`);
    expect(mail?.body).toContain(`Anhang: Rechnung-${state.musterNumber}.pdf (`);
    expect(mail?.body).toMatch(/über 193,36\s€/);
  });

  test("Büro Ulm mit eigener Rechnung ist ein eigener Empfänger", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    await openAccount(page);

    const ulmSection = page.locator("section").filter({
      has: page.getByRole("heading", { level: 2, name: "Muster Steuerberatung GmbH, Büro Ulm" }),
    });
    await expect(ulmSection.getByRole("row").filter({ hasText: ULM })).toBeVisible();
    await expect(ulmSection.getByText("ulm@muster.example")).toBeVisible();
    const rootSection = page.locator("section").filter({
      has: page.getByRole("heading", { level: 2, name: "Muster Steuerberatung GmbH", exact: true }),
    });
    await expect(rootSection.getByRole("row").filter({ hasText: ULM })).toHaveCount(0);

    await ulmSection.getByRole("checkbox", { name: new RegExp(`${ULM} .* auswählen`) }).check();
    await ulmSection.getByRole("button", { name: /Rechnung erstellen/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Neue Rechnung an Büro Ulm" })).toBeVisible();
    await expect(page.getByLabel("Rechnung per E-Mail an")).toHaveValue("ulm@muster.example");
    await expect(page.getByText("Am Markt 3")).toBeVisible();
    // 2 Std. × 95,00 € = 190,00 € + 36,10 € USt = 226,10 €
    await expect(page.getByTestId("invoice-gross")).toHaveText(money(22_610));

    await page.getByRole("button", { name: /^Rechnung über 226,10\s€ erstellen$/ }).click();
    await expect(page).toHaveURL(/\/admin\/rechnungen\/(?!neu\b)[a-z0-9]+(\?erstellt=1)?$/);
    const heading = page.getByRole("heading", { level: 1, name: /^Rechnung RE-\d{4}-\d{4}$/ });
    state.ulmNumber = (await heading.textContent())!.replace("Rechnung ", "").trim();
    state.ulmInvoiceId = new URL(page.url()).pathname.split("/").pop()!;
    expect(state.ulmNumber).not.toBe(state.musterNumber);
    await expect(page.getByText("Muster Steuerberatung GmbH, Büro Ulm").first()).toBeVisible();

    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: state.ulmInvoiceId } });
    expect(invoice.companyId).toBe(state.ulmId);
    expect(invoice.recipientEmail).toBe("ulm@muster.example");
  });

  test("Als bezahlt markieren", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main(`/admin/rechnungen/${state.musterInvoiceId}`));
    await page.getByRole("button", { name: "Als bezahlt markieren" }).click();
    await expect(page.getByText(`Die Rechnung ${state.musterNumber} ist als bezahlt markiert.`)).toBeVisible();
    await expect(page.getByText("Bezahlt", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Zahlung zurücknehmen" })).toBeVisible();

    // In der Liste unter „Bezahlt“
    await page.goto(main("/admin/rechnungen?status=bezahlt"));
    await expect(page.getByRole("link", { name: state.musterNumber })).toBeVisible();
    await expect(page.getByRole("link", { name: state.ulmNumber })).toHaveCount(0);
  });

  test("Stornieren: Stornorechnung mit negativen Beträgen, Positionen wieder offen", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    await page.goto(main(`/admin/rechnungen/${state.ulmInvoiceId}`));

    // Ohne Bestätigung passiert nichts
    await page.getByRole("button", { name: "Rechnung stornieren" }).click();
    await expect(page.getByText("Bitte bestätigen Sie das Stornieren.")).toBeVisible();

    await page.getByLabel(`Stornorechnung zu ${state.ulmNumber} erstellen`).check();
    await page.getByRole("button", { name: "Rechnung stornieren" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Stornorechnung RE-\d{4}-\d{4}$/ })).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`/admin/rechnungen/${state.ulmInvoiceId}`));
    await expect(page.getByText(money(-22_610)).first()).toBeVisible();
    await expect(page.getByText("ist storniert, ihre Positionen sind wieder offen.")).toBeVisible();

    const entry = await db.costEntry.findFirstOrThrow({ where: { description: ULM } });
    expect(entry).toMatchObject({ billed: false, billedAt: null, invoiceId: null });
    const original = await db.invoice.findUniqueOrThrow({ where: { id: state.ulmInvoiceId } });
    expect(original.status).toBe("CANCELLED");

    // Original zeigt den Storno, kein zweites Storno möglich
    await page.goto(main(`/admin/rechnungen/${state.ulmInvoiceId}`));
    await expect(page.getByText("Diese Rechnung ist storniert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rechnung stornieren" })).toHaveCount(0);

    // Position steht wieder offen beim Empfänger Büro Ulm
    await openAccount(page);
    await expect(page.getByRole("row").filter({ hasText: ULM })).toContainText("offen");
  });

  test("Kundenportal: Hauptansprechpartnerin sieht versendete Rechnungen, Mitarbeiter nicht", async ({ page, browser }) => {
    // Hauptansprechpartnerin des Firmenkunden
    await loginPortal(page, "muster", ACCOUNTS.berger.email);
    await page.getByRole("navigation").getByRole("link", { name: "Rechnungen" }).first().click();
    await expect(page).toHaveURL(portal("muster", "/rechnungen"));
    await expect(page.getByRole("heading", { level: 1, name: "Rechnungen" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: state.musterNumber });
    await expect(row).toContainText("Bezahlt");
    // Noch nicht versendete (stornierte) Rechnung an Büro Ulm bleibt intern
    await expect(page.getByText(state.ulmNumber)).toHaveCount(0);
    // Keine einzelnen Kostenpositionen
    await expect(page.getByText(LABOR)).toHaveCount(0);

    const pdf = await fetchInPage(page, portal("muster", `/rechnungen/${state.musterInvoiceId}/pdf`));
    expect(pdf.status).toBe(200);
    expect(pdf.contentType).toBe("application/pdf");
    expect(Buffer.from(pdf.base64, "base64").subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const hidden = await fetchInPage(page, portal("muster", `/rechnungen/${state.ulmInvoiceId}/pdf`));
    expect(hidden.status).toBe(404);

    // Mitarbeiter des Kunden: kein Menüpunkt, keine Seite, kein PDF
    const employeeContext = await newContext(browser);
    const employee = await employeeContext.newPage();
    await loginPortal(employee, "muster", ACCOUNTS.yilmaz.email);
    await expect(employee.getByRole("link", { name: "Rechnungen" })).toHaveCount(0);
    await employee.goto(portal("muster", "/rechnungen"));
    await expect(employee).toHaveURL(portal("muster", "/?hinweis=kein-zugriff"));
    const denied = await fetchInPage(employee, portal("muster", `/rechnungen/${state.musterInvoiceId}/pdf`));
    expect(denied.status).toBe(404);
    await employeeContext.close();

    // Hauptansprechpartner der Unterkunde sieht nur Rechnungen seiner Unterkunde
    const ulmContext = await newContext(browser);
    const ulmLead = await ulmContext.newPage();
    await loginPortal(ulmLead, "muster", ACCOUNTS.ulm.email);
    await ulmLead.goto(portal("muster", "/rechnungen"));
    await expect(ulmLead.getByRole("heading", { level: 1, name: "Rechnungen" })).toBeVisible();
    await expect(ulmLead.getByText(state.musterNumber)).toHaveCount(0);
    const other = await fetchInPage(ulmLead, portal("muster", `/rechnungen/${state.musterInvoiceId}/pdf`));
    expect(other.status).toBe(404);
    await ulmContext.close();
  });

  test("Techniker sehen keine Rechnungen", async ({ page }) => {
    await loginStaff(page, ACCOUNTS.tech.email);
    await expect(page.getByRole("link", { name: "Rechnungen" })).toHaveCount(0);
    await page.goto(main("/admin/rechnungen"));
    await expect(page).toHaveURL(main("/admin?hinweis=kein-zugriff"));
    const response = await page.request.get(main(`/admin/rechnungen/${state.musterInvoiceId}/pdf`));
    expect(response.status()).toBe(404);
  });
});

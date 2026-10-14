import {
  test,
  expect,
  createPortalTicket,
  expectAbsentFor,
  loginPortal,
  loginStaff,
  main,
  newContext,
  unique,
  ACCOUNTS,
} from "./fixtures";

type Marked = Window & { __ohneNeuladen?: boolean };

test.describe("Live-Chat im Ticket (WebSocket)", () => {
  test("Anwesenheit, „schreibt gerade …“ und Antworten erscheinen live – interne Notizen nicht", async ({ page, browser }) => {
    // Kunde (Hauptansprechpartnerin) im Portal-Ticket
    const customer = page;
    await loginPortal(customer, "muster", ACCOUNTS.berger.email);
    const subject = unique("Teams-Telefonate brechen ab");
    const ticketId = await createPortalTicket(customer, "muster", {
      subject,
      description: "Bei Videotelefonaten fliegen wir nach ein paar Minuten raus.",
    });
    await expect(customer.getByText("Live", { exact: true })).toBeVisible();
    await customer.evaluate(() => {
      (window as Marked).__ohneNeuladen = true;
    });

    // Administratorin öffnet dasselbe Ticket in der Verwaltung
    const adminContext = await newContext(browser);
    const admin = await adminContext.newPage();
    await loginStaff(admin, ACCOUNTS.admin.email);
    await admin.goto(main(`/admin/tickets/${ticketId}`));
    await expect(admin.getByRole("heading", { level: 1, name: subject })).toBeVisible();

    // Anwesenheit auf beiden Seiten
    await expect(customer.getByText("Anna Hertlin (Hertlin) liest gerade mit.")).toBeVisible();
    await expect(admin.getByText(/Claudia Berger ist gerade online/)).toBeVisible();
    await expect(admin.getByText("Kunde ist online")).toBeVisible();

    // Kunde tippt -> Verwaltung sieht es
    await customer.getByRole("textbox", { name: "Ihre Nachricht" }).pressSequentially("Kurze Ergänzung", { delay: 30 });
    await expect(admin.getByText("Claudia Berger schreibt gerade …")).toBeVisible();

    // Administratorin tippt eine Antwort -> Kunde sieht es
    const reply = unique("Bitte installieren Sie das Teams-Update von heute");
    await admin.getByLabel("Nachricht", { exact: true }).pressSequentially(reply, { delay: 20 });
    await expect(customer.getByText("Anna Hertlin (Hertlin) schreibt gerade …")).toBeVisible();

    // Antwort erscheint ohne Neuladen beim Kunden
    await admin.getByRole("button", { name: "Antwort senden" }).click();
    await expect(admin.getByText(reply)).toBeVisible();
    await expect(customer.getByText(reply)).toBeVisible();
    await expect(customer.getByText(/schreibt gerade/)).toHaveCount(0);

    // Kollege (Techniker) schaut zu – er sieht interne Notizen, der Kunde nicht
    const techContext = await newContext(browser);
    const tech = await techContext.newPage();
    await loginStaff(tech, ACCOUNTS.tech.email);
    await tech.goto(main(`/admin/tickets/${ticketId}`));
    await expect(tech.getByText(/Anna Hertlin sieht sich das auch an/)).toBeVisible();
    await expect(customer.getByText(/Anna Hertlin und Jonas Keller \(Hertlin\) lesen gerade mit\.|Jonas Keller und Anna Hertlin \(Hertlin\) lesen gerade mit\./)).toBeVisible();

    // Interne Notiz tippen: nur der Kollege sieht „schreibt gerade …“
    const note = unique("Intern: Lizenz läuft Ende des Monats aus");
    await admin.getByText("Interne Notiz", { exact: true }).click();
    await admin.getByLabel("Notiz", { exact: true }).pressSequentially(note, { delay: 60 });
    await expect(tech.getByText("Anna Hertlin schreibt gerade …")).toBeVisible();
    await expectAbsentFor(customer.getByText(/schreibt gerade/));

    await admin.getByRole("button", { name: "Interne Notiz speichern" }).click();
    await expect(admin.getByText(note)).toBeVisible();
    // Kollege bekommt die Notiz live
    await expect(tech.getByText(note)).toBeVisible();

    // Gleich danach eine normale Antwort: Sobald sie beim Kunden ist, wäre auch die Notiz angekommen
    const followUp = unique("Ich schaue morgen früh noch einmal drauf");
    await admin.getByText("Antwort an Kunden", { exact: true }).click();
    await admin.getByLabel("Nachricht", { exact: true }).fill(followUp);
    await admin.getByRole("button", { name: "Antwort senden" }).click();
    await expect(customer.getByText(followUp)).toBeVisible();
    await expect(customer.getByText(note)).toHaveCount(0);
    await expect(customer.getByText(/schreibt gerade/)).toHaveCount(0);

    // Alles ohne Neuladen der Kundenseite
    expect(await customer.evaluate(() => (window as Marked).__ohneNeuladen)).toBe(true);

    // Auch nach dem Neuladen keine Notiz
    await customer.reload();
    await expect(customer.getByText(followUp)).toBeVisible();
    await expect(customer.getByText(note)).toHaveCount(0);

    // Verlässt die Administratorin das Ticket, verschwindet sie aus der Anwesenheit
    await adminContext.close();
    await expect(customer.getByText("Jonas Keller (Hertlin) liest gerade mit.")).toBeVisible();
    await techContext.close();
  });

  test("Kunde antwortet – die Verwaltung sieht die Nachricht live", async ({ page, browser }) => {
    await loginPortal(page, "muster", ACCOUNTS.berger.email);
    const subject = unique("Monitor flackert");
    const ticketId = await createPortalTicket(page, "muster", {
      subject,
      description: "Der zweite Monitor am Platz 4 flackert alle paar Sekunden.",
    });

    const adminContext = await newContext(browser);
    const admin = await adminContext.newPage();
    await loginStaff(admin, ACCOUNTS.tech.email);
    await admin.goto(main(`/admin/tickets/${ticketId}`));
    await expect(admin.getByText(/Claudia Berger ist gerade online/)).toBeVisible();
    await admin.evaluate(() => {
      (window as Marked).__ohneNeuladen = true;
    });

    const message = unique("Kabel getauscht, flackert trotzdem");
    await page.getByRole("textbox", { name: "Ihre Nachricht" }).fill(message);
    await page.getByRole("button", { name: "Nachricht senden" }).click();
    await expect(page.getByText(message)).toBeVisible();

    await expect(admin.getByText(message)).toBeVisible();
    expect(await admin.evaluate(() => (window as Marked).__ohneNeuladen)).toBe(true);
    await adminContext.close();
  });
});

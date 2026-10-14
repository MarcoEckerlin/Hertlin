import NodeWebSocket from "ws";
import type { Page } from "@playwright/test";
import {
  test,
  expect,
  createPortalTicket,
  fetchInPage,
  login,
  loginPortal,
  main,
  newContext,
  portal,
  unique,
  ACCOUNTS,
  PORT,
} from "./fixtures";

type WsResult = { messages: Array<Record<string, unknown>>; closed: boolean };

/**
 * Öffnet im Browser eine eigene WebSocket-Verbindung zum Live-Server (mit den Cookies der Seite),
 * schickt die Nachrichten nacheinander und sammelt die Antworten.
 */
async function wsExchange(page: Page, outgoing: Array<Record<string, unknown>>): Promise<WsResult> {
  return page.evaluate(async (send) => {
    const messages: Array<Record<string, unknown>> = [];
    const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/_ws`);
    let closed = false;
    socket.onclose = () => {
      closed = true;
    };
    socket.onmessage = (event) => messages.push(JSON.parse(String(event.data)) as Record<string, unknown>);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("WebSocket-Fehler"));
    });
    for (const message of send) {
      const before = messages.length;
      socket.send(JSON.stringify(message));
      // Auf die Antwort zu genau dieser Nachricht warten (höchstens 5 Sekunden)
      const until = Date.now() + 5000;
      while (Date.now() < until && !messages.slice(before).some((m) => m.t === "subscribed" || m.t === "denied")) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    socket.close();
    return { messages, closed };
  }, outgoing);
}

/** Ticket mit Anhang im Portal der Bäckerei; liefert Ticket-ID, Anhang-Pfad und eigene Benutzer-ID. */
async function baeckereiData(page: Page) {
  await loginPortal(page, "baeckerei", ACCOUNTS.baecker.email);
  const subject = unique("Kassenbon-Drucker Filiale Nord");
  const ticketId = await createPortalTicket(page, "baeckerei", {
    subject,
    description: "Der Bon-Drucker schneidet das Papier nicht mehr ab.",
    attachment: "bondrucker.png",
  });
  const attachmentHref = (await page
    .getByRole("list", { name: "Anhänge" })
    .getByRole("link", { name: /bondrucker\.png/ })
    .getAttribute("href"))!;
  await page.goto(portal("baeckerei", "/benutzer"));
  const userHref = (await page.locator("main").getByRole("link", { name: ACCOUNTS.baecker.name }).first().getAttribute("href"))!;
  expect(userHref).toMatch(/^\/benutzer\/[^/]+$/);
  // Gegenprobe: Der eigene Zugriff funktioniert
  expect((await fetchInPage(page, attachmentHref)).status).toBe(200);
  return { subject, ticketId, attachmentHref, userHref };
}

test.describe("Mandantentrennung und Zugriffsschutz", () => {
  test("Portalseiten sind über die Hauptdomain nicht erreichbar", async ({ page }) => {
    for (const path of ["/portal/muster", "/portal/muster/tickets", "/portal/muster/login", "/portal/baeckerei/dateien/abc"]) {
      const response = await page.goto(main(path));
      expect(response?.status(), path).toBe(404);
    }
  });

  test("Kunde von muster öffnet weder Ticket, Anhang noch Benutzer der Bäckerei", async ({ page, browser }) => {
    const baeckerContext = await newContext(browser);
    const baecker = await baeckerContext.newPage();
    const data = await baeckereiData(baecker);
    await baeckerContext.close();

    await loginPortal(page, "muster", ACCOUNTS.berger.email);

    const ticket = await page.goto(portal("muster", `/tickets/${data.ticketId}`));
    expect(ticket?.status()).toBe(404);
    await expect(page.getByText(data.subject)).toHaveCount(0);

    const attachment = await fetchInPage(page, data.attachmentHref);
    expect(attachment.status).toBe(404);
    expect(attachment.contentType).not.toContain("image/png");

    const user = await page.goto(portal("muster", data.userHref));
    expect(user?.status()).toBe(404);
    await expect(page.getByText(ACCOUNTS.baecker.email)).toHaveCount(0);

    // Die Sitzung gilt im Portal der Bäckerei nicht
    await page.goto(portal("baeckerei", `/tickets/${data.ticketId}`));
    await expect(page).toHaveURL(/baeckerei\.localhost:\d+\/login/);
  });

  test("WebSocket: fremde Ticket-Kanäle und der Team-Kanal werden verweigert", async ({ page, browser }) => {
    const baeckerContext = await newContext(browser);
    const baecker = await baeckerContext.newPage();
    const data = await baeckereiData(baecker);
    await baeckerContext.close();

    await loginPortal(page, "muster", ACCOUNTS.berger.email);
    const ownId = await createPortalTicket(page, "muster", {
      subject: unique("Eigenes Ticket für den Kanaltest"),
      description: "Nur zum Prüfen der Live-Kanäle.",
    });

    const result = await wsExchange(page, [
      { t: "sub", ch: "ticket", id: data.ticketId },
      { t: "sub", ch: "ticket", id: data.ticketId, token: "geratener-status-link-123" },
      { t: "sub", ch: "staff" },
      { t: "sub", ch: "inquiry", id: 1 },
      { t: "sub", ch: "ticket", id: ownId },
    ]);

    expect(result.messages[0]).toMatchObject({ t: "hello", role: "customer", name: ACCOUNTS.berger.name });
    const replies = result.messages.filter((m) => m.t === "subscribed" || m.t === "denied");
    expect(replies).toEqual([
      { t: "denied", ch: "ticket", id: data.ticketId },
      { t: "denied", ch: "ticket", id: data.ticketId },
      { t: "denied", ch: "staff" },
      { t: "denied", ch: "inquiry" },
      { t: "subscribed", key: `ticket:${ownId}` },
    ]);
    // Keine Signale aus dem fremden Kanal
    expect(result.messages.some((m) => m.key === `ticket:${data.ticketId}`)).toBe(false);
  });

  test("WebSocket: Verbindungen von fremden Seiten (Origin) werden abgelehnt", async () => {
    const connect = (origin: string) =>
      new Promise<{ status: number; hello?: Record<string, unknown> }>((resolve, reject) => {
        const socket = new NodeWebSocket(`ws://127.0.0.1:${PORT}/_ws`, {
          headers: { Host: `localhost:${PORT}`, Origin: origin },
        });
        socket.on("unexpected-response", (_req, res) => {
          resolve({ status: res.statusCode ?? 0 });
          socket.terminate();
        });
        socket.on("message", (data) => {
          resolve({ status: 101, hello: JSON.parse(String(data)) as Record<string, unknown> });
          socket.close();
        });
        socket.on("error", (error) => reject(error));
      });

    expect((await connect("http://evil.example")).status).toBe(403);
    expect((await connect(`http://muster.localhost:${PORT}`)).status).toBe(403);
    // Gegenprobe: gleiche Herkunft wird angenommen (ohne Sitzung als Gast)
    const same = await connect(`http://localhost:${PORT}`);
    expect(same.status).toBe(101);
    expect(same.hello).toMatchObject({ t: "hello", role: "guest", name: null });
  });

  test("Open-Redirect über ?next= bleibt auf der eigenen Seite", async ({ page }) => {
    for (const next of ["/%09/evil.example", "//evil.example", "https://evil.example/", "/%5Cevil.example"]) {
      await login(page, main(`/admin/login?next=${next}`), ACCOUNTS.tech.email);
      await expect(page).toHaveURL(main("/admin"));
      expect(new URL(page.url()).host).toBe(`localhost:${PORT}`);
      await page.context().clearCookies();
    }

    await login(page, portal("muster", "/login?next=/%09/evil.example"), ACCOUNTS.berger.email);
    await expect(page).toHaveURL(portal("muster", "/"));

    // Gültiges Ziel auf derselben Seite wird übernommen
    await page.context().clearCookies();
    await login(page, main("/admin/login?next=%2Fadmin%2Ftickets"), ACCOUNTS.tech.email);
    await expect(page).toHaveURL(main("/admin/tickets"));
  });
});

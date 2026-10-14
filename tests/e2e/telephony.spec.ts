import { PORT } from "./env";
import type { APIRequestContext, Page } from "@playwright/test";
import { E2E_TELEPHONY_TOKEN } from "./env";
import { test, expect, loginStaff, main, nextClientIp, unique, waitForSubscription, ACCOUNTS } from "./fixtures";

/**
 * Telefonanlage: Webhook /api/telefonie (generisches JSON-Format) → Live-Hinweis in der Verwaltung,
 * Anrufer-Erkennung, verpasste Anrufe und „Ticket aus Anruf“.
 * Muster Steuerberatung hat in den Beispieldaten die Nummer „01234 567890“ – der Webhook meldet sie
 * in internationaler Schreibweise.
 */
const MUSTER_INTERNATIONAL = "+49 1234 567890";

async function sendCallEvent(
  request: APIRequestContext,
  body: Record<string, unknown>,
  opts: { token?: string | null; ip?: string; headers?: Record<string, string> } = {},
) {
  const token = opts.token === undefined ? E2E_TELEPHONY_TOKEN : opts.token;
  return request.post(main("/api/telefonie"), {
    data: body,
    headers: {
      "X-Forwarded-For": opts.ip ?? nextClientIp(),
      ...(token ? { "X-Hertlin-Token": token } : {}),
      ...opts.headers,
    },
  });
}

/** Zähler verpasster Anrufe in der Navigation (0, wenn keiner angezeigt wird). */
async function missedCount(page: Page): Promise<number> {
  const link = page.getByRole("navigation", { name: "Hauptnavigation" }).first().getByRole("link", { name: /^Anrufe/ });
  const text = (await link.textContent()) ?? "";
  const match = text.match(/(\d+)\s*$/);
  return match ? Number(match[1]) : 0;
}

test.describe("Telefonanlage", () => {
  test("eingehender Anruf erscheint live mit erkanntem Kunden, verpasst zählt, Ticket aus Anruf", async ({ page, request }) => {
    await loginStaff(page, ACCOUNTS.tech.email);
    const subscribed = waitForSubscription(page, "staff");
    await page.goto(main("/admin/anrufe"));
    await subscribed;
    const before = await missedCount(page);

    // Es klingelt
    const callId = unique("e2e-call").replace(/\s/g, "-");
    const ringing = await sendCallEvent(request, {
      event: "ringing",
      callId,
      from: MUSTER_INTERNATIONAL,
      to: "0711 123456",
      direction: "in",
    });
    expect(ringing.status()).toBe(200);
    const { id: phoneCallId, status } = (await ringing.json()) as { id: string; status: string };
    expect(status).toBe("RINGING");

    // Live-Hinweis mit erkanntem Kunden
    const toast = page.locator("div.pointer-events-auto").filter({ hasText: "Eingehender Anruf" });
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Muster Steuerberatung GmbH");
    await expect(toast.getByRole("link", { name: "Kunde öffnen" })).toBeVisible();
    await expect(toast.getByRole("link", { name: "Ticket anlegen" })).toHaveAttribute(
      "href",
      `/admin/anrufe/${phoneCallId}#ticket-anlegen`,
    );

    // Aufgelegt, ohne dass jemand angenommen hat -> verpasst
    const ended = await sendCallEvent(request, { event: "ended", callId });
    expect(ended.status()).toBe(200);
    expect(((await ended.json()) as { status: string }).status).toBe("MISSED");
    await expect(toast).toHaveCount(0);
    await expect.poll(() => missedCount(page)).toBe(before + 1);

    // Anrufliste zeigt den verpassten Anruf mit Kunde
    await page.goto(main("/admin/anrufe?verpasst=1&zeitraum=alle"));
    const row = page.getByRole("row").filter({ hasText: "+49 1234 567890" }).filter({ hasText: "Muster Steuerberatung GmbH" });
    await expect(row.first()).toContainText("Verpasst");

    // Ticket aus dem Anruf anlegen
    await page.goto(main(`/admin/anrufe/${phoneCallId}`));
    const form = page.locator("#ticket-anlegen");
    await expect(form.getByRole("heading", { name: "Ticket aus Anruf anlegen" })).toBeVisible();
    const subject = unique("Rückruf: Drucker im Empfang");
    await form.getByLabel("Betreff").fill(subject);
    await form.getByLabel("Gesprächsnotiz (intern)").fill("Frau Berger hat angerufen, Drucker zieht kein Papier ein.");
    await form.getByRole("button", { name: "Ticket anlegen" }).click();
    await expect(page).toHaveURL(/\/admin\/tickets\/\d+$/);
    await expect(page.getByRole("heading", { level: 1, name: subject })).toBeVisible();
    await expect(page.getByText("Muster Steuerberatung GmbH").first()).toBeVisible();

    // Der Anruf ist damit erledigt: Zähler sinkt wieder
    await page.goto(main(`/admin/anrufe/${phoneCallId}`));
    await expect(page.getByText(subject)).toBeVisible();
    expect(await missedCount(page)).toBe(before);
  });

  test("angenommener Anruf zählt nicht als verpasst", async ({ page, request }) => {
    await loginStaff(page, ACCOUNTS.admin.email);
    const subscribed = waitForSubscription(page, "staff");
    await page.goto(main("/admin"));
    await subscribed;
    const before = await missedCount(page);

    const callId = unique("e2e-answered").replace(/\s/g, "-");
    expect((await sendCallEvent(request, { event: "ringing", callId, from: "+49 170 1112223" })).status()).toBe(200);
    const toast = page.locator("div.pointer-events-auto").filter({ hasText: "Eingehender Anruf" });
    await expect(toast).toBeVisible();
    // Unbekannte Nummer: kein Kunde verknüpft
    await expect(toast.getByRole("link", { name: "Kunde öffnen" })).toHaveCount(0);

    const answered = await sendCallEvent(request, { event: "answered", callId, answeredBy: "Jonas Keller" });
    expect(((await answered.json()) as { status: string }).status).toBe("ANSWERED");
    await expect(toast).toHaveCount(0);

    const ended = await sendCallEvent(request, { event: "ended", callId });
    expect(((await ended.json()) as { status: string }).status).toBe("ENDED");
    await page.reload();
    expect(await missedCount(page)).toBe(before);
  });

  test("Webhook ohne oder mit falschem Zugangsschlüssel wird abgelehnt", async ({ request }) => {
    const ip = nextClientIp();
    const body = { event: "ringing", callId: "e2e-unbefugt", from: MUSTER_INTERNATIONAL };

    const missing = await sendCallEvent(request, body, { token: null, ip });
    expect(missing.status()).toBe(401);

    const wrong = await sendCallEvent(request, body, { token: "falscher-zugangsschluessel-0000000000", ip });
    expect(wrong.status()).toBe(401);
    expect(await wrong.text()).not.toContain(E2E_TELEPHONY_TOKEN);

    // Token als Query-Parameter funktioniert ebenso
    const viaQuery = await request.post(main(`/api/telefonie?token=${encodeURIComponent(E2E_TELEPHONY_TOKEN)}`), {
      data: { event: "ringing", callId: unique("e2e-query").replace(/\s/g, "-"), from: "+49 30 1234567" },
      headers: { "X-Forwarded-For": nextClientIp() },
    });
    expect(viaQuery.status()).toBe(200);

    // Ungültige Meldung mit gültigem Schlüssel
    const invalid = await sendCallEvent(request, { event: "explodiert", callId: "x" });
    expect(invalid.status()).toBe(400);

    // Kundenportale kennen den Webhook nicht
    const viaPortal = await sendCallEvent(request, body, { headers: { "X-Forwarded-Host": `muster.localhost:${PORT}` } });
    expect(viaPortal.status()).toBe(404);

    // GET ist nicht vorgesehen
    const get = await request.get(main("/api/telefonie"), { headers: { "X-Forwarded-For": nextClientIp() } });
    expect(get.status()).toBe(405);
  });
});

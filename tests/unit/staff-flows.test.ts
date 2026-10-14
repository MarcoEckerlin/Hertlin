import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction } from "@/lib/actions/auth";
import { createSession } from "@/lib/auth";
import { privateAccountLabels } from "@/lib/costs";
import { settingsLabelList } from "@/components/admin/website/settings-labels";
import { initialFormState } from "@/lib/forms";

// Anmeldung ohne Datenbank: jedes Konto gibt es, das Passwort ist „richtig“
const requestHeaders = { current: new Headers() };
vi.mock("next/headers", () => ({ headers: async () => requestHeaders.current, cookies: async () => new Map() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("next/server", () => ({ after: vi.fn(), connection: async () => undefined }));
vi.mock("@/lib/auth", () => ({
  isMainHost: async () => true,
  getPortalSlugFromHost: async () => null,
  getPortalCompany: async () => null,
  createSession: vi.fn(async () => undefined),
  destroySession: vi.fn(),
  destroyAllSessions: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async () => ({ id: "u1", role: "ADMIN", active: true, passwordHash: "hash", company: null }),
    },
  },
}));
vi.mock("@/lib/crypto", () => ({
  hashPassword: async () => "dummy",
  verifyPassword: async (password: string) => password === "richtig",
}));
vi.mock("@/lib/auth-tokens", () => ({}));
vi.mock("@/lib/notifications", () => ({}));
vi.mock("@/lib/settings", () => ({ getSiteSettings: async () => ({ phone: "0711 000000" }) }));

function login(email: string, password: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", password);
  return loginAction(initialFormState, fd);
}

describe("Anmeldesperre je IP-Adresse", () => {
  beforeEach(() => {
    vi.mocked(createSession).mockClear();
  });

  it("zählt erfolgreiche Anmeldungen nicht mit (z. B. viele Mitarbeiter hinter einem NAT)", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.10" });
    for (let i = 0; i < 60; i++) {
      await expect(login(`person${i % 5}@firma.example`, "richtig")).rejects.toThrow("REDIRECT /admin");
    }
    expect(createSession).toHaveBeenCalledTimes(60);
  });

  it("sperrt die Adresse weiterhin nach vielen Fehlversuchen über verschiedene Konten", async () => {
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.11" });
    for (let i = 0; i < 40; i++) {
      const state = await login(`konto${i}@firma.example`, "falsch");
      expect(state.message).toBe("E-Mail-Adresse oder Passwort stimmen nicht.");
    }
    const blocked = await login("chef@firma.example", "richtig");
    expect(blocked.message).toMatch(/Zu viele Anmeldeversuche/);
    expect(createSession).not.toHaveBeenCalled();

    // Andere Adressen sind davon nicht betroffen
    requestHeaders.current = new Headers({ "x-forwarded-for": "198.51.100.12" });
    await expect(login("chef@firma.example", "richtig")).rejects.toThrow("REDIRECT");
  });
});

describe("CSV-Export: Privatkunden-Konto", () => {
  it("fasst Schreibweisen der E-Mail zusammen und nimmt den Namen aus dem jüngsten Ticket", () => {
    const labels = privateAccountLabels([
      { id: 3, contactName: "QA Privat Person", contactEmail: "qa2privat@example.org" },
      { id: 9, contactName: "QA Privat P.", contactEmail: " QA2Privat@Example.org" },
      { id: 12, contactName: "  ", contactEmail: "qa2privat@EXAMPLE.org" },
      { id: 4, contactName: "Ohne Mail", contactEmail: null },
      { id: 5, contactName: null, contactEmail: "" },
    ]);
    expect(labels.get(3)).toBe("QA Privat P., qa2privat@example.org");
    expect(labels.get(9)).toBe("QA Privat P., qa2privat@example.org");
    expect(labels.get(12)).toBe("QA Privat P., qa2privat@example.org");
    expect(labels.get(4)).toBe("Ohne Mail");
    expect(labels.get(5)).toBe("Privatkunde zu T-00005");
  });

  it("zeigt nur die Adresse, wenn kein Ticket einen Namen hat", () => {
    expect(privateAccountLabels([{ id: 1, contactName: null, contactEmail: "A@B.de" }]).get(1)).toBe("a@b.de");
  });
});

describe("Hinweis auf unvollständige Firmendaten", () => {
  it("nennt deutsche Bezeichnungen statt interner Schlüssel", () => {
    expect(settingsLabelList(["vatId", "hostingProvider"])).toBe("USt-IdNr., Hosting-Anbieter");
  });
});

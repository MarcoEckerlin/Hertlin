import { describe, expect, it, vi } from "vitest";

/** Standort neuer Tickets: Firma → Firmenkunde → (Privatkunde) Hauptsitz; nur aktive Standorte. */

type Loc = { id: string; active: boolean; isMain?: boolean };
const locations: Record<string, Loc> = {
  zentrale: { id: "zentrale", active: true, isMain: true },
  ulm: { id: "ulm", active: true },
  alt: { id: "alt", active: false },
};
const companies: Record<string, { location: Loc | null; parent: { location: Loc | null } | null }> = {
  muster: { location: locations.zentrale, parent: null },
  ulmBuero: { location: locations.ulm, parent: { location: locations.zentrale } },
  homeoffice: { location: null, parent: { location: locations.zentrale } },
  geschlossen: { location: locations.alt, parent: null },
  ohne: { location: null, parent: null },
};
const mainLocation = { current: locations.zentrale as Loc | null };

vi.mock("@/lib/db", () => ({
  db: {
    location: { findFirst: async () => (mainLocation.current ? { id: mainLocation.current.id } : null) },
    company: { findUnique: async ({ where }: { where: { id: string } }) => companies[where.id] ?? null },
  },
}));

const { defaultTicketLocationId } = await import("@/components/admin/tickets/data");

describe("Standort neuer Tickets", () => {
  it("nimmt den Standort der Firma", async () => {
    expect(await defaultTicketLocationId("muster")).toBe("zentrale");
    expect(await defaultTicketLocationId("ulmBuero")).toBe("ulm");
  });

  it("Unterkunde ohne eigenen Standort: der des Firmenkunden", async () => {
    expect(await defaultTicketLocationId("homeoffice")).toBe("zentrale");
  });

  it("deaktivierte Standorte und Firmen ohne Standort ergeben keinen", async () => {
    expect(await defaultTicketLocationId("geschlossen")).toBeNull();
    expect(await defaultTicketLocationId("ohne")).toBeNull();
    expect(await defaultTicketLocationId("gibt-es-nicht")).toBeNull();
  });

  it("Privatkunden: Hauptsitz, ohne Standorte keiner", async () => {
    expect(await defaultTicketLocationId(null)).toBe("zentrale");
    mainLocation.current = null;
    expect(await defaultTicketLocationId(null)).toBeNull();
  });
});

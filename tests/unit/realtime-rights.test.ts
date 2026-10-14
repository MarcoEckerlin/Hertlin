import { describe, expect, it } from "vitest";
import { sameRights, ticketVisibleTo } from "@/realtime/ws-server";

const ulmAdmin = {
  kind: "customer" as const,
  userId: "ulm",
  name: "Peter Wagner",
  sessionHash: "abc",
  rootCompanyId: "muster",
  companyId: "ulm",
  isAdmin: true,
  isRootAdmin: false,
};

describe("WebSocket: Rechte einer offenen Verbindung", () => {
  it("Namensänderung ändert nichts an den Rechten", () => {
    expect(sameRights(ulmAdmin, { ...ulmAdmin, name: "Peter Wagner-Ulm" })).toBe(true);
  });

  it("Herabstufen, Umhängen oder Abmelden gilt als Änderung", () => {
    expect(sameRights(ulmAdmin, { ...ulmAdmin, isAdmin: false })).toBe(false);
    expect(sameRights(ulmAdmin, { ...ulmAdmin, companyId: "homeoffice" })).toBe(false);
    expect(sameRights(ulmAdmin, { kind: "anonymous" })).toBe(false);
    expect(sameRights({ kind: "staff", userId: "t", name: "Jonas", sessionHash: "x" }, ulmAdmin)).toBe(false);
  });

  it("Ticket-Sichtbarkeit wie im Portal", () => {
    const ulmTicket = { companyId: "ulm", createdById: "berger", company: { id: "ulm", parentId: "muster" } };
    expect(ticketVisibleTo(ulmAdmin, ulmTicket)).toBe(true);
    // Nach dem Herabstufen: nur noch eigene Tickets
    expect(ticketVisibleTo({ ...ulmAdmin, isAdmin: false }, ulmTicket)).toBe(false);
    expect(ticketVisibleTo({ ...ulmAdmin, isAdmin: false }, { ...ulmTicket, createdById: "ulm" })).toBe(true);
    // Andere Unterkunde oder anderer Firmenkunde
    expect(ticketVisibleTo(ulmAdmin, { ...ulmTicket, companyId: "homeoffice", company: { id: "homeoffice", parentId: "muster" } })).toBe(false);
    expect(ticketVisibleTo(ulmAdmin, { companyId: "baeckerei", createdById: "ulm", company: { id: "baeckerei", parentId: null } })).toBe(false);
    expect(ticketVisibleTo(ulmAdmin, { companyId: null, createdById: "ulm", company: null })).toBe(false);
  });
});

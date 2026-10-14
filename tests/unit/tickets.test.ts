import { describe, expect, it } from "vitest";
import {
  canCustomerReply,
  customerTicketLink,
  portalAccountSeesTicket,
  statusAfterCustomerReply,
  statusAfterStaffReply,
} from "@/lib/tickets";

describe("Statuslogik", () => {
  it("öffnet Tickets nach Kundenantwort wieder", () => {
    expect(statusAfterCustomerReply("WAITING_CUSTOMER")).toBe("IN_PROGRESS");
    expect(statusAfterCustomerReply("RESOLVED")).toBe("IN_PROGRESS");
    expect(statusAfterCustomerReply("NEW")).toBe("NEW");
    expect(statusAfterCustomerReply("IN_PROGRESS")).toBe("IN_PROGRESS");
  });

  it("setzt neue Tickets nach der ersten Antwort in Bearbeitung", () => {
    expect(statusAfterStaffReply("NEW")).toBe("IN_PROGRESS");
    expect(statusAfterStaffReply("WAITING_CUSTOMER")).toBe("WAITING_CUSTOMER");
  });

  it("nimmt bei geschlossenen Tickets keine Antworten an", () => {
    expect(canCustomerReply("CLOSED")).toBe(false);
    expect(canCustomerReply("RESOLVED")).toBe(true);
  });
});

describe("customerTicketLink", () => {
  it("verlinkt Firmen- und Unterkunden-Tickets ins Portal des Firmenkunden", () => {
    process.env.ROOT_DOMAIN = "hertlin.de";
    process.env.APP_PROTOCOL = "https";
    expect(customerTicketLink({ id: 7, guestToken: null, company: { slug: "muster", parent: null } })).toBe(
      "https://muster.hertlin.de/tickets/7",
    );
    expect(customerTicketLink({ id: 8, guestToken: null, company: { slug: null, parent: { slug: "muster" } } })).toBe(
      "https://muster.hertlin.de/tickets/8",
    );
  });

  it("verlinkt Privatkunden auf den Status-Link", () => {
    expect(customerTicketLink({ id: 9, guestToken: "abc", company: null })).toBe("https://hertlin.de/status/abc");
    expect(customerTicketLink({ id: 9, guestToken: null, company: null })).toBeNull();
  });
});

describe("portalAccountSeesTicket (Empfänger von E-Mails)", () => {
  const root = { id: "muster", parentId: null, active: true, parent: null };
  const ulm = { id: "ulm", parentId: "muster", active: true, parent: { active: true } };
  const account = (over: Partial<Parameters<typeof portalAccountSeesTicket>[0]> = {}) => ({
    id: "yilmaz",
    role: "CUSTOMER_USER",
    active: true,
    company: root,
    ...over,
  });
  const rootTicket = { companyId: "muster", createdById: "yilmaz", company: { parentId: null } };
  const ulmTicket = { companyId: "ulm", createdById: "ulm-user", company: { parentId: "muster" } };

  it("Ersteller sieht sein Ticket, solange Konto und Firma aktiv sind", () => {
    expect(portalAccountSeesTicket(account(), rootTicket)).toBe(true);
    expect(portalAccountSeesTicket(account({ active: false }), rootTicket)).toBe(false);
    expect(portalAccountSeesTicket(account({ company: { ...root, active: false } }), rootTicket)).toBe(false);
    expect(portalAccountSeesTicket(account({ company: { ...ulm, parent: { active: false } } }), ulmTicket)).toBe(false);
  });

  it("nach dem Umhängen in eine Unterkunde sieht ein Mitarbeiter alte Tickets nicht mehr", () => {
    expect(portalAccountSeesTicket(account({ company: ulm }), rootTicket)).toBe(false);
  });

  it("Mitarbeiter sehen nur eigene Tickets, Hauptansprechpartner alle ihrer Firma", () => {
    expect(portalAccountSeesTicket(account({ id: "andere" }), rootTicket)).toBe(false);
    expect(portalAccountSeesTicket(account({ id: "berger", role: "CUSTOMER_ADMIN" }), rootTicket)).toBe(true);
    expect(portalAccountSeesTicket(account({ id: "berger", role: "CUSTOMER_ADMIN" }), ulmTicket)).toBe(true);
    expect(portalAccountSeesTicket(account({ id: "ulm-admin", role: "CUSTOMER_ADMIN", company: ulm }), ulmTicket)).toBe(true);
    expect(portalAccountSeesTicket(account({ id: "ulm-admin", role: "CUSTOMER_ADMIN", company: ulm }), rootTicket)).toBe(false);
  });

  it("Hertlin-Konten, fremde Firmen und Privatkunden-Tickets zählen nicht", () => {
    expect(portalAccountSeesTicket(account({ role: "ADMIN" }), rootTicket)).toBe(false);
    const other = { id: "baeckerei", parentId: null, active: true, parent: null };
    expect(portalAccountSeesTicket(account({ role: "CUSTOMER_ADMIN", company: other }), rootTicket)).toBe(false);
    expect(portalAccountSeesTicket(account(), { companyId: null, createdById: "yilmaz", company: null })).toBe(false);
  });
});

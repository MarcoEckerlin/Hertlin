import { describe, expect, it } from "vitest";
import { canCustomerReply, customerTicketLink, statusAfterCustomerReply, statusAfterStaffReply } from "@/lib/tickets";

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

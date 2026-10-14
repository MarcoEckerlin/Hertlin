import { describe, expect, it } from "vitest";
import { loginRedirectTarget } from "@/lib/hosts";
import { isRecipientPresent, type PresenceEntry } from "@/realtime/bus";
import { searchKey } from "@/components/portal/admin/data";

describe("Anmeldung mit Rücksprung (?next=)", () => {
  it("merkt sich die angefragte Seite, z. B. aus einem E-Mail-Link", () => {
    expect(loginRedirectTarget("/login", "/tickets/7", "/")).toBe("/login?next=%2Ftickets%2F7");
    expect(loginRedirectTarget("/admin/login", "/admin/tickets/7?ansicht=verlauf", "/admin")).toBe(
      "/admin/login?next=%2Fadmin%2Ftickets%2F7%3Fansicht%3Dverlauf",
    );
  });

  it("lässt next bei der Startseite, der Anmeldeseite und ohne Pfad weg", () => {
    expect(loginRedirectTarget("/login", "/", "/")).toBe("/login");
    expect(loginRedirectTarget("/admin/login", "/admin", "/admin")).toBe("/admin/login");
    expect(loginRedirectTarget("/login", "/login?next=%2Ftickets", "/")).toBe("/login");
    expect(loginRedirectTarget("/login", null, "/")).toBe("/login");
    expect(loginRedirectTarget("/login", "", "/")).toBe("/login");
  });

  it("nimmt keine fremden Ziele an", () => {
    expect(loginRedirectTarget("/login", "//evil.example/tickets", "/")).toBe("/login");
    expect(loginRedirectTarget("/login", "https://evil.example/", "/")).toBe("/login");
    expect(loginRedirectTarget("/login", "/\\evil.example", "/")).toBe("/login");
  });
});

describe("E-Mail an den Kunden entfällt nur, wenn der Empfänger selbst zusieht", () => {
  const staff: PresenceEntry = { name: "Jonas Hertlin", staff: true, userId: "staff-1" };
  const rootAdmin: PresenceEntry = { name: "Sabine Berger", staff: false, userId: "berger" };
  const creator: PresenceEntry = { name: "Deniz Yilmaz", staff: false, userId: "yilmaz" };
  const guest: PresenceEntry = { name: "Max Privat", staff: false };

  it("Hauptansprechpartner im Ticket ersetzt nicht die E-Mail an den Ersteller", () => {
    expect(isRecipientPresent([staff, rootAdmin], "yilmaz")).toBe(false);
    expect(isRecipientPresent([staff, rootAdmin, creator], "yilmaz")).toBe(true);
  });

  it("Privatkunde mit Status-Link: Gäste im Kanal zählen, angemeldete Konten nicht", () => {
    expect(isRecipientPresent([guest], null)).toBe(true);
    expect(isRecipientPresent([rootAdmin, staff], null)).toBe(false);
  });

  it("Mitarbeiter von Hertlin zählen nie als Kunde", () => {
    expect(isRecipientPresent([staff], "staff-1")).toBe(false);
    expect(isRecipientPresent([], "yilmaz")).toBe(false);
  });
});

describe("Ticketsuche im Portal", () => {
  it("findet Umlaute unabhängig von Groß- und Kleinschreibung", () => {
    const subject = searchKey("Drucker im Empfang bricht ständig ab");
    expect(subject.includes(searchKey("STÄNDIG"))).toBe(true);
    expect(subject.includes(searchKey("ständig"))).toBe(true);
    expect(searchKey("Straße").includes(searchKey("STRASSE"))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { AMBIGUOUS_CALLER_LABEL, resolveCaller, storedCallerLabel, type CallerCandidates } from "@/lib/telephony";

type Company = CallerCandidates["companies"][number];

const muster: Company = { id: "muster", name: "Muster GmbH", parentId: null, parent: null, active: true };
const ulm: Company = {
  id: "ulm",
  name: "Büro Ulm",
  parentId: "muster",
  parent: { id: "muster", name: "Muster GmbH", active: true },
  active: true,
};
const baeckerei: Company = { id: "baeckerei", name: "Bäckerei Beispiel", parentId: null, parent: null, active: true };

function user(id: string, company: Company, active = true): CallerCandidates["users"][number] {
  return { id, name: `Person ${id}`, email: `${id}@example.org`, active, company };
}

function candidates(partial: Partial<CallerCandidates>): CallerCandidates {
  return { users: [], companies: [], tickets: [], inquiries: [], ...partial };
}

describe("Anrufer erkennen: Mandantentrennung", () => {
  it("Firmennummer (von Hertlin gepflegt) schlägt eine selbst eingetragene Nummer eines anderen Kunden", () => {
    const match = resolveCaller(candidates({ users: [user("chef", baeckerei)], companies: [muster] }));
    expect(match).toMatchObject({ source: "company", companyId: "muster", userId: null });
  });

  it("ordnet nicht zu, wenn Benutzer verschiedener Kunden dieselbe Nummer eingetragen haben", () => {
    const match = resolveCaller(candidates({ users: [user("chef", baeckerei), user("yilmaz", muster)] }));
    expect(match).toMatchObject({ source: "ambiguous", label: AMBIGUOUS_CALLER_LABEL, companyId: null, userId: null });
    expect(storedCallerLabel(match)).toBeNull();
  });

  it("ordnet nicht zu, wenn die Kontaktnummer eines Tickets zu einem anderen Kunden gehört", () => {
    const ticket = { id: 4, contactName: "Frau Berger", contactEmail: "berger@muster.example", company: muster };
    const match = resolveCaller(candidates({ users: [user("chef", baeckerei)], tickets: [ticket] }));
    expect(match?.source).toBe("ambiguous");
  });

  it("Unterkunden-Nummer eines anderen Kunden zählt ebenfalls nur als Behauptung", () => {
    const match = resolveCaller(candidates({ users: [user("chef", baeckerei)], companies: [ulm] }));
    expect(match?.source).toBe("ambiguous");
  });

  it("deaktivierte Kunden zählen nur, wenn kein aktiver die Nummer kennt", () => {
    const formerCustomer: Company = { ...baeckerei, active: false };
    expect(resolveCaller(candidates({ users: [user("chef", formerCustomer), user("yilmaz", muster)] }))).toMatchObject({
      source: "user",
      userId: "yilmaz",
    });
    expect(resolveCaller(candidates({ users: [user("chef", formerCustomer)] }))).toMatchObject({ source: "user", userId: "chef" });
  });

  it("zwei aktive Firmenkunden mit derselben Nummer: mehrdeutig", () => {
    expect(resolveCaller(candidates({ companies: [muster, baeckerei] }))?.source).toBe("ambiguous");
  });
});

describe("Anrufer erkennen: innerhalb eines Kunden", () => {
  it("erkennt eine Person mit eigener Nummer", () => {
    expect(resolveCaller(candidates({ users: [user("ulm", ulm)] }))).toMatchObject({
      source: "user",
      userId: "ulm",
      companyId: "ulm",
      rootCompanyId: "muster",
    });
  });

  it("bevorzugt aktive Benutzer", () => {
    const match = resolveCaller(candidates({ users: [user("alt", muster, false), user("neu", muster)] }));
    expect(match).toMatchObject({ source: "user", userId: "neu" });
  });

  it("teilen sich mehrere Personen eine Nummer, wird nur die Firma vorgeschlagen", () => {
    expect(resolveCaller(candidates({ users: [user("a", ulm), user("b", ulm)] }))).toMatchObject({
      source: "company",
      companyId: "ulm",
      userId: null,
    });
    expect(resolveCaller(candidates({ users: [user("a", ulm), user("b", muster)] }))).toMatchObject({
      source: "company",
      companyId: "muster",
      userId: null,
    });
  });

  it("Firmennummer gleich Benutzernummer (Zentrale): Firma statt Person", () => {
    const match = resolveCaller(candidates({ users: [user("yilmaz", muster)], companies: [muster] }));
    expect(match).toMatchObject({ source: "company", companyId: "muster", userId: null });
  });

  it("Unterkunden-Nummer ohne Benutzer", () => {
    expect(resolveCaller(candidates({ companies: [ulm] }))).toMatchObject({ source: "company", companyId: "ulm", label: "Muster GmbH › Büro Ulm" });
  });
});

describe("Anrufer erkennen: Privatkunden und Anfragen", () => {
  const privateTicket = (id: number, email: string | null) => ({ id, contactName: "Max Privat", contactEmail: email, company: null });

  it("erkennt Privatkunden über das jüngste Ticket derselben Person", () => {
    const match = resolveCaller(candidates({ tickets: [privateTicket(9, "max@example.org"), privateTicket(3, "MAX@example.org ")] }));
    expect(match).toMatchObject({ source: "ticket", ticketId: 9, companyId: null, contactEmail: "max@example.org" });
  });

  it("verschiedene Personen mit derselben Nummer: mehrdeutig, keine Kontaktdaten", () => {
    const match = resolveCaller(candidates({ tickets: [privateTicket(9, "fremd@example.org"), privateTicket(3, "max@example.org")] }));
    expect(match).toMatchObject({ source: "ambiguous", contactEmail: null, contactName: null, ticketId: null });
  });

  it("Privatkunden-Ticket über das öffentliche Formular verdrängt keinen Firmenkunden", () => {
    const match = resolveCaller(candidates({ users: [user("yilmaz", muster)], tickets: [privateTicket(9, "angreifer@example.org")] }));
    expect(match).toMatchObject({ source: "user", userId: "yilmaz" });
  });

  it("Anfragen verschiedener Personen: mehrdeutig", () => {
    const inquiry = (id: number, email: string) => ({ id, name: "Interessent", companyName: null, email, company: null });
    expect(resolveCaller(candidates({ inquiries: [inquiry(2, "a@example.org")] }))).toMatchObject({ source: "inquiry", inquiryId: 2 });
    expect(resolveCaller(candidates({ inquiries: [inquiry(2, "a@example.org"), inquiry(1, "b@example.org")] }))?.source).toBe("ambiguous");
  });

  it("ohne Treffer: null", () => {
    expect(resolveCaller(candidates({}))).toBeNull();
  });
});

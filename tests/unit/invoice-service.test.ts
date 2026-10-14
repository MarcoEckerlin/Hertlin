import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Rechnungen gegen eine echte, leere SQLite-Datenbank (Migrationen wie in Produktion):
 * Nummernvergabe in der Transaktion, gesperrte Positionen, Storno, PDF-Ablage.
 */

const dir = mkdtempSync(path.join(tmpdir(), "hertlin-invoice-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.UPLOAD_DIR = path.join(dir, "uploads");

type Service = typeof import("@/lib/invoices/service");
type Recipients = typeof import("@/lib/invoices/recipients");
type Db = typeof import("@/lib/db");

let service: Service;
let recipients: Recipients;
let db: Db["db"];

const SITE = {
  name: "Hertlin",
  legalName: "Hertlin IT-Service",
  owner: "Anna Hertlin",
  street: "Hauptstraße 21",
  zip: "12345",
  city: "Musterstadt",
  phone: "01234 98760",
  email: "info@hertlin.de",
  vatId: "DE123456789",
};
const BILLING = { taxNumber: "12/345/67890", iban: "DE89370400440532013000", bankAccountHolder: "Hertlin IT-Service" };

let adminId = "";
let rootId = "";
let subId = "";
let rootTicket = 0;
let subTicket = 0;

async function entry(ticketId: number, description: string, totalCents: number, extra: Record<string, unknown> = {}) {
  const created = await db.costEntry.create({
    data: {
      ticketId,
      kind: "LABOR",
      description,
      quantityHundredths: 100,
      unit: "Std.",
      unitPriceCents: totalCents,
      totalCents,
      performedAt: new Date("2026-10-12T09:00:00Z"),
      createdById: adminId,
      ...extra,
    },
  });
  return created.id;
}

async function create(companyId: string, ids: string[]) {
  const recipient = await recipients.resolveRecipient({ kind: "company", companyId });
  if (!recipient) throw new Error("Empfänger fehlt");
  return service.createInvoice({
    recipient,
    entryIds: ids,
    recipientName: recipient.name,
    recipientAddress: recipient.addressLines.join("\n"),
    recipientEmail: recipient.email,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    introText: "Vielen Dank.",
    createdById: adminId,
  });
}

function pdfText(file: string): string | null {
  try {
    return execFileSync("pdftotext", ["-layout", file, "-"]).toString("utf8");
  } catch {
    return null;
  }
}

beforeAll(async () => {
  const bin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
  execFileSync(bin, ["migrate", "deploy"], { stdio: "ignore", env: process.env });

  ({ db } = await import("@/lib/db"));
  service = await import("@/lib/invoices/service");
  recipients = await import("@/lib/invoices/recipients");

  const admin = await db.user.create({ data: { email: "admin@test.example", name: "Admin", role: "ADMIN" } });
  adminId = admin.id;
  const root = await db.company.create({
    data: {
      name: "Muster GmbH",
      slug: "muster",
      customerNumber: "K-1",
      street: "Beispielweg 12",
      zip: "12345",
      city: "Musterstadt",
      billingEmail: "buchhaltung@muster.example",
    },
  });
  rootId = root.id;
  const sub = await db.company.create({
    data: {
      name: "Büro Ulm",
      parentId: root.id,
      street: "Am Markt 3",
      zip: "89073",
      city: "Ulm",
      invoiceSeparately: true,
      billingEmail: "ulm@muster.example",
    },
  });
  subId = sub.id;
  rootTicket = (await db.ticket.create({ data: { subject: "Drucker", companyId: root.id } })).id;
  subTicket = (await db.ticket.create({ data: { subject: "Notebook", companyId: sub.id } })).id;

  await db.siteSetting.create({ data: { key: "company", value: JSON.stringify(SITE) } });
  await db.siteSetting.create({ data: { key: "billing", value: JSON.stringify(BILLING) } });
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("Rechnungen erstellen", () => {
  it("vergibt fortlaufende Nummern, kopiert Positionen und markiert sie als abgerechnet", async () => {
    const a = await entry(rootTicket, "Austausch Trommel", 14_250);
    const b = await entry(rootTicket, "Trommeleinheit", 1999, { kind: "MATERIAL", unit: "Stk." });
    const result = await create(rootId, [a, b]);
    if (!result.ok) throw new Error(result.error);

    const year = new Date().getFullYear();
    expect(result.number).toBe(`RE-${year}-0001`);
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: result.invoiceId }, include: { lines: true } });
    expect(invoice.netCents).toBe(16_249);
    expect(invoice.taxCents).toBe(3087);
    expect(invoice.grossCents).toBe(19_336);
    expect(invoice.recipientName).toBe("Muster GmbH");
    expect(invoice.recipientEmail).toBe("buchhaltung@muster.example");
    expect(invoice.status).toBe("OPEN");
    expect(invoice.footerText).toMatch(/193,36\s€/);
    expect(invoice.lines.map((l) => l.reference)).toEqual([`Ticket T-${String(rootTicket).padStart(5, "0")}`, expect.any(String)]);

    const entries = await db.costEntry.findMany({ where: { id: { in: [a, b] } } });
    expect(entries.every((e) => e.billed && e.invoiceId === invoice.id && e.billedAt)).toBe(true);

    // PDF einmal erzeugt und abgelegt
    expect(invoice.pdfPath).toBe(`invoices/${year}/RE-${year}-0001.pdf`);
    const file = path.join(process.env.UPLOAD_DIR!, invoice.pdfPath!);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = pdfText(file);
    if (text) {
      expect(text).toContain(`Rechnung RE-${year}-0001`);
      expect(text).toContain("K-1");
      expect(text).toContain("193,36 €");
    }

    const second = await create(rootId, [await entry(rootTicket, "Fernwartung", 9500)]);
    expect(second.ok && second.number).toBe(`RE-${year}-0002`);
  });

  it("Unterkunde mit eigener Rechnung ist ein eigener Empfänger", async () => {
    const root = await recipients.resolveRecipient({ kind: "company", companyId: rootId });
    expect(root?.ticketWhere).toEqual({ companyId: { in: [rootId] } });
    expect(root?.separateSubs).toEqual(["Büro Ulm"]);

    const sub = await recipients.resolveRecipient({ kind: "company", companyId: subId });
    expect(sub?.kind).toBe("sub");
    expect(sub?.name).toBe("Muster GmbH, Büro Ulm");
    expect(sub?.email).toBe("ulm@muster.example");
    expect(sub?.customerNumber).toBe("K-1");

    // Position der Unterkunde lässt sich nicht über den Firmenkunden abrechnen
    const foreign = await entry(subTicket, "Notebook einrichten", 19_000);
    const wrong = await create(rootId, [foreign]);
    expect(wrong.ok).toBe(false);

    const right = await create(subId, [foreign]);
    if (!right.ok) throw new Error(right.error);
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: right.invoiceId } });
    expect(invoice.companyId).toBe(subId);
    expect(invoice.recipientAddress).toBe("Am Markt 3\n89073 Ulm");
  });

  it("blockiert Positionen ohne Preis und bereits abgerechnete", async () => {
    const unpriced = await entry(rootTicket, "Netzwerkkabel", 0, { needsPrice: true, unitPriceCents: 0 });
    const noPrice = await create(rootId, [unpriced]);
    expect(noPrice).toEqual({ ok: false, error: expect.stringContaining("fehlt noch der Preis: „Netzwerkkabel“") });

    const manual = await entry(rootTicket, "Schon abgerechnet", 1000, { billed: true, billedAt: new Date() });
    const billed = await create(rootId, [manual]);
    expect(billed).toEqual({ ok: false, error: expect.stringContaining("bereits abgerechnet") });

    // Nichts wurde verändert, keine Nummer verbraucht
    expect(await db.costEntry.count({ where: { id: unpriced, billed: true } })).toBe(0);
    const year = new Date().getFullYear();
    const max = await db.invoice.aggregate({ where: { year }, _max: { sequence: true } });
    const next = await create(rootId, [await entry(rootTicket, "Weiter geht's", 500)]);
    expect(next.ok && next.number).toBe(`RE-${year}-${String((max._max.sequence ?? 0) + 1).padStart(4, "0")}`);
  });

  it("vergibt auch bei gleichzeitigem Erstellen keine Nummer doppelt", async () => {
    const ids = await Promise.all([1, 2, 3].map((i) => entry(rootTicket, `Parallel ${i}`, 1000 * i)));
    const results = await Promise.all(ids.map((id) => create(rootId, [id])));
    expect(results.every((r) => r.ok)).toBe(true);
    const numbers = results.map((r) => (r.ok ? r.number : ""));
    expect(new Set(numbers).size).toBe(3);
  });

  it("verweigert Rechnungen, solange Pflichtangaben fehlen", async () => {
    await db.siteSetting.update({ where: { key: "billing" }, data: { value: JSON.stringify({ ...BILLING, iban: "" }) } });
    try {
      const result = await create(rootId, [await entry(rootTicket, "Ohne IBAN", 100)]);
      expect(result).toEqual({ ok: false, error: expect.stringContaining("IBAN") });
    } finally {
      await db.siteSetting.update({ where: { key: "billing" }, data: { value: JSON.stringify(BILLING) } });
    }
  });
});

describe("Stornieren", () => {
  it("erstellt eine Stornorechnung mit negativen Beträgen und gibt die Positionen frei", async () => {
    const a = await entry(rootTicket, "Wird storniert", 10_000);
    const created = await create(rootId, [a]);
    if (!created.ok) throw new Error(created.error);

    const result = await service.cancelInvoice({ invoiceId: created.invoiceId, createdById: adminId });
    if (!result.ok) throw new Error(result.error);
    expect(result.originalNumber).toBe(created.number);
    expect(result.released).toBe(1);

    const [original, storno, freed] = await Promise.all([
      db.invoice.findUniqueOrThrow({ where: { id: created.invoiceId } }),
      db.invoice.findUniqueOrThrow({ where: { id: result.invoiceId }, include: { lines: true } }),
      db.costEntry.findUniqueOrThrow({ where: { id: a } }),
    ]);
    expect(original.status).toBe("CANCELLED");
    expect(original.cancelledAt).not.toBeNull();
    expect(storno.kind).toBe("CANCELLATION");
    expect(storno.cancelsInvoiceId).toBe(original.id);
    expect(storno.grossCents).toBe(-original.grossCents);
    expect(storno.taxCents).toBe(-original.taxCents);
    expect(storno.lines[0].totalCents).toBe(-10_000);
    expect(freed).toMatchObject({ billed: false, billedAt: null, invoiceId: null });

    const text = pdfText(path.join(process.env.UPLOAD_DIR!, storno.pdfPath!));
    if (text) {
      expect(text).toContain(`Stornorechnung ${storno.number}`);
      expect(text).toContain(`Hiermit stornieren wir unsere Rechnung ${original.number}`);
    }

    // Freigegebene Position lässt sich neu abrechnen
    const again = await create(rootId, [a]);
    expect(again.ok).toBe(true);

    // Kein zweites Storno, keine Stornierung einer Stornorechnung
    expect(await service.cancelInvoice({ invoiceId: created.invoiceId, createdById: adminId })).toEqual({
      ok: false,
      error: expect.stringContaining("bereits storniert"),
    });
    expect(await service.cancelInvoice({ invoiceId: result.invoiceId, createdById: adminId })).toEqual({
      ok: false,
      error: "Eine Stornorechnung kann nicht storniert werden.",
    });
  });
});

describe("PDF fehlt", () => {
  it("wird aus den gespeicherten Daten neu erzeugt", async () => {
    const created = await create(rootId, [await entry(rootTicket, "PDF verloren", 2500)]);
    if (!created.ok) throw new Error(created.error);
    const invoice = await db.invoice.findUniqueOrThrow({ where: { id: created.invoiceId } });
    rmSync(path.join(process.env.UPLOAD_DIR!, invoice.pdfPath!));

    const file = await service.ensureInvoicePdf(invoice.id);
    expect(file?.regenerated).toBe(true);
    expect(file?.pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const again = await service.ensureInvoicePdf(invoice.id);
    expect(again?.regenerated).toBe(false);
  });
});

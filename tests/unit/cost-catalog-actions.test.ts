import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialFormState } from "@/lib/forms";

/**
 * Server Actions für Leistungen und Katalog mit einer kleinen In-Memory-Datenbank:
 * Prüft, dass die Regeln auf dem Server gelten – auch wenn ein Formular manipuliert wird.
 */

type Preset = {
  id: string;
  kind: string;
  name: string;
  nameKey: string;
  unit: string;
  unitPriceCents: number | null;
  defaultQuantityHundredths: number;
  active: boolean;
  usageCount: number;
  lastUsedAt: Date | null;
  createdById: string | null;
};
type Entry = Record<string, unknown> & { id: string; ticketId: number };

const store = { presets: [] as Preset[], entries: [] as Entry[], nextId: 1 };
const currentUser = { current: { id: "tech", role: "TECHNICIAN", name: "Jonas Keller" } };

function pick<T extends Record<string, unknown>>(row: T | undefined, select?: Record<string, unknown>) {
  if (!row) return null;
  if (!select) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select)) out[key] = row[key] ?? null;
  return out;
}

function presetWhere(where: Record<string, unknown>) {
  return store.presets.find(
    (p) =>
      (where.id === undefined || p.id === where.id) &&
      (where.nameKey === undefined || p.nameKey === where.nameKey) &&
      (where.active === undefined || p.active === where.active),
  );
}

const fakeDb = {
  ticket: { findUnique: async ({ where }: { where: { id: number } }) => (where.id === 7 ? { id: 7 } : null) },
  user: {
    findFirst: async ({ where }: { where: { id: string } }) => (["tech", "admin", "tech2"].includes(where.id) ? { id: where.id } : null),
  },
  costPreset: {
    findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, unknown> }) =>
      pick(presetWhere(where), select),
    findUnique: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, unknown> }) =>
      pick(presetWhere(where), select),
    create: async ({ data }: { data: Partial<Preset> }) => {
      if (store.presets.some((p) => p.nameKey === data.nameKey)) throw new Error("unique");
      const preset: Preset = {
        id: `p${store.nextId++}`,
        active: true,
        usageCount: 0,
        lastUsedAt: null,
        createdById: null,
        defaultQuantityHundredths: 100,
        unitPriceCents: null,
        kind: "FLAT",
        name: "",
        nameKey: "",
        unit: "Stk.",
        ...data,
      };
      store.presets.push(preset);
      return { id: preset.id };
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const preset = store.presets.find((p) => p.id === where.id)!;
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === "object" && "increment" in value) {
          (preset as Record<string, unknown>)[key] = (preset[key as keyof Preset] as number) + (value as { increment: number }).increment;
        } else (preset as Record<string, unknown>)[key] = value;
      }
      return preset;
    },
    updateMany: async () => ({ count: 0 }),
  },
  costEntry: {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const entry = { id: `c${store.nextId++}`, billed: false, invoiceId: null, ...data } as unknown as Entry;
      store.entries.push(entry);
      return entry;
    },
    findFirst: async ({ where }: { where: { id: string; ticketId: number } }) => {
      const entry = store.entries.find((e) => e.id === where.id && e.ticketId === where.ticketId);
      if (!entry) return null;
      const preset = store.presets.find((p) => p.id === entry.presetId) ?? null;
      return { invoice: null, billedAt: null, performedById: entry.createdById, ...entry, preset };
    },
    update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const entry = store.entries.find((e) => e.id === where.id)!;
      Object.assign(entry, data);
      return entry;
    },
  },
  $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeDb),
};

vi.mock("@/lib/db", () => ({ db: fakeDb }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/auth", () => ({
  requireStaff: async () => currentUser.current,
  requireAdmin: async () => {
    if (currentUser.current.role !== "ADMIN") throw new Error("REDIRECT /admin?hinweis=kein-zugriff");
    return currentUser.current;
  },
}));

const { addCostAction, setCostPriceAction, updateCostAction } = await import("@/lib/actions/admin-costs");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const base = { ticketId: "7", performedAt: "2026-10-12", quantity: "1" };

beforeEach(() => {
  store.presets = [
    {
      id: "preset_anfahrt",
      kind: "TRAVEL",
      name: "Anfahrt Stadtgebiet",
      nameKey: "anfahrt stadtgebiet",
      unit: "Pauschale",
      unitPriceCents: 3500,
      defaultQuantityHundredths: 100,
      active: true,
      usageCount: 3,
      lastUsedAt: null,
      createdById: null,
    },
  ];
  store.entries = [];
  currentUser.current = { id: "tech", role: "TECHNICIAN", name: "Jonas Keller" };
});

describe("Techniker erfassen Leistungen", () => {
  it("bekommen den Katalogpreis – ein mitgeschickter Preis wird ignoriert", async () => {
    const state = await addCostAction(
      initialFormState,
      form({ ...base, mode: "katalog", presetId: "preset_anfahrt", note: "Kunde vor Ort", unitPrice: "1,00" }),
    );
    expect(state.status).toBe("success");
    expect(state.message).not.toMatch(/€/);
    const entry = store.entries[0];
    expect(entry).toMatchObject({
      description: "Anfahrt Stadtgebiet – Kunde vor Ort",
      kind: "TRAVEL",
      unit: "Pauschale",
      unitPriceCents: 3500,
      totalCents: 3500,
      needsPrice: false,
      presetId: "preset_anfahrt",
      createdById: "tech",
      performedById: "tech",
    });
    expect(store.presets[0].usageCount).toBe(4);
    expect(store.presets[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it("neue Position landet ohne Preis im Katalog, die Position ist „Preis fehlt“", async () => {
    const state = await addCostAction(
      initialFormState,
      form({ ...base, mode: "neu", description: "Netzwerkkabel  Cat. 6, 5 m", kind: "MATERIAL", unit: "Stk.", quantity: "2", addToCatalog: "on", unitPrice: "99" }),
    );
    expect(state.status).toBe("success");
    expect(state.message).toContain("im Katalog");
    expect(state.message).not.toMatch(/€/);
    const preset = store.presets.find((p) => p.nameKey === "netzwerkkabel cat. 6, 5 m");
    expect(preset).toMatchObject({ name: "Netzwerkkabel Cat. 6, 5 m", unitPriceCents: null, usageCount: 1, createdById: "tech" });
    expect(store.entries[0]).toMatchObject({ needsPrice: true, unitPriceCents: 0, totalCents: 0, presetId: preset?.id });
  });

  it("verwendet einen vorhandenen Katalogeintrag statt eine Dublette anzulegen", async () => {
    await addCostAction(
      initialFormState,
      form({ ...base, mode: "neu", description: "  anfahrt   STADTGEBIET ", kind: "TRAVEL", unit: "Pauschale", addToCatalog: "on" }),
    );
    expect(store.presets).toHaveLength(1);
    expect(store.entries[0]).toMatchObject({ presetId: "preset_anfahrt", unitPriceCents: 3500, needsPrice: false });
  });

  it("dürfen „erbracht von“ nur auf aktive Mitarbeiter setzen", async () => {
    const state = await addCostAction(
      initialFormState,
      form({ ...base, mode: "katalog", presetId: "preset_anfahrt", performedById: "kunde1" }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.performedById).toBeTruthy();
    expect(store.entries).toHaveLength(0);
  });

  it("ändern keine Positionen von Kollegen", async () => {
    store.entries.push({ id: "c-fremd", ticketId: 7, createdById: "admin", kind: "LABOR", unit: "Std.", quantityHundredths: 100 });
    const state = await updateCostAction(
      initialFormState,
      form({ ...base, costId: "c-fremd", kind: "LABOR", description: "x", unit: "Std." }),
    );
    expect(state.status).toBe("error");
    expect(state.message).toContain("jemand anderes");
  });

  it("können keinen Preis nachtragen", async () => {
    store.entries.push({ id: "c1", ticketId: 7, createdById: "tech", needsPrice: true, quantityHundredths: 200, unit: "Stk." });
    await expect(setCostPriceAction(initialFormState, form({ ticketId: "7", costId: "c1", unitPrice: "7,90" }))).rejects.toThrow(
      "REDIRECT /admin?hinweis=kein-zugriff",
    );
    expect(store.entries[0].needsPrice).toBe(true);
  });
});

describe("Administratoren", () => {
  beforeEach(() => {
    currentUser.current = { id: "admin", role: "ADMIN", name: "Anna Hertlin" };
  });

  it("überschreiben den Katalogpreis für eine Position", async () => {
    const state = await addCostAction(
      initialFormState,
      form({ ...base, mode: "katalog", presetId: "preset_anfahrt", unitPrice: "40,00", quantity: "2" }),
    );
    // Intl setzt ein geschütztes Leerzeichen vor das Eurozeichen
    expect(state.message?.replace(/\s/g, " ")).toBe("Anfahrt über 80,00 € hinzugefügt.");
    expect(store.entries[0]).toMatchObject({ unitPriceCents: 4000, totalCents: 8000, needsPrice: false });
    // Katalog bleibt unverändert
    expect(store.presets[0].unitPriceCents).toBe(3500);
  });

  it("neue Position mit Preis: der Preis wird Katalogpreis", async () => {
    await addCostAction(
      initialFormState,
      form({ ...base, mode: "neu", description: "Anfahrt Neu-Ulm", kind: "TRAVEL", unit: "Pauschale", unitPrice: "45", addToCatalog: "on" }),
    );
    expect(store.presets.find((p) => p.name === "Anfahrt Neu-Ulm")?.unitPriceCents).toBe(4500);
  });

  it("tragen einen fehlenden Preis nach und speichern ihn auf Wunsch im Katalog", async () => {
    store.presets.push({
      id: "p-kabel",
      kind: "MATERIAL",
      name: "Netzwerkkabel",
      nameKey: "netzwerkkabel",
      unit: "Stk.",
      unitPriceCents: null,
      defaultQuantityHundredths: 100,
      active: true,
      usageCount: 1,
      lastUsedAt: null,
      createdById: "tech",
    });
    store.entries.push({
      id: "c1",
      ticketId: 7,
      createdById: "tech",
      kind: "MATERIAL",
      description: "Netzwerkkabel",
      needsPrice: true,
      unitPriceCents: 0,
      totalCents: 0,
      quantityHundredths: 200,
      unit: "Stk.",
      presetId: "p-kabel",
    });
    await expect(
      setCostPriceAction(initialFormState, form({ ticketId: "7", costId: "c1", unitPrice: "7,90", saveToCatalog: "on" })),
    ).rejects.toThrow("REDIRECT /admin/tickets/7?kosten=preis-katalog#kosten");
    expect(store.entries[0]).toMatchObject({ needsPrice: false, unitPriceCents: 790, totalCents: 1580 });
    expect(store.presets.find((p) => p.id === "p-kabel")?.unitPriceCents).toBe(790);
  });

  it("ändern keine Positionen, die auf einer Rechnung stehen", async () => {
    store.entries.push({ id: "c2", ticketId: 7, createdById: "admin", invoiceId: "inv1", billed: true, unit: "Std." });
    const price = await setCostPriceAction(initialFormState, form({ ticketId: "7", costId: "c2", unitPrice: "1" }));
    expect(price.status).toBe("error");
    const update = await updateCostAction(initialFormState, form({ ...base, costId: "c2", kind: "LABOR", description: "x", unit: "Std." }));
    expect(update.status).toBe("error");
    expect(update.message).toContain("Rechnung");
  });
});

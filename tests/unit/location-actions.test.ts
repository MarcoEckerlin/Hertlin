import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Server Actions der Standortverwaltung gegen eine kleine Datenbank im Speicher:
 * Hauptsitz-Regeln, Dubletten, Löschen nur ohne Zuordnungen, Reihenfolge.
 */

type Row = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string | null;
  email: string | null;
  openingHours: string | null;
  note: string | null;
  isMain: boolean;
  showOnWebsite: boolean;
  active: boolean;
  sortOrder: number;
};

const store = {
  locations: [] as Row[],
  /** Zuordnungen je Standort (Kunden, Tickets) */
  companies: new Map<string, number>(),
  tickets: new Map<string, number>(),
  nextId: 1,
};

type Where = { id?: string | { not: string }; isMain?: boolean; active?: boolean };

function matches(row: Row, where: Where = {}): boolean {
  if (typeof where.id === "string" && row.id !== where.id) return false;
  if (typeof where.id === "object" && row.id === where.id.not) return false;
  if (where.isMain !== undefined && row.isMain !== where.isMain) return false;
  if (where.active !== undefined && row.active !== where.active) return false;
  return true;
}

function groupBy(source: Map<string, number>) {
  return async ({ where }: { where: { locationId?: { in?: string[] } } }) =>
    [...source.entries()]
      .filter(([id]) => !where.locationId?.in || where.locationId.in.includes(id))
      .map(([locationId, n]) => ({ locationId, role: "ADMIN", _count: { _all: n } }));
}

const fakeDb = {
  location: {
    findMany: async () => store.locations.map((l) => ({ ...l })),
    findUnique: async ({ where }: { where: { id: string } }) => {
      const row = store.locations.find((l) => l.id === where.id);
      return row ? { ...row } : null;
    },
    count: async ({ where }: { where: Where }) => store.locations.filter((l) => matches(l, where)).length,
    aggregate: async () => ({ _max: { sortOrder: store.locations.length ? Math.max(...store.locations.map((l) => l.sortOrder)) : null } }),
    create: async ({ data }: { data: Omit<Row, "id"> }) => {
      const row = { ...data, id: `loc${store.nextId++}` } as Row;
      store.locations.push(row);
      return { id: row.id };
    },
    update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
      const row = store.locations.find((l) => l.id === where.id);
      if (!row) throw new Error("not found");
      Object.assign(row, data);
      return row;
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<Row> }) => {
      const rows = store.locations.filter((l) => matches(l, where));
      for (const row of rows) Object.assign(row, data);
      return { count: rows.length };
    },
    delete: async ({ where }: { where: { id: string } }) => {
      store.locations = store.locations.filter((l) => l.id !== where.id);
    },
  },
  company: { groupBy: groupBy(store.companies) },
  user: { groupBy: async () => [] },
  ticket: { groupBy: groupBy(store.tickets) },
  // Die Transaktion läuft direkt auf dem Speicher
  $transaction: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(fakeDb),
};

vi.mock("@/lib/db", () => ({ db: fakeDb }));
vi.mock("@/lib/auth", () => ({ requireAdmin: async () => ({ id: "admin", role: "ADMIN", name: "Anna" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

const { createLocationAction, deleteLocationAction, moveLocationAction, updateLocationAction } = await import(
  "@/lib/actions/admin-locations"
);
const { initialFormState } = await import("@/lib/forms");

function form(values: Record<string, string | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.set(key, value);
  return data;
}

const BASE = { street: "Hauptstraße 1", zip: "12345", city: "Musterstadt", showOnWebsite: "on" };

async function create(name: string, extra: Record<string, string> = {}): Promise<string> {
  try {
    const state = await createLocationAction(initialFormState, form({ ...BASE, name, ...extra }));
    throw new Error(`kein Redirect: ${JSON.stringify(state)}`);
  } catch (error) {
    const match = /^REDIRECT \/admin\/standorte\?neu=(\w+)$/.exec((error as Error).message);
    if (!match) throw error;
    return match[1];
  }
}

const row = (id: string) => store.locations.find((l) => l.id === id)!;
const mains = () => store.locations.filter((l) => l.isMain).map((l) => l.name);

function update(id: string, values: Record<string, string | undefined>) {
  const current = row(id);
  return updateLocationAction(
    initialFormState,
    form({ id, name: current.name, street: current.street, zip: current.zip, city: current.city, active: "on", ...values }),
  );
}

beforeEach(() => {
  store.locations = [];
  store.companies.clear();
  store.tickets.clear();
  store.nextId = 1;
});

describe("Standort anlegen", () => {
  it("macht den ersten Standort automatisch zum Hauptsitz", async () => {
    const id = await create("Zentrale");
    expect(row(id)).toMatchObject({ isMain: true, active: true, showOnWebsite: true, sortOrder: 10 });
  });

  it("schaltet den Hauptsitz um, wenn der neue Standort Hauptsitz sein soll", async () => {
    await create("Zentrale");
    await create("Ulm");
    expect(mains()).toEqual(["Zentrale"]);
    await create("Augsburg", { isMain: "on" });
    expect(mains()).toEqual(["Augsburg"]);
    expect(store.locations.map((l) => l.sortOrder)).toEqual([10, 20, 30]);
  });

  it("verhindert doppelte Namen (ohne Rücksicht auf Groß- und Kleinschreibung)", async () => {
    await create("Hertlin Ulm");
    const state = await createLocationAction(initialFormState, form({ ...BASE, name: "hertlin  ULM" }));
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.name).toBe("Einen Standort mit diesem Namen gibt es schon.");
    expect(store.locations).toHaveLength(1);
  });

  it("meldet Pflichtfelder am Feld", async () => {
    const state = await createLocationAction(initialFormState, form({ name: "Ulm" }));
    expect(state.status).toBe("error");
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual(["city", "street", "zip"]);
  });
});

describe("Standort bearbeiten", () => {
  it("lässt den Hauptsitz Hauptsitz, auch ohne Haken", async () => {
    const id = await create("Zentrale");
    await create("Ulm");
    const state = await update(id, { isMain: undefined });
    expect(state.status).toBe("success");
    expect(mains()).toEqual(["Zentrale"]);
  });

  it("macht einen anderen Standort zum Hauptsitz und setzt den bisherigen zurück", async () => {
    await create("Zentrale");
    const ulm = await create("Ulm");
    const state = await update(ulm, { isMain: "on" });
    expect(state).toMatchObject({ status: "success", message: "Gespeichert. Ulm ist jetzt der Hauptsitz." });
    expect(mains()).toEqual(["Ulm"]);
  });

  it("deaktiviert den Hauptsitz nicht, solange es andere aktive Standorte gibt", async () => {
    const id = await create("Zentrale");
    await create("Ulm");
    const state = await update(id, { active: undefined });
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.active).toMatch(/anderen Standort zum Hauptsitz/);
    expect(row(id).active).toBe(true);
  });

  it("erlaubt das Deaktivieren des einzigen Standorts", async () => {
    const id = await create("Zentrale");
    const state = await update(id, { active: undefined });
    expect(state.status).toBe("success");
    expect(row(id)).toMatchObject({ active: false, isMain: true });
  });

  it("macht keinen deaktivierten Standort zum Hauptsitz", async () => {
    await create("Zentrale");
    const ulm = await create("Ulm");
    const state = await update(ulm, { isMain: "on", active: undefined });
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.isMain).toBeTruthy();
    expect(mains()).toEqual(["Zentrale"]);
  });

  it("bestimmt einen neuen Hauptsitz, wenn der bisherige deaktiviert war", async () => {
    const id = await create("Zentrale");
    await update(id, { active: undefined });
    await create("Ulm");
    expect(mains()).toEqual(["Ulm"]);
  });

  it("meldet einen unbekannten Standort", async () => {
    const state = await updateLocationAction(initialFormState, form({ id: "gibt-es-nicht", ...BASE, name: "X" }));
    expect(state).toMatchObject({ status: "error" });
    expect(state.message).toMatch(/gibt es nicht mehr/);
  });
});

describe("Standort löschen", () => {
  it("verweigert das Löschen mit Zuordnungen und verweist auf Deaktivieren", async () => {
    await create("Zentrale");
    const ulm = await create("Ulm");
    store.companies.set(ulm, 2);
    store.tickets.set(ulm, 5);
    const state = await deleteLocationAction(initialFormState, form({ id: ulm }));
    expect(state.status).toBe("error");
    expect(state.message).toBe(
      "Ulm ist noch 2 Kunden und 5 Tickets zugeordnet und kann deshalb nicht gelöscht werden. Deaktivieren Sie den Standort stattdessen.",
    );
    expect(store.locations).toHaveLength(2);
  });

  it("verweigert das Löschen des Hauptsitzes, solange es andere aktive Standorte gibt", async () => {
    const id = await create("Zentrale");
    await create("Ulm");
    const state = await deleteLocationAction(initialFormState, form({ id }));
    expect(state.message).toMatch(/Hauptsitz kann nicht gelöscht werden/);
  });

  it("löscht einen Standort ohne Zuordnungen", async () => {
    await create("Zentrale");
    const ulm = await create("Ulm");
    await expect(deleteLocationAction(initialFormState, form({ id: ulm }))).rejects.toThrow("REDIRECT /admin/standorte?geloescht=1");
    expect(store.locations.map((l) => l.name)).toEqual(["Zentrale"]);
  });
});

describe("Reihenfolge", () => {
  it("verschiebt Standorte und nummeriert neu, der Hauptsitz bleibt vorn", async () => {
    await create("Zentrale");
    const a = await create("A");
    const b = await create("B");
    await moveLocationAction(form({ id: b, direction: "up" }));
    const order = [...store.locations].sort((x, y) => Number(y.isMain) - Number(x.isMain) || x.sortOrder - y.sortOrder);
    expect(order.map((l) => l.name)).toEqual(["Zentrale", "B", "A"]);
    // Über den Hauptsitz hinweg geht nichts
    await moveLocationAction(form({ id: b, direction: "up" }));
    expect(row(b).sortOrder).toBeLessThan(row(a).sortOrder);
    expect(mains()).toEqual(["Zentrale"]);
  });
});

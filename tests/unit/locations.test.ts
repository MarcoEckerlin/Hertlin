import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  assignmentSummary,
  compareLocations,
  hasAssignments,
  locationDraftFromSettings,
  locationSchema,
  moveLocation,
  resolveMainId,
  type OrderedLocation,
} from "@/components/admin/locations/rules";
import {
  locationAddress,
  locationTelHref,
  openingHourLines,
  routeUrl,
  splitOpeningHour,
  type SiteLocation,
} from "@/components/site/locations";
import { SiteFooter } from "@/components/site/site-footer";
import type { SiteContact } from "@/components/site/nav-types";
import { hasActiveFilters, parseTicketListFilters, ticketListHref } from "@/components/admin/tickets/filters";
import { ticketListWhere } from "@/components/admin/tickets/data";
import { LocationsView } from "@/cms/blocks/locations";
import { computeLayouts } from "@/cms/blocks/layout";
import type { BlockContext } from "@/cms/blocks/shared";
import { buildPlaceholderContext } from "@/cms/placeholders";
import { DEFAULT_PAGES } from "@/cms/defaults";
import { BLOCK_LABELS, blockSchema, type Block } from "@/cms/schema";
import { BLOCK_FIELDS, BLOCK_GROUPS, newBlock } from "@/components/admin/website/block-config";
import { DEFAULT_SITE_SETTINGS } from "@/lib/settings";

/* ------------------------------------------------------------------ */
/* Eingaben prüfen                                                     */
/* ------------------------------------------------------------------ */

const VALID = {
  name: "  Hertlin   Ulm ",
  street: "Neue Straße 5",
  zip: "89073",
  city: "Ulm",
  phone: "0731 123450",
  email: " Ulm@Hertlin.de ",
  openingHours: "Mo–Fr:  9:00 – 16:00 Uhr\n\n  Sa: nach Vereinbarung  \n",
  note: "Parkplätze im Hof",
  isMain: "on",
  showOnWebsite: "on",
  active: "on",
};

describe("Standort: Eingaben", () => {
  it("übernimmt gültige Angaben bereinigt", () => {
    const data = locationSchema.parse(VALID);
    expect(data).toMatchObject({
      name: "Hertlin Ulm",
      street: "Neue Straße 5",
      zip: "89073",
      city: "Ulm",
      phone: "0731 123450",
      email: "ulm@hertlin.de",
      openingHours: "Mo–Fr: 9:00 – 16:00 Uhr\nSa: nach Vereinbarung",
      note: "Parkplätze im Hof",
      isMain: true,
      showOnWebsite: true,
      active: true,
    });
  });

  it("macht leere freiwillige Felder zu undefined und fehlende Haken zu false", () => {
    const data = locationSchema.parse({
      ...VALID,
      phone: "",
      email: "",
      openingHours: " \n ",
      note: "  ",
      isMain: null,
      showOnWebsite: null,
      active: null,
    });
    expect(data.phone).toBeUndefined();
    expect(data.email).toBeUndefined();
    expect(data.openingHours).toBeUndefined();
    expect(data.note).toBeUndefined();
    expect(data.isMain).toBe(false);
    expect(data.showOnWebsite).toBe(false);
    expect(data.active).toBe(false);
  });

  it("verlangt Name, Straße, PLZ und Ort", () => {
    const result = locationSchema.safeParse({ ...VALID, name: " ", street: "", zip: "", city: "" });
    expect(result.success).toBe(false);
    const fields = new Set(result.error!.issues.map((i) => i.path[0]));
    expect([...fields].sort()).toEqual(["city", "name", "street", "zip"]);
  });

  it("weist ungültige E-Mail, Telefonnummer und PLZ ab", () => {
    for (const [field, value] of [
      ["email", "keine-adresse"],
      ["phone", "0731 abc"],
      ["zip", "!!"],
    ] as const) {
      const result = locationSchema.safeParse({ ...VALID, [field]: value });
      expect(result.success, field).toBe(false);
      expect(result.error!.issues[0].path[0]).toBe(field);
    }
  });

  it("begrenzt die Öffnungszeiten auf 10 Zeilen mit je 80 Zeichen", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `Zeile ${i + 1}`).join("\n");
    expect(locationSchema.safeParse({ ...VALID, openingHours: tooMany }).error?.issues[0].message).toBe("Höchstens 10 Zeilen.");
    const tooLong = `Mo: ${"x".repeat(90)}`;
    expect(locationSchema.safeParse({ ...VALID, openingHours: `Di: 8–12 Uhr\n${tooLong}` }).error?.issues[0].message).toMatch(
      /^Zeile 2 ist zu lang/,
    );
  });
});

/* ------------------------------------------------------------------ */
/* Hauptsitz und Reihenfolge                                           */
/* ------------------------------------------------------------------ */

const loc = (id: string, opts: Partial<OrderedLocation> = {}): OrderedLocation => ({
  id,
  name: id,
  isMain: false,
  active: true,
  sortOrder: 10,
  ...opts,
});

describe("Standort: Hauptsitz", () => {
  it("nimmt den gewünschten Standort, wenn er aktiv ist", () => {
    const all = [loc("a", { isMain: true }), loc("b")];
    expect(resolveMainId(all, "b")).toBe("b");
  });

  it("ignoriert den Wunsch bei einem deaktivierten Standort", () => {
    const all = [loc("a", { isMain: true }), loc("b", { active: false })];
    expect(resolveMainId(all, "b")).toBe("a");
  });

  it("behält den bisherigen Hauptsitz ohne Wunsch", () => {
    const all = [loc("a", { sortOrder: 5 }), loc("b", { isMain: true, sortOrder: 30 })];
    expect(resolveMainId(all)).toBe("b");
  });

  it("bestimmt den ersten aktiven Standort, wenn es keinen aktiven Hauptsitz gibt", () => {
    const all = [loc("z", { isMain: true, active: false }), loc("b", { sortOrder: 20 }), loc("a", { sortOrder: 20 }), loc("c", { sortOrder: 30 })];
    expect(resolveMainId(all)).toBe("a");
  });

  it("lässt ohne aktive Standorte den bisherigen Hauptsitz stehen", () => {
    expect(resolveMainId([loc("a", { isMain: true, active: false }), loc("b", { active: false })])).toBe("a");
    expect(resolveMainId([loc("a", { active: false })])).toBeNull();
    expect(resolveMainId([])).toBeNull();
  });

  it("sortiert wie die Website: Hauptsitz, dann Position, dann Name", () => {
    const sorted = [loc("Ulm", { sortOrder: 20 }), loc("Augsburg", { sortOrder: 20 }), loc("Zentrale", { isMain: true, sortOrder: 99 })]
      .sort(compareLocations)
      .map((l) => l.id);
    expect(sorted).toEqual(["Zentrale", "Augsburg", "Ulm"]);
  });
});

describe("Standort: Reihenfolge", () => {
  const all = [loc("main", { isMain: true, sortOrder: 50 }), loc("a", { sortOrder: 10 }), loc("b", { sortOrder: 20 }), loc("c", { sortOrder: 30 })];

  it("tauscht mit dem Nachbarn", () => {
    expect(moveLocation(all, "b", "up")).toEqual(["main", "b", "a", "c"]);
    expect(moveLocation(all, "b", "down")).toEqual(["main", "a", "c", "b"]);
  });

  it("verschiebt nichts über den Hauptsitz hinweg, nicht den Hauptsitz und nicht über das Ende", () => {
    expect(moveLocation(all, "a", "up")).toBeNull();
    expect(moveLocation(all, "main", "down")).toBeNull();
    expect(moveLocation(all, "c", "down")).toBeNull();
    expect(moveLocation(all, "gibt-es-nicht", "up")).toBeNull();
  });
});

describe("Standort: Zuordnungen", () => {
  it("fasst Zuordnungen in einem Satz zusammen", () => {
    expect(assignmentSummary({ companies: 2, staff: 1, customers: 0, tickets: 14 })).toBe("2 Kunden, 1 Mitarbeiter und 14 Tickets");
    expect(assignmentSummary({ companies: 1, staff: 0, customers: 0, tickets: 0 })).toBe("1 Kunde");
    expect(assignmentSummary({ companies: 0, staff: 0, customers: 1, tickets: 1 })).toBe("1 Kundenbenutzer und 1 Ticket");
    expect(hasAssignments({ companies: 0, staff: 0, customers: 0, tickets: 0 })).toBe(false);
    expect(hasAssignments({ companies: 0, staff: 0, customers: 0, tickets: 1 })).toBe(true);
  });
});

describe("Standort: Hauptsitz aus den Firmendaten", () => {
  it("übernimmt Anschrift, Kontakt und Servicezeiten", () => {
    const draft = locationDraftFromSettings({
      name: "Hertlin",
      street: "Hauptstraße 1",
      zip: "70173",
      city: "Stuttgart",
      phone: "0711 123456",
      email: "info@hertlin.de",
      openingHours: [
        { days: "Montag bis Donnerstag", hours: "8:00 – 17:00 Uhr" },
        { days: "Freitag", hours: "8:00 – 14:00 Uhr" },
      ],
    });
    expect(draft).toEqual({
      name: "Hertlin Stuttgart",
      street: "Hauptstraße 1",
      zip: "70173",
      city: "Stuttgart",
      phone: "0711 123456",
      email: "info@hertlin.de",
      openingHours: "Montag bis Donnerstag: 8:00 – 17:00 Uhr\nFreitag: 8:00 – 14:00 Uhr",
      note: "",
    });
    // Die übernommenen Öffnungszeiten bestehen die Prüfung
    expect(locationSchema.safeParse({ ...VALID, ...draft }).success).toBe(true);
  });

  it("lässt TODO-Platzhalter der Vorgaben weg", () => {
    const draft = locationDraftFromSettings(DEFAULT_SITE_SETTINGS);
    expect(draft.street).toBe("");
    expect(draft.zip).toBe("");
    expect(draft.city).toBe("");
    expect(draft.phone).toBe("");
    expect(draft.name).toBe("Hertlin");
    expect(draft.email).toBe("info@hertlin.de");
  });
});

/* ------------------------------------------------------------------ */
/* Darstellung auf der Website                                         */
/* ------------------------------------------------------------------ */

const ULM: SiteLocation = {
  id: "ulm",
  name: "Hertlin Ulm",
  street: "Neue Straße 5",
  zip: "89073",
  city: "Ulm",
  phone: "0731 / 12 34-50",
  email: "ulm@hertlin.de",
  openingHours: "Mo–Fr: 9:00 – 16:00 Uhr\nTermine nach Vereinbarung",
  note: "Parkplätze im Hof",
  isMain: false,
};
const ZENTRALE: SiteLocation = {
  ...ULM,
  id: "zentrale",
  name: "Hertlin Zentrale",
  street: "Hauptstraße 21",
  zip: "12345",
  city: "Musterstadt",
  phone: "+49 1234 98760",
  email: null,
  openingHours: null,
  note: null,
  isMain: true,
};

describe("Standort: Hilfen für die Website", () => {
  it("teilt Öffnungszeiten in Zeilen und Tage/Zeiten", () => {
    expect(openingHourLines(" a \r\n\n  b   c ")).toEqual(["a", "b c"]);
    expect(openingHourLines(null)).toEqual([]);
    expect(splitOpeningHour("Mo–Fr: 8:00 – 17:00 Uhr")).toEqual({ days: "Mo–Fr", hours: "8:00 – 17:00 Uhr" });
    expect(splitOpeningHour("8:00 – 17:00 Uhr")).toEqual({ days: "", hours: "8:00 – 17:00 Uhr" });
  });

  it("baut Telefon-Links nur aus gültigen Nummern", () => {
    expect(locationTelHref("0731 / 12 34-50")).toBe("tel:0731123450");
    expect(locationTelHref("+49 (731) 12345")).toBe("tel:+4973112345");
    expect(locationTelHref("auf Anfrage")).toBeNull();
    expect(locationTelHref(null)).toBeNull();
  });

  it("verlinkt den Routenplaner von OpenStreetMap mit der Anschrift", () => {
    expect(locationAddress(ULM)).toBe("Neue Straße 5, 89073 Ulm");
    expect(routeUrl(ULM)).toBe("https://www.openstreetmap.org/directions?to=Neue%20Stra%C3%9Fe%205%2C%2089073%20Ulm");
  });
});

const SETTINGS = { ...DEFAULT_SITE_SETTINGS, name: "Hertlin", legalName: "Hertlin IT-Service GmbH", phone: "0711 123456", phoneHref: "+49711123456" };
const blockCtx: BlockContext = {
  settings: SETTINGS,
  text: buildPlaceholderContext(SETTINGS, { portalExample: "ihrefirma.hertlin.de" }),
  searchParams: {},
  preview: false,
  portalExample: "ihrefirma.hertlin.de",
};

function renderLocations(locations: SiteLocation[], opts: { preview?: boolean; title?: string } = {}): string {
  const block = blockSchema.parse({ id: "s", type: "locations", title: opts.title ?? "Unsere Standorte" }) as Extract<
    Block,
    { type: "locations" }
  >;
  const [layout] = computeLayouts([block]);
  return renderToStaticMarkup(
    createElement(LocationsView, { block, ctx: { ...blockCtx, preview: opts.preview ?? false }, layout, locations }),
  );
}

describe("Modul „Standorte“", () => {
  it("gibt es im Schema, im Editor und auf der Kontaktseite", () => {
    expect(BLOCK_LABELS.locations.label).toBe("Standorte");
    expect(BLOCK_FIELDS.locations.length).toBeGreaterThan(0);
    expect(BLOCK_GROUPS.flatMap((g) => g.types)).toContain("locations");
    expect(blockSchema.safeParse(newBlock("locations")).success).toBe(true);
    const kontakt = DEFAULT_PAGES.kontakt.blocks.find((b) => b.type === "locations");
    expect(kontakt).toMatchObject({ anchor: "standorte", tone: "white" });
  });

  it("zeigt Name, Anschrift, Telefon als Link, E-Mail, Öffnungszeiten, Hinweis und Route", () => {
    const html = renderLocations([ZENTRALE, ULM]);
    expect(html).toMatch(/<h2[^>]*>Unsere Standorte<\/h2>/);
    expect(html).toMatch(/<h3[^>]*>Hertlin Ulm<\/h3>/);
    expect(html).toContain("Hauptsitz");
    expect(html).toContain("89073 Ulm");
    expect(html).toContain('href="tel:0731123450"');
    expect(html).toContain('href="tel:+49123498760"');
    expect(html).toContain('href="mailto:ulm@hertlin.de"');
    expect(html).toContain("Termine nach Vereinbarung");
    expect(html).toContain("Parkplätze im Hof");
    expect(html).toContain('href="https://www.openstreetmap.org/directions?to=Neue%20Stra%C3%9Fe%205%2C%2089073%20Ulm"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("<iframe");
  });

  it("zeigt bei nur einem Standort keinen Hinweis „Hauptsitz“ und ohne Überschrift die Namen als h2", () => {
    const html = renderLocations([ZENTRALE], { title: "" });
    expect(html).not.toContain("Hauptsitz");
    expect(html).toMatch(/<h2[^>]*>Hertlin Zentrale<\/h2>/);
  });

  it("bleibt ohne Standorte auf der Website leer und zeigt in der Vorschau einen Hinweis", () => {
    expect(renderLocations([])).toBe("");
    expect(renderLocations([], { preview: true })).toContain("Hier erscheinen die Standorte");
  });
});

describe("Fußzeile", () => {
  const contact: SiteContact = {
    name: "Hertlin",
    legalName: "Hertlin IT-Service GmbH",
    phone: "0711 123456",
    phoneHref: "+49711123456",
    email: "info@hertlin.de",
    street: "Firmenweg 1",
    zip: "70173",
    city: "Stuttgart",
    openingHours: [{ days: "Montag bis Freitag", hours: "8:00 – 17:00 Uhr" }],
  };
  const footer = (locations?: SiteLocation[]) =>
    renderToStaticMarkup(createElement(SiteFooter, { main: [], footer: [], contact, locations }));

  it("zeigt ohne oder mit einem Standort die Firmendaten wie bisher", () => {
    for (const html of [footer(), footer([]), footer([ZENTRALE])]) {
      expect(html).toContain("Firmenweg 1");
      expect(html).toContain("70173 Stuttgart");
      expect(html).toContain('href="tel:+49711123456"');
      expect(html).not.toContain("footer-standorte");
    }
  });

  it("zeigt mehrere Standorte kompakt und behält Telefon und E-Mail der Firma", () => {
    const html = footer([ZENTRALE, ULM]);
    expect(html).toMatch(/<h2 id="footer-standorte"[^>]*>Standorte<\/h2>/);
    expect(html).toContain("Hertlin Zentrale");
    expect(html).toContain("Hauptstraße 21");
    expect(html).toContain("89073 Ulm");
    expect(html).toContain('href="tel:0731123450"');
    expect(html).toContain('href="tel:+49711123456"');
    expect(html).toContain('href="mailto:info@hertlin.de"');
    // Die Anschrift aus den Firmendaten steht nicht doppelt neben den Standorten
    expect(html).not.toContain("Firmenweg 1");
  });
});

/* ------------------------------------------------------------------ */
/* Ticketliste                                                         */
/* ------------------------------------------------------------------ */

describe("Ticketliste: Filter Standort", () => {
  it("liest standort aus der Adresse", () => {
    expect(parseTicketListFilters({ standort: "ohne" }).standort).toBe("ohne");
    expect(parseTicketListFilters({ standort: "clx123abc" }).standort).toBe("clx123abc");
    expect(parseTicketListFilters({ standort: "alle" }).standort).toBeUndefined();
    expect(parseTicketListFilters({ standort: "<script>" }).standort).toBeUndefined();
    expect(parseTicketListFilters({}).standort).toBeUndefined();
  });

  it("schreibt standort in Links und zählt ihn als aktiven Filter", () => {
    const filters = parseTicketListFilters({ standort: "clx123abc", ansicht: "alle" });
    expect(ticketListHref(filters)).toBe("/admin/tickets?ansicht=alle&standort=clx123abc");
    expect(hasActiveFilters(filters)).toBe(true);
    expect(hasActiveFilters(parseTicketListFilters({}))).toBe(false);
  });

  it("filtert nach Standort oder Tickets ohne Standort", () => {
    const where = (standort: string) => JSON.stringify(ticketListWhere(parseTicketListFilters({ standort }), "u1"));
    expect(where("clx123abc")).toContain('{"locationId":"clx123abc"}');
    expect(where("ohne")).toContain('{"locationId":null}');
    expect(JSON.stringify(ticketListWhere(parseTicketListFilters({}), "u1"))).not.toContain("locationId");
  });
});

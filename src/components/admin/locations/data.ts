import "server-only";
import { db } from "@/lib/db";
import { OPEN_STATUSES, STAFF_ROLES } from "@/lib/constants";
import { compareLocations, type LocationAssignments } from "@/components/admin/locations/rules";

/**
 * Abfragen für die Standortverwaltung (/admin/standorte). Aufrufer prüfen vorher requireAdmin().
 */

export const locationRowSelect = {
  id: true,
  name: true,
  street: true,
  zip: true,
  city: true,
  phone: true,
  email: true,
  openingHours: true,
  note: true,
  isMain: true,
  showOnWebsite: true,
  active: true,
  sortOrder: true,
} as const;

export type LocationCounts = LocationAssignments & { openTickets: number };

const EMPTY_COUNTS: LocationCounts = { companies: 0, staff: 0, customers: 0, tickets: 0, openTickets: 0 };

/** Zuordnungen je Standort: Kunden, Mitarbeiter, Kundenbenutzer, Tickets (gesamt und offen). */
export async function loadLocationCounts(ids?: string[]): Promise<Map<string, LocationCounts>> {
  const where = ids ? { locationId: { in: ids } } : { locationId: { not: null } };
  const [companies, users, tickets, openTickets] = await Promise.all([
    db.company.groupBy({ by: ["locationId"], where, _count: { _all: true } }),
    db.user.groupBy({ by: ["locationId", "role"], where, _count: { _all: true } }),
    db.ticket.groupBy({ by: ["locationId"], where, _count: { _all: true } }),
    db.ticket.groupBy({ by: ["locationId"], where: { ...where, status: { in: [...OPEN_STATUSES] } }, _count: { _all: true } }),
  ]);

  const map = new Map<string, LocationCounts>();
  const entry = (id: string | null) => {
    if (!id) return null;
    const current = map.get(id) ?? { ...EMPTY_COUNTS };
    map.set(id, current);
    return current;
  };
  for (const g of companies) {
    const e = entry(g.locationId);
    if (e) e.companies += g._count._all;
  }
  for (const g of users) {
    const e = entry(g.locationId);
    if (!e) continue;
    if ((STAFF_ROLES as readonly string[]).includes(g.role)) e.staff += g._count._all;
    else e.customers += g._count._all;
  }
  for (const g of tickets) {
    const e = entry(g.locationId);
    if (e) e.tickets += g._count._all;
  }
  for (const g of openTickets) {
    const e = entry(g.locationId);
    if (e) e.openTickets += g._count._all;
  }
  return map;
}

export function countsOf(map: Map<string, LocationCounts>, id: string): LocationCounts {
  return map.get(id) ?? EMPTY_COUNTS;
}

/** Alle Standorte in der Reihenfolge der Website (Hauptsitz zuerst). */
export async function loadLocations() {
  const locations = await db.location.findMany({ select: locationRowSelect });
  return locations.sort(compareLocations);
}

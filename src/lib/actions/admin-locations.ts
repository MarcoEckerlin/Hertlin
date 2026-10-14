"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { countsOf, loadLocationCounts } from "@/components/admin/locations/data";
import {
  assignmentSummary,
  hasAssignments,
  locationSchema,
  moveLocation,
  resolveMainId,
} from "@/components/admin/locations/rules";

/**
 * Hertlin-Standorte verwalten (nur Administratoren).
 * Unter den aktiven Standorten gibt es immer genau einen Hauptsitz (siehe resolveMainId).
 * Gelöscht werden kann nur ein Standort ohne Zuordnungen – sonst wird er deaktiviert.
 */

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function idFrom(formData: FormData): string | null {
  const v = str(formData, "id").trim();
  return /^[a-zA-Z0-9_-]{1,64}$/.test(v) ? v : null;
}

function readLocation(formData: FormData) {
  return {
    name: str(formData, "name"),
    street: str(formData, "street"),
    zip: str(formData, "zip"),
    city: str(formData, "city"),
    phone: str(formData, "phone"),
    email: str(formData, "email"),
    openingHours: str(formData, "openingHours"),
    note: str(formData, "note"),
    isMain: formData.get("isMain"),
    showOnWebsite: formData.get("showOnWebsite"),
    active: formData.get("active"),
  };
}

/** Standorte erscheinen in der Verwaltung, auf der Website und in der Fußzeile. */
function revalidateLocations() {
  revalidatePath("/", "layout");
}

const NOT_FOUND = "Diesen Standort gibt es nicht mehr. Bitte laden Sie die Seite neu.";

async function nameTaken(name: string, exceptId?: string): Promise<boolean> {
  const key = name.toLocaleLowerCase("de");
  const all = await db.location.findMany({ select: { id: true, name: true } });
  return all.some((l) => l.id !== exceptId && l.name.toLocaleLowerCase("de") === key);
}

/** Hauptsitz nach einer Änderung festziehen: genau einer unter den aktiven Standorten. */
async function syncMainLocation(tx: Prisma.TransactionClient, preferId?: string | null): Promise<void> {
  const all = await tx.location.findMany({ select: { id: true, name: true, isMain: true, active: true, sortOrder: true } });
  const mainId = resolveMainId(all, preferId);
  await tx.location.updateMany({
    where: { isMain: true, ...(mainId ? { id: { not: mainId } } : {}) },
    data: { isMain: false },
  });
  if (mainId && !all.find((l) => l.id === mainId)?.isMain) {
    await tx.location.update({ where: { id: mainId }, data: { isMain: true } });
  }
}

/* ------------------------------------------------------------------ */

export async function createLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  // Neue Standorte sind immer aktiv
  const parsed = locationSchema.safeParse({ ...readLocation(formData), active: "on" });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const data = parsed.data;

  if (await nameTaken(data.name)) {
    return errorState("Bitte prüfen Sie den Namen.", formData, { name: "Einen Standort mit diesem Namen gibt es schon." });
  }

  const created = await db.$transaction(async (tx) => {
    const last = await tx.location.aggregate({ _max: { sortOrder: true } });
    const location = await tx.location.create({
      data: {
        name: data.name,
        street: data.street,
        zip: data.zip,
        city: data.city,
        phone: data.phone ?? null,
        email: data.email ?? null,
        openingHours: data.openingHours ?? null,
        note: data.note ?? null,
        showOnWebsite: data.showOnWebsite,
        active: true,
        isMain: false,
        sortOrder: (last._max.sortOrder ?? 0) + 10,
      },
      select: { id: true },
    });
    // Ohne Haken wird der Standort nur Hauptsitz, wenn es noch keinen gibt
    await syncMainLocation(tx, data.isMain ? location.id : null);
    return location;
  });

  revalidateLocations();
  redirect(`/admin/standorte?neu=${created.id}`);
}

export async function updateLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = idFrom(formData);
  const existing = id ? await db.location.findUnique({ where: { id }, select: { id: true, isMain: true, active: true } }) : null;
  if (!existing) return errorState(NOT_FOUND);

  const parsed = locationSchema.safeParse(readLocation(formData));
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const data = parsed.data;

  // Der Hauptsitz bleibt Hauptsitz, bis ein anderer Standort dazu gemacht wird
  const wantsMain = existing.isMain || data.isMain;

  if (wantsMain && !data.active) {
    const otherActive = await db.location.count({ where: { id: { not: existing.id }, active: true } });
    if (existing.isMain && otherActive > 0) {
      return errorState("Der Hauptsitz kann nicht deaktiviert werden.", formData, {
        active: "Machen Sie zuerst einen anderen Standort zum Hauptsitz.",
      });
    }
    if (!existing.isMain) {
      return errorState("Ein deaktivierter Standort kann nicht Hauptsitz sein.", formData, {
        isMain: "Bitte den Standort aktiv lassen oder den Haken bei „Hauptsitz“ entfernen.",
      });
    }
  }

  if (await nameTaken(data.name, existing.id)) {
    return errorState("Bitte prüfen Sie den Namen.", formData, { name: "Einen Standort mit diesem Namen gibt es schon." });
  }

  await db.$transaction(async (tx) => {
    await tx.location.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        street: data.street,
        zip: data.zip,
        city: data.city,
        phone: data.phone ?? null,
        email: data.email ?? null,
        openingHours: data.openingHours ?? null,
        note: data.note ?? null,
        showOnWebsite: data.showOnWebsite,
        active: data.active,
      },
    });
    await syncMainLocation(tx, data.isMain && !existing.isMain ? existing.id : null);
  });

  revalidateLocations();
  if (data.isMain && !existing.isMain) return successState(`Gespeichert. ${data.name} ist jetzt der Hauptsitz.`);
  if (existing.active && !data.active) {
    return successState("Gespeichert. Der Standort ist deaktiviert und steht nicht mehr zur Auswahl.");
  }
  return successState("Gespeichert.");
}

/** Reihenfolge ändern (Knöpfe „nach oben“/„nach unten“ in der Liste). */
export async function moveLocationAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = idFrom(formData);
  const direction = str(formData, "direction");
  if (!id || (direction !== "up" && direction !== "down")) return;

  await db.$transaction(async (tx) => {
    const all = await tx.location.findMany({ select: { id: true, name: true, isMain: true, active: true, sortOrder: true } });
    const order = moveLocation(all, id, direction);
    if (!order) return;
    for (const [index, locationId] of order.entries()) {
      await tx.location.update({ where: { id: locationId }, data: { sortOrder: (index + 1) * 10 } });
    }
  });

  revalidateLocations();
}

export async function deleteLocationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const id = idFrom(formData);
  const existing = id ? await db.location.findUnique({ where: { id }, select: { id: true, name: true, isMain: true } }) : null;
  if (!existing) return errorState(NOT_FOUND);

  const assignments = countsOf(await loadLocationCounts([existing.id]), existing.id);
  if (hasAssignments(assignments)) {
    return errorState(
      `${existing.name} ist noch ${assignmentSummary(assignments)} zugeordnet und kann deshalb nicht gelöscht werden. Deaktivieren Sie den Standort stattdessen.`,
    );
  }
  if (existing.isMain) {
    const otherActive = await db.location.count({ where: { id: { not: existing.id }, active: true } });
    if (otherActive > 0) return errorState("Der Hauptsitz kann nicht gelöscht werden. Machen Sie zuerst einen anderen Standort zum Hauptsitz.");
  }

  await db.$transaction(async (tx) => {
    await tx.location.delete({ where: { id: existing.id } });
    await syncMainLocation(tx);
  });

  revalidateLocations();
  redirect("/admin/standorte?geloescht=1");
}

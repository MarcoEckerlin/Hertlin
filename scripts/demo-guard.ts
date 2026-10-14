/**
 * Sperrt im HTTPS-Betrieb die Demo-Zugänge aus prisma/seed.ts, solange sie noch das Demo-Passwort haben.
 * Das Passwort steht öffentlich in README und DOCKER.md – wer nach einem Test im Heimnetz mit derselben
 * Datenbank live geht, hätte sonst einen Administrator-Zugang mit bekanntem Passwort im Internet.
 *
 * Läuft beim Container-Start (docker/entrypoint.sh), wenn APP_PROTOCOL nicht "http" ist.
 * Bricht nie ab: Fehler werden gemeldet, der Start geht weiter.
 */
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "../src/lib/crypto";

// Muss zu den Konten in prisma/seed.ts passen
const DEMO_EMAILS = [
  "admin@hertlin.de",
  "technik@hertlin.de",
  "kanzlei@muster.example",
  "berger@muster.example",
  "yilmaz@muster.example",
  "ulm@muster.example",
  "home@muster.example",
  "info@baeckerei.example",
  "chef@baeckerei.example",
  "vogel@architekten.example",
  "krause@privat.example",
];
const DEMO_PASSWORD = process.env.SEED_PASSWORD || "demo-passwort-2026";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    where: { email: { in: DEMO_EMAILS }, active: true, passwordHash: { not: null } },
    select: { id: true, email: true, role: true, passwordHash: true },
  });

  const locked: string[] = [];
  for (const user of users) {
    if (!(await verifyPassword(DEMO_PASSWORD, user.passwordHash))) continue;
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { active: false } }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    locked.push(`${user.email} (${user.role})`);
  }

  if (locked.length === 0) return;
  console.log("  ACHTUNG: Demo-Zugänge mit öffentlich bekanntem Passwort gefunden und gesperrt:");
  for (const entry of locked) console.log(`    - ${entry}`);
  console.log("  Die Datenbank enthält Beispieldaten aus dem Test. Für einen sauberen Start das Volume löschen (DOCKER.md,");
  console.log("  „Von Test auf Produktion wechseln“). Eigenen Administrator über ADMIN_EMAIL in docker.env anlegen.");
}

main()
  .catch((error) => {
    console.error("  Prüfung der Demo-Zugänge fehlgeschlagen:", error);
  })
  .finally(() => db.$disconnect());

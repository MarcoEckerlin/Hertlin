/**
 * Legt die Testdatenbank für die Ende-zu-Ende-Tests neu an: prisma/e2e.db löschen, Migrationen einspielen,
 * Beispieldaten aus prisma/seed.ts laden. Wird von playwright.config.ts vor dem Start des Testservers aufgerufen.
 *
 * Bewusst ohne „prisma migrate reset“ und fest auf prisma/e2e.db beschränkt: Mit jeder anderen
 * DATABASE_URL bricht das Skript ab, damit nie die Entwicklungs- oder Produktionsdatenbank geleert wird.
 */
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const EXPECTED_URL = "file:./e2e.db";

if (process.env.DATABASE_URL !== EXPECTED_URL) {
  console.error(`[e2e] Abbruch: DATABASE_URL muss "${EXPECTED_URL}" sein (ist "${process.env.DATABASE_URL ?? ""}").`);
  process.exit(1);
}

const file = path.join(process.cwd(), "prisma", "e2e.db");
for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });

const bin = path.join(process.cwd(), "node_modules", ".bin");
// Der Seed-Befehl aus package.json („tsx prisma/seed.ts“) braucht node_modules/.bin im PATH
const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}` };
const run = (...args: string[]) =>
  execFileSync(path.join(bin, "prisma"), args, { stdio: ["ignore", "ignore", "inherit"], env });

run("migrate", "deploy");
run("db", "seed");
console.log("[e2e] Testdatenbank prisma/e2e.db angelegt.");

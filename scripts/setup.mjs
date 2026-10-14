/**
 * Einmalige Einrichtung für die lokale Entwicklung (Windows, macOS, Linux):
 *   npm run setup
 * - legt .env aus .env.example an, falls noch nicht vorhanden
 * - spielt die Datenbank-Migrationen ein
 * - lädt die Beispieldaten (nur wenn die Datenbank noch leer ist)
 */
import { copyFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(command) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\nFehlgeschlagen: ${command}`);
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log(".env aus .env.example angelegt.");
} else {
  console.log(".env ist bereits vorhanden und bleibt unverändert.");
}

run("npx prisma migrate deploy");
run("npx prisma db seed");

console.log(`
Fertig. Starten mit:  npm run dev

  Website und Verwaltung:  http://localhost:3000   (Verwaltung unter /admin)
  Kundenportal (Beispiel): http://muster.localhost:3000

  Anmeldung (Passwort demo-passwort-2026):
    admin@hertlin.de          Administrator
    technik@hertlin.de        Techniker
    berger@muster.example     Kundin, Hauptansprechpartnerin
`);

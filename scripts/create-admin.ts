/**
 * Legt einen Administrator an (z. B. beim ersten Start in Produktion) und gibt einen
 * Einladungslink aus, über den das Passwort festgelegt wird.
 *
 *   npm run create-admin -- --email anna@hertlin.de --name "Anna Hertlin"
 *
 * Mit --if-missing (für den Docker-Start): Gibt es das Konto schon, passiert nichts. Hat es noch kein
 * Passwort, wird ein neuer Einladungslink ausgegeben.
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

const db = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  if (!email || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Aufruf: npm run create-admin -- --email name@firma.de --name "Vorname Nachname"');
    process.exit(1);
  }

  const ifMissing = process.argv.includes("--if-missing");
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && !(ifMissing && existing.role === "ADMIN" && !existing.passwordHash)) {
    // Beim Container-Start nie abbrechen, sonst startet der Server nicht
    if (ifMissing && existing.role === "ADMIN") {
      console.log(`Administrator ${email} ist bereits eingerichtet.`);
      return;
    }
    console.error(`Es gibt bereits einen Benutzer mit ${email} (Rolle ${existing.role}) – kein Administrator angelegt.`);
    if (ifMissing) return;
    process.exit(1);
  }

  const user = existing ?? (await db.user.create({ data: { email, name, role: "ADMIN" } }));
  // Ältere, noch offene Einladungen verfallen lassen
  await db.authToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomBytes(32).toString("base64url");
  await db.authToken.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      userId: user.id,
      purpose: "INVITE",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const protocol = process.env.APP_PROTOCOL === "http" ? "http" : "https";
  const root = process.env.ROOT_DOMAIN || "localhost:3000";
  console.log(existing ? `Administrator ${email} hat noch kein Passwort – neuer Einladungslink:` : `Administrator ${name} <${email}> angelegt.`);
  console.log(`Passwort festlegen (7 Tage gültig): ${protocol}://${root}/admin/passwort/${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

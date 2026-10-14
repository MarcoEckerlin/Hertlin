/**
 * Legt einen Administrator an (z. B. beim ersten Start in Produktion) und gibt einen
 * Einladungslink aus, über den das Passwort festgelegt wird.
 *
 *   npm run create-admin -- --email anna@hertlin.de --name "Anna Hertlin"
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

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Es gibt bereits einen Benutzer mit ${email} (Rolle ${existing.role}).`);
    process.exit(1);
  }

  const user = await db.user.create({ data: { email, name, role: "ADMIN" } });
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
  console.log(`Administrator ${name} <${email}> angelegt.`);
  console.log(`Passwort festlegen (7 Tage gültig): ${protocol}://${root}/admin/passwort/${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

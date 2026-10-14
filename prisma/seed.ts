/**
 * Beispieldaten für die lokale Entwicklung und Tests.
 * Aufruf: npm run db:seed  (setzt vorhandene Daten NICHT zurück – vorher npm run db:reset)
 *
 * Alle Demo-Konten nutzen das Passwort aus SEED_PASSWORD (Standard: "demo-passwort-2026").
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";

const db = new PrismaClient();
const PASSWORD = process.env.SEED_PASSWORD || "demo-passwort-2026";

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(["scrypt", 16384, 8, 1, salt.toString("base64"), key.toString("base64")].join("$")),
    ),
  );
}

const daysAgo = (d: number, h = 9) => {
  const date = new Date();
  date.setDate(date.getDate() - d);
  date.setHours(h, 15, 0, 0);
  return date;
};

async function main() {
  if ((await db.user.count()) > 0) {
    console.log("Datenbank enthält bereits Daten – Beispieldaten werden nicht erneut geladen.");
    return;
  }
  const passwordHash = await hashPassword(PASSWORD);

  // Hertlin-Team
  const admin = await db.user.create({
    data: { email: "admin@hertlin.de", name: "Anna Hertlin", role: "ADMIN", passwordHash, position: "Geschäftsführung" },
  });
  const tech = await db.user.create({
    data: { email: "technik@hertlin.de", name: "Jonas Keller", role: "TECHNICIAN", passwordHash, position: "Systemtechniker" },
  });

  // Firmenkunde mit Unterkunden
  const muster = await db.company.create({
    data: {
      name: "Muster Steuerberatung GmbH",
      slug: "muster",
      customerNumber: "K-1001",
      street: "Beispielweg 12",
      zip: "12345",
      city: "Musterstadt",
      phone: "01234 567890",
      email: "kanzlei@muster.example",
      internalNote: "Betreuungsvertrag seit 2023. Server im Keller, Schlüssel bei Frau Berger.",
    },
  });
  const musterUlm = await db.company.create({
    data: { name: "Büro Ulm", parentId: muster.id, city: "Ulm", street: "Am Markt 3", zip: "89073" },
  });
  const musterHome = await db.company.create({
    data: { name: "Homeoffice-Arbeitsplätze", parentId: muster.id },
  });

  const berger = await db.user.create({
    data: {
      email: "berger@muster.example",
      name: "Claudia Berger",
      role: "CUSTOMER_ADMIN",
      companyId: muster.id,
      passwordHash,
      position: "Kanzleileitung",
      phone: "01234 567891",
    },
  });
  const yilmaz = await db.user.create({
    data: { email: "yilmaz@muster.example", name: "Deniz Yilmaz", role: "CUSTOMER_USER", companyId: muster.id, passwordHash },
  });
  const ulmLead = await db.user.create({
    data: { email: "ulm@muster.example", name: "Peter Wagner", role: "CUSTOMER_ADMIN", companyId: musterUlm.id, passwordHash },
  });
  await db.user.create({
    data: { email: "home@muster.example", name: "Sabine Roth", role: "CUSTOMER_USER", companyId: musterHome.id, passwordHash },
  });

  // Zweiter Firmenkunde
  const baeckerei = await db.company.create({
    data: {
      name: "Bäckerei Beispiel",
      slug: "baeckerei",
      customerNumber: "K-1002",
      city: "Musterstadt",
      email: "info@baeckerei.example",
    },
  });
  const baecker = await db.user.create({
    data: { email: "chef@baeckerei.example", name: "Tobias Brandt", role: "CUSTOMER_ADMIN", companyId: baeckerei.id, passwordHash },
  });

  // Tickets
  const t1 = await db.ticket.create({
    data: {
      subject: "Drucker im Empfang druckt nur noch leere Seiten",
      type: "STOERUNG",
      category: "DRUCKER",
      priority: "NORMAL",
      status: "IN_PROGRESS",
      companyId: muster.id,
      createdById: yilmaz.id,
      assigneeId: tech.id,
      createdAt: daysAgo(3, 8),
      messages: {
        create: [
          {
            authorId: yilmaz.id,
            body: "Seit heute Morgen kommen beim Kyocera am Empfang nur weiße Seiten raus. Toner ist laut Anzeige noch halb voll. Neustart hat nichts gebracht.",
            createdAt: daysAgo(3, 8),
          },
          {
            authorId: tech.id,
            fromStaff: true,
            body: "Danke für die Meldung. Das klingt nach der Trommeleinheit. Ich bringe morgen früh eine Ersatztrommel mit und tausche sie vor Ort.",
            createdAt: daysAgo(3, 10),
          },
          {
            authorId: tech.id,
            fromStaff: true,
            internal: true,
            body: "Trommel DK-1150 bestellt, Lieferung morgen. Gerät ist 5 Jahre alt – Austausch beim nächsten Termin ansprechen.",
            createdAt: daysAgo(3, 10),
          },
        ],
      },
      events: { create: [{ type: "CREATED", actorId: yilmaz.id, createdAt: daysAgo(3, 8) }] },
      costs: {
        create: [
          {
            kind: "MATERIAL",
            description: "Trommeleinheit Kyocera DK-1150",
            quantityHundredths: 100,
            unit: "Stk.",
            unitPriceCents: 8990,
            totalCents: 8990,
            performedAt: daysAgo(2),
            createdById: admin.id,
          },
          {
            kind: "LABOR",
            description: "Austausch Trommel und Testdruck vor Ort",
            quantityHundredths: 50,
            unit: "Std.",
            unitPriceCents: 9500,
            totalCents: 4750,
            performedAt: daysAgo(2),
            createdById: admin.id,
          },
          {
            kind: "TRAVEL",
            description: "Anfahrt Musterstadt",
            quantityHundredths: 100,
            unit: "Pauschale",
            unitPriceCents: 3500,
            totalCents: 3500,
            performedAt: daysAgo(2),
            createdById: admin.id,
          },
        ],
      },
    },
  });

  await db.ticket.create({
    data: {
      subject: "Neuer Mitarbeiter ab 1. des Monats: Zugang und Notebook",
      type: "ANFRAGE",
      category: "BENUTZER",
      priority: "LOW",
      status: "NEW",
      companyId: musterUlm.id,
      createdById: ulmLead.id,
      createdAt: daysAgo(1, 14),
      messages: {
        create: [
          {
            authorId: ulmLead.id,
            body: "Wir bekommen Verstärkung: Frau Lena Hoffmann startet am Ersten. Sie braucht ein Notebook wie die Kollegen, ein Microsoft-365-Konto und Zugriff auf das DATEV-Laufwerk. Können Sie ein Angebot für das Notebook schicken?",
            createdAt: daysAgo(1, 14),
          },
        ],
      },
      events: { create: [{ type: "CREATED", actorId: ulmLead.id, createdAt: daysAgo(1, 14) }] },
    },
  });

  await db.ticket.create({
    data: {
      subject: "VPN-Verbindung bricht im Homeoffice ständig ab",
      type: "STOERUNG",
      category: "NETZWERK",
      priority: "HIGH",
      status: "WAITING_CUSTOMER",
      companyId: musterHome.id,
      createdById: berger.id,
      assigneeId: tech.id,
      createdAt: daysAgo(5, 11),
      messages: {
        create: [
          {
            authorId: berger.id,
            body: "Frau Roth fliegt alle paar Minuten aus dem VPN. Ohne VPN kommt sie nicht ans Fibu-Programm.",
            createdAt: daysAgo(5, 11),
          },
          {
            authorId: tech.id,
            fromStaff: true,
            body: "Ich habe mir die Protokolle angesehen. Die Abbrüche passen zu WLAN-Aussetzern. Kann Frau Roth testweise per Kabel am Router arbeiten und Bescheid geben, ob es dann stabil läuft?",
            createdAt: daysAgo(4, 9),
          },
        ],
      },
      costs: {
        create: [
          {
            kind: "LABOR",
            description: "Fernwartung, Auswertung VPN-Protokolle",
            quantityHundredths: 75,
            unit: "Std.",
            unitPriceCents: 9500,
            totalCents: 7125,
            performedAt: daysAgo(4),
            createdById: admin.id,
          },
        ],
      },
    },
  });

  await db.ticket.create({
    data: {
      subject: "Kassen-PC startet nicht mehr",
      type: "STOERUNG",
      category: "ARBEITSPLATZ",
      priority: "CRITICAL",
      status: "RESOLVED",
      companyId: baeckerei.id,
      createdById: baecker.id,
      assigneeId: tech.id,
      createdAt: daysAgo(12, 6),
      resolvedAt: daysAgo(12, 9),
      messages: {
        create: [
          { authorId: baecker.id, body: "Der PC an der Kasse bleibt beim Hochfahren schwarz. Wir öffnen um 6:30!", createdAt: daysAgo(12, 6) },
          {
            authorId: tech.id,
            fromStaff: true,
            body: "Netzteil war defekt und ist getauscht. Die Kasse läuft wieder, die Tagesdaten sind vollständig.",
            createdAt: daysAgo(12, 9),
          },
        ],
      },
      costs: {
        create: [
          {
            kind: "MATERIAL",
            description: "Netzteil 400 W",
            quantityHundredths: 100,
            unit: "Stk.",
            unitPriceCents: 5490,
            totalCents: 5490,
            performedAt: daysAgo(12),
            createdById: admin.id,
            billed: true,
            billedAt: daysAgo(5),
          },
          {
            kind: "LABOR",
            description: "Notfalleinsatz vor Ladenöffnung",
            quantityHundredths: 150,
            unit: "Std.",
            unitPriceCents: 12000,
            totalCents: 18000,
            performedAt: daysAgo(12),
            createdById: admin.id,
            billed: true,
            billedAt: daysAgo(5),
          },
        ],
      },
    },
  });

  // Privatkunde (ohne Konto, Status-Link)
  const guestToken = "demo-status-link-" + randomBytes(12).toString("base64url");
  await db.ticket.create({
    data: {
      subject: "WLAN im Obergeschoss zu schwach",
      type: "STOERUNG",
      category: "NETZWERK",
      priority: "NORMAL",
      status: "IN_PROGRESS",
      source: "PRIVATE_FORM",
      contactName: "Familie Schneider",
      contactEmail: "schneider@privat.example",
      contactPhone: "0171 1234567",
      contactAddress: "Lindenstraße 8, 12345 Musterstadt",
      guestToken,
      assigneeId: tech.id,
      createdAt: daysAgo(2, 19),
      messages: {
        create: [
          {
            authorName: "Familie Schneider",
            body: "Im Kinderzimmer oben bricht das WLAN dauernd ab, Homeschooling ist so kaum möglich. Router steht im Keller (FritzBox 7590).",
            createdAt: daysAgo(2, 19),
          },
          {
            authorId: tech.id,
            fromStaff: true,
            body: "Guten Tag Familie Schneider, wir empfehlen einen Mesh-Repeater im Treppenhaus. Passt Ihnen Donnerstag um 16 Uhr für die Einrichtung vor Ort?",
            createdAt: daysAgo(1, 10),
          },
        ],
      },
      costs: {
        create: [
          {
            kind: "FLAT",
            description: "Einrichtung Mesh-Repeater inkl. Anfahrt (Privatkunden-Pauschale)",
            quantityHundredths: 100,
            unit: "Pauschale",
            unitPriceCents: 8900,
            totalCents: 8900,
            performedAt: daysAgo(1),
            createdById: admin.id,
          },
        ],
      },
    },
  });

  // Anfragen von Interessenten
  await db.inquiry.create({
    data: {
      customerType: "BUSINESS",
      name: "Martin Vogel",
      companyName: "Vogel Architekten",
      email: "vogel@architekten.example",
      phone: "0123 998877",
      zipCity: "12345 Musterstadt",
      topic: "BETREUUNG",
      workplaces: "6-15",
      message:
        "Wir sind ein Architekturbüro mit 9 Arbeitsplätzen und großen CAD-Dateien. Unser bisheriger IT-Betreuer hört auf. Wir suchen jemanden für die laufende Betreuung und eine bessere Datensicherung.",
      preferredContact: "PHONE",
      createdAt: daysAgo(0, 8),
    },
  });
  await db.inquiry.create({
    data: {
      customerType: "PRIVATE",
      name: "Helga Krause",
      email: "krause@privat.example",
      phone: "0123 445566",
      topic: "PRIVAT_HILFE",
      message: "Mein neuer Laptop soll eingerichtet werden und die Fotos vom alten Rechner sollen mit rüber.",
      preferredContact: "PHONE",
      status: "CONTACTED",
      internalNote: "Rückruf am Dienstag, Termin vor Ort vereinbart.",
      createdAt: daysAgo(4, 15),
    },
  });

  console.log("Beispieldaten angelegt.");
  console.log(`  Passwort für alle Demo-Konten: ${PASSWORD}`);
  console.log("  Verwaltung:      admin@hertlin.de (Admin), technik@hertlin.de (Techniker)");
  console.log("  Portal muster:   berger@muster.example (Hauptansprechpartnerin), yilmaz@muster.example, ulm@muster.example");
  console.log("  Portal baeckerei: chef@baeckerei.example");
  console.log(`  Status-Link Privatkunde: /status/${guestToken}`);
  void t1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

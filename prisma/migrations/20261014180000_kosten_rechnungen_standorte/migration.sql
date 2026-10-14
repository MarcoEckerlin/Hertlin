-- CreateTable
CREATE TABLE "CostPreset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceCents" INTEGER,
    "defaultQuantityHundredths" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostPreset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "openingHours" TEXT,
    "note" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "showOnWebsite" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INVOICE',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "cancelsInvoiceId" TEXT,
    "companyId" TEXT,
    "privateEmail" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientAddress" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "recipientVatId" TEXT,
    "issueDate" DATETIME NOT NULL,
    "servicePeriodStart" DATETIME,
    "servicePeriodEnd" DATETIME,
    "dueDate" DATETIME NOT NULL,
    "netCents" INTEGER NOT NULL,
    "taxRateBasisPoints" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "smallBusiness" BOOLEAN NOT NULL DEFAULT false,
    "introText" TEXT,
    "footerText" TEXT,
    "pdfPath" TEXT,
    "sentAt" DATETIME,
    "sentTo" TEXT,
    "paidAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_cancelsInvoiceId_fkey" FOREIGN KEY ("cancelsInvoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "performedAt" DATETIME,
    "quantityHundredths" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "costEntryId" TEXT,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "parentId" TEXT,
    "customerNumber" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "internalNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locationId" TEXT,
    "billingEmail" TEXT,
    "billingName" TEXT,
    "billingStreet" TEXT,
    "billingZip" TEXT,
    "billingCity" TEXT,
    "vatId" TEXT,
    "invoiceSeparately" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Company_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Company_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Company" ("active", "city", "createdAt", "customerNumber", "email", "id", "internalNote", "name", "parentId", "phone", "slug", "street", "updatedAt", "zip") SELECT "active", "city", "createdAt", "customerNumber", "email", "id", "internalNote", "name", "parentId", "phone", "slug", "street", "updatedAt", "zip" FROM "Company";
DROP TABLE "Company";
ALTER TABLE "new_Company" RENAME TO "Company";
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE UNIQUE INDEX "Company_customerNumber_key" ON "Company"("customerNumber");
CREATE INDEX "Company_parentId_idx" ON "Company"("parentId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL,
    "companyId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'de',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "locationId" TEXT,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "companyId", "createdAt", "email", "id", "language", "lastLoginAt", "name", "passwordHash", "phone", "position", "role", "updatedAt") SELECT "active", "companyId", "createdAt", "email", "id", "language", "lastLoginAt", "name", "passwordHash", "phone", "position", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE TABLE "new_Ticket" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "subject" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STOERUNG',
    "category" TEXT NOT NULL DEFAULT 'SONSTIGES',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'PORTAL',
    "companyId" TEXT,
    "createdById" TEXT,
    "assigneeId" TEXT,
    "locationId" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactAddress" TEXT,
    "guestToken" TEXT,
    "contactLanguage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "Ticket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ticket" ("assigneeId", "category", "closedAt", "companyId", "contactAddress", "contactEmail", "contactLanguage", "contactName", "contactPhone", "createdAt", "createdById", "guestToken", "id", "priority", "resolvedAt", "source", "status", "subject", "type", "updatedAt") SELECT "assigneeId", "category", "closedAt", "companyId", "contactAddress", "contactEmail", "contactLanguage", "contactName", "contactPhone", "createdAt", "createdById", "guestToken", "id", "priority", "resolvedAt", "source", "status", "subject", "type", "updatedAt" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
CREATE UNIQUE INDEX "Ticket_guestToken_key" ON "Ticket"("guestToken");
CREATE INDEX "Ticket_companyId_idx" ON "Ticket"("companyId");
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");
CREATE INDEX "Ticket_contactEmail_idx" ON "Ticket"("contactEmail");
CREATE INDEX "Ticket_locationId_idx" ON "Ticket"("locationId");
CREATE TABLE "new_CostEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantityHundredths" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "performedAt" DATETIME NOT NULL,
    "billed" BOOLEAN NOT NULL DEFAULT false,
    "billedAt" DATETIME,
    "createdById" TEXT,
    "performedById" TEXT,
    "presetId" TEXT,
    "needsPrice" BOOLEAN NOT NULL DEFAULT false,
    "invoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostEntry_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostEntry_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "CostPreset" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CostEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CostEntry" ("billed", "billedAt", "createdAt", "createdById", "description", "id", "kind", "performedAt", "quantityHundredths", "ticketId", "totalCents", "unit", "unitPriceCents", "updatedAt") SELECT "billed", "billedAt", "createdAt", "createdById", "description", "id", "kind", "performedAt", "quantityHundredths", "ticketId", "totalCents", "unit", "unitPriceCents", "updatedAt" FROM "CostEntry";
DROP TABLE "CostEntry";
ALTER TABLE "new_CostEntry" RENAME TO "CostEntry";
CREATE INDEX "CostEntry_ticketId_idx" ON "CostEntry"("ticketId");
CREATE INDEX "CostEntry_performedAt_idx" ON "CostEntry"("performedAt");
CREATE INDEX "CostEntry_invoiceId_idx" ON "CostEntry"("invoiceId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CostPreset_nameKey_key" ON "CostPreset"("nameKey");

-- CreateIndex
CREATE INDEX "CostPreset_active_kind_idx" ON "CostPreset"("active", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_cancelsInvoiceId_key" ON "Invoice"("cancelsInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_idx" ON "Invoice"("companyId");

-- CreateIndex
CREATE INDEX "Invoice_privateEmail_idx" ON "Invoice"("privateEmail");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_year_sequence_key" ON "Invoice"("year", "sequence");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");


-- Startkatalog mit Standardpositionen (Preise netto, in der Verwaltung unter Kosten → Katalog anpassen)
INSERT INTO "CostPreset" ("id", "kind", "name", "nameKey", "unit", "unitPriceCents", "defaultQuantityHundredths", "sortOrder", "createdAt", "updatedAt") VALUES
  ('preset_arbeitszeit', 'LABOR', 'Arbeitszeit Technik', 'arbeitszeit technik', 'Std.', 9500, 100, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('preset_fernwartung', 'LABOR', 'Fernwartung', 'fernwartung', 'Std.', 9500, 50, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('preset_anfahrt', 'TRAVEL', 'Anfahrt Stadtgebiet', 'anfahrt stadtgebiet', 'Pauschale', 3500, 100, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('preset_km', 'TRAVEL', 'Fahrtkosten je Kilometer', 'fahrtkosten je kilometer', 'km', 60, 2000, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('preset_material', 'MATERIAL', 'Material nach Beleg', 'material nach beleg', 'Stk.', NULL, 100, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Bisherige Positionen: erbracht von der Person, die sie erfasst hat
UPDATE "CostEntry" SET "performedById" = "createdById" WHERE "performedById" IS NULL;

-- AlterTable
ALTER TABLE "Inquiry" ADD COLUMN "guestToken" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "language" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "contactLanguage" TEXT;

-- AlterTable
ALTER TABLE "TicketMessage" ADD COLUMN "language" TEXT;

-- CreateTable
CREATE TABLE "InquiryMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inquiryId" INTEGER NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "language" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InquiryMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranslationCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hash" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "sourceLang" TEXT,
    "text" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "navLabel" TEXT,
    "showInNav" BOOLEAN NOT NULL DEFAULT false,
    "showInFooter" BOOLEAN NOT NULL DEFAULT false,
    "navOrder" INTEGER NOT NULL DEFAULT 100,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "blocks" TEXT NOT NULL DEFAULT '[]',
    "draft" TEXT,
    "updatedById" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" TEXT,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PhoneCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'generic',
    "direction" TEXT NOT NULL DEFAULT 'IN',
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RINGING',
    "answeredBy" TEXT,
    "hangupCause" TEXT,
    "companyId" TEXT,
    "userId" TEXT,
    "callerLabel" TEXT,
    "ticketId" INTEGER,
    "note" TEXT,
    "handledById" TEXT,
    "handledAt" DATETIME,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" DATETIME,
    "endedAt" DATETIME,
    CONSTRAINT "PhoneCall_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhoneCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhoneCall_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhoneCall_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "companyId", "createdAt", "email", "id", "lastLoginAt", "name", "passwordHash", "phone", "position", "role", "updatedAt") SELECT "active", "companyId", "createdAt", "email", "id", "lastLoginAt", "name", "passwordHash", "phone", "position", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InquiryMessage_inquiryId_idx" ON "InquiryMessage"("inquiryId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationCache_hash_targetLang_key" ON "TranslationCache"("hash", "targetLang");

-- CreateIndex
CREATE UNIQUE INDEX "Page_slug_key" ON "Page"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "MediaFile_storedName_key" ON "MediaFile"("storedName");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneCall_externalId_key" ON "PhoneCall"("externalId");

-- CreateIndex
CREATE INDEX "PhoneCall_startedAt_idx" ON "PhoneCall"("startedAt");

-- CreateIndex
CREATE INDEX "PhoneCall_status_idx" ON "PhoneCall"("status");

-- CreateIndex
CREATE INDEX "PhoneCall_fromNumber_idx" ON "PhoneCall"("fromNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_guestToken_key" ON "Inquiry"("guestToken");


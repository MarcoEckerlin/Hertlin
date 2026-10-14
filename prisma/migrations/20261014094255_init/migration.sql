-- CreateTable
CREATE TABLE "Company" (
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
    CONSTRAINT "Company_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL,
    "companyId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
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
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactAddress" TEXT,
    "guestToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "Ticket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" INTEGER NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "TicketMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" INTEGER NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostEntry" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CostEntry_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CostEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "zipCity" TEXT,
    "topic" TEXT NOT NULL,
    "workplaces" TEXT,
    "message" TEXT NOT NULL,
    "preferredContact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "internalNote" TEXT,
    "companyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inquiry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_customerNumber_key" ON "Company"("customerNumber");

-- CreateIndex
CREATE INDEX "Company_parentId_idx" ON "Company"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_idx" ON "AuthToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_guestToken_key" ON "Ticket"("guestToken");

-- CreateIndex
CREATE INDEX "Ticket_companyId_idx" ON "Ticket"("companyId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");

-- CreateIndex
CREATE INDEX "Ticket_contactEmail_idx" ON "Ticket"("contactEmail");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storedName_key" ON "Attachment"("storedName");

-- CreateIndex
CREATE INDEX "Attachment_messageId_idx" ON "Attachment"("messageId");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_idx" ON "TicketEvent"("ticketId");

-- CreateIndex
CREATE INDEX "CostEntry_ticketId_idx" ON "CostEntry"("ticketId");

-- CreateIndex
CREATE INDEX "CostEntry_performedAt_idx" ON "CostEntry"("performedAt");

-- CreateIndex
CREATE INDEX "Inquiry_status_idx" ON "Inquiry"("status");

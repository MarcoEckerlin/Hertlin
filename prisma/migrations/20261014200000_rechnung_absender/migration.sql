-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "customerNumber" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "issuerSnapshot" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "pdfSha256" TEXT;


-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ACCOUNTANT', 'VIEWER');

-- DropIndex
DROP INDEX "customers_isArchived_idx";

-- DropIndex
DROP INDEX "invoices_customerId_idx";

-- DropIndex
DROP INDEX "invoices_invoiceDate_idx";

-- DropIndex
DROP INDEX "products_isActive_idx";

-- DropIndex
DROP INDEX "products_isArchived_idx";

-- AlterTable
ALTER TABLE "invoice_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "isReversed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedByUserId" TEXT,
ADD COLUMN     "reversedReason" TEXT;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeBusinessId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "business_memberships_userId_idx" ON "business_memberships"("userId");

-- CreateIndex
CREATE INDEX "business_memberships_businessId_idx" ON "business_memberships"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "business_memberships_userId_businessId_key" ON "business_memberships"("userId", "businessId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_tokenHash_idx" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "audit_logs_businessId_createdAt_idx" ON "audit_logs"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "customers_businessId_isArchived_idx" ON "customers"("businessId", "isArchived");

-- CreateIndex
CREATE INDEX "customers_businessId_name_idx" ON "customers"("businessId", "name");

-- CreateIndex
CREATE INDEX "invoices_businessId_invoiceDate_idx" ON "invoices"("businessId", "invoiceDate");

-- CreateIndex
CREATE INDEX "invoices_businessId_customerId_idx" ON "invoices"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "payments_invoiceId_isReversed_idx" ON "payments"("invoiceId", "isReversed");

-- CreateIndex
CREATE INDEX "payments_isReversed_idx" ON "payments"("isReversed");

-- CreateIndex
CREATE INDEX "products_businessId_isActive_isArchived_idx" ON "products"("businessId", "isActive", "isArchived");

-- AddForeignKey
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_memberships" ADD CONSTRAINT "business_memberships_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

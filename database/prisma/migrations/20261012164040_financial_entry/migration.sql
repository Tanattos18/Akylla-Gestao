-- CreateEnum
CREATE TYPE "FinancialDirection" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateEnum
CREATE TYPE "FinancialStatus" AS ENUM ('OPEN', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancialOrigin" AS ENUM ('MANUAL', 'SALE', 'SUBSCRIPTION');

-- AlterEnum
ALTER TYPE "CashMovementOrigin" ADD VALUE 'ACCOUNT';

-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "direction" "FinancialDirection" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FinancialStatus" NOT NULL DEFAULT 'OPEN',
    "paidAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "clientId" TEXT,
    "supplierId" TEXT,
    "categoryId" TEXT,
    "origin" "FinancialOrigin" NOT NULL DEFAULT 'MANUAL',
    "originId" TEXT,
    "clientRequestId" TEXT,
    "cashMovementId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialEntry_companyId_status_dueDate_idx" ON "FinancialEntry"("companyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_companyId_direction_status_dueDate_idx" ON "FinancialEntry"("companyId", "direction", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_companyId_clientId_idx" ON "FinancialEntry"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "FinancialEntry_companyId_supplierId_idx" ON "FinancialEntry"("companyId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_companyId_origin_originId_key" ON "FinancialEntry"("companyId", "origin", "originId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialEntry_companyId_clientRequestId_key" ON "FinancialEntry"("companyId", "clientRequestId");

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_cashMovementId_fkey" FOREIGN KEY ("cashMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fase 2 · 2.1 — Comissões (aditiva) + RLS das tabelas novas (regra do AGENTS.md)

-- CreateEnum
CREATE TYPE "ReleasePolicy" AS ENUM ('ON_SALE', 'ON_PAYMENT', 'SPLIT_50_50');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'RELEASED', 'PAID', 'CANCELLED');

-- AlterEnum
ALTER TYPE "BusinessModule" ADD VALUE 'COMMISSIONS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FinancialOrigin" ADD VALUE 'COMMISSION';
ALTER TYPE "FinancialOrigin" ADD VALUE 'COMMISSION_REVERSAL';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "professionalId" TEXT;

-- CreateTable
CREATE TABLE "Professional" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "document" TEXT,
    "commissionDefault" DECIMAL(5,2),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "professionalId" TEXT,
    "productId" TEXT,
    "categoryId" TEXT,
    "percentage" DECIMAL(5,2) NOT NULL,
    "releasePolicy" "ReleasePolicy" NOT NULL DEFAULT 'ON_SALE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT,
    "professionalId" TEXT NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "percentage" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "releasePolicy" "ReleasePolicy" NOT NULL DEFAULT 'ON_SALE',
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "lines" JSONB NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "financialEntryId" TEXT,
    "reversalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Professional_companyId_status_idx" ON "Professional"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_companyId_nameKey_key" ON "Professional"("companyId", "nameKey");

-- CreateIndex
CREATE INDEX "CommissionRule_companyId_active_idx" ON "CommissionRule"("companyId", "active");

-- CreateIndex
CREATE INDEX "CommissionRule_companyId_professionalId_idx" ON "CommissionRule"("companyId", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_financialEntryId_key" ON "Commission"("financialEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_reversalEntryId_key" ON "Commission"("reversalEntryId");

-- CreateIndex
CREATE INDEX "Commission_companyId_status_createdAt_idx" ON "Commission"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Commission_companyId_professionalId_createdAt_idx" ON "Commission"("companyId", "professionalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_saleId_professionalId_key" ON "Commission"("saleId", "professionalId");

-- CreateIndex
CREATE INDEX "Sale_companyId_professionalId_idx" ON "Sale"("companyId", "professionalId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRule" ADD CONSTRAINT "CommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS (Fase 1 · 1E): toda tabela nova com companyId entra na política
ALTER TABLE "Professional" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Professional" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Professional"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "CommissionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommissionRule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CommissionRule"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Commission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Commission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Commission"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

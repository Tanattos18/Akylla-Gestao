-- Fase 2 · 2.2 — Crediário (aditiva) + RLS das tabelas novas (regra do AGENTS.md)

-- CreateEnum
CREATE TYPE "CreditAccountStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CreditInstallmentStatus" AS ENUM ('OPEN', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterEnum
ALTER TYPE "BusinessModule" ADD VALUE 'CREDIT';

-- AlterEnum
ALTER TYPE "FinancialOrigin" ADD VALUE 'CREDIT_SALE';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'CREDIARIO';

-- CreateTable
CREATE TABLE "CreditAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "creditLimit" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CreditAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditInstallment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "creditAccountId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "totalInstallments" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CreditInstallmentStatus" NOT NULL DEFAULT 'OPEN',
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "financialEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditAccount_clientId_key" ON "CreditAccount"("clientId");

-- CreateIndex
CREATE INDEX "CreditAccount_companyId_status_idx" ON "CreditAccount"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditInstallment_financialEntryId_key" ON "CreditInstallment"("financialEntryId");

-- CreateIndex
CREATE INDEX "CreditInstallment_companyId_status_dueDate_idx" ON "CreditInstallment"("companyId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "CreditInstallment_creditAccountId_status_idx" ON "CreditInstallment"("creditAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreditInstallment_saleId_number_key" ON "CreditInstallment"("saleId", "number");

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditAccount" ADD CONSTRAINT "CreditAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditInstallment" ADD CONSTRAINT "CreditInstallment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditInstallment" ADD CONSTRAINT "CreditInstallment_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "CreditAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditInstallment" ADD CONSTRAINT "CreditInstallment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "CreditAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CreditAccount"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "CreditInstallment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreditInstallment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CreditInstallment"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

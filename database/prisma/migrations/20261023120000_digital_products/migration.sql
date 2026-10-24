-- Transformação 2026-10-23: catálogo de produtos digitais, entregas por
-- cliente, vínculo contrato (Subscription) → entrega e configuração de
-- atraso da empresa. Só adiciona: nenhuma coluna ou tabela é removida.

-- CreateEnum
CREATE TYPE "DigitalProductType" AS ENUM ('SITE', 'PROFESSIONAL_PROFILE', 'SYSTEM', 'ONLINE_STORE', 'HOSTING', 'DOMAIN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "DigitalBillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('IN_PROGRESS', 'ACTIVE', 'PAUSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "overduePauseDays" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "overdueWarnDays" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "deliveryId" TEXT;

-- CreateTable
CREATE TABLE "DigitalProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "type" "DigitalProductType" NOT NULL,
    "description" TEXT,
    "defaultPrice" DECIMAL(12,2) NOT NULL,
    "billingPeriod" "DigitalBillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientDelivery" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "type" "DigitalProductType" NOT NULL,
    "siteUrl" TEXT,
    "adminUrl" TEXT,
    "repositoryUrl" TEXT,
    "domain" TEXT,
    "domainRenewalAt" TIMESTAMP(3),
    "hostingProvider" TEXT,
    "hostingRenewalAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'ACTIVE',
    "neverPause" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DigitalProduct_companyId_status_idx" ON "DigitalProduct"("companyId", "status");

-- CreateIndex
CREATE INDEX "DigitalProduct_companyId_type_idx" ON "DigitalProduct"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalProduct_companyId_nameKey_key" ON "DigitalProduct"("companyId", "nameKey");

-- CreateIndex
CREATE INDEX "ClientDelivery_companyId_status_idx" ON "ClientDelivery"("companyId", "status");

-- CreateIndex
CREATE INDEX "ClientDelivery_companyId_clientId_idx" ON "ClientDelivery"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "ClientDelivery_companyId_type_idx" ON "ClientDelivery"("companyId", "type");

-- CreateIndex
CREATE INDEX "ClientDelivery_companyId_createdAt_idx" ON "ClientDelivery"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_deliveryId_idx" ON "Subscription"("deliveryId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ClientDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalProduct" ADD CONSTRAINT "DigitalProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDelivery" ADD CONSTRAINT "ClientDelivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDelivery" ADD CONSTRAINT "ClientDelivery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientDelivery" ADD CONSTRAINT "ClientDelivery_productId_fkey" FOREIGN KEY ("productId") REFERENCES "DigitalProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (ADR-0001)
ALTER TABLE "DigitalProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DigitalProduct" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DigitalProduct"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- RLS (ADR-0001)
ALTER TABLE "ClientDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientDelivery" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ClientDelivery"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

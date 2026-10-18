-- Fase 3 — Fiscal por integração (aditiva) + RLS das tabelas novas (regra do AGENTS.md)

-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('HOMOLOGATION', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "FiscalDocumentType" AS ENUM ('NFE', 'NFCE', 'NFSE');

-- CreateEnum
CREATE TYPE "FiscalDocumentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "BusinessModule" ADD VALUE 'FISCAL';

-- CreateTable
CREATE TABLE "FiscalConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "apiTokenEncrypted" TEXT,
    "cnpj" TEXT,
    "certificateEncrypted" TEXT,
    "certificatePasswordEncrypted" TEXT,
    "certificateSubject" TEXT,
    "certificateValidTo" TIMESTAMP(3),
    "environment" "FiscalEnvironment" NOT NULL DEFAULT 'HOMOLOGATION',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "nfceSeries" INTEGER NOT NULL DEFAULT 1,
    "nfeSeries" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "saleId" TEXT,
    "serviceOrderId" TEXT,
    "type" "FiscalDocumentType" NOT NULL,
    "status" "FiscalDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "environment" "FiscalEnvironment" NOT NULL,
    "number" INTEGER NOT NULL,
    "series" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "accessKey" TEXT,
    "protocol" TEXT,
    "xml" TEXT,
    "danfeUrl" TEXT,
    "issuedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "rejectionReason" TEXT,
    "gatewayDocumentId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalConfig_companyId_key" ON "FiscalConfig"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_gatewayDocumentId_key" ON "FiscalDocument"("gatewayDocumentId");

-- CreateIndex
CREATE INDEX "FiscalDocument_companyId_status_createdAt_idx" ON "FiscalDocument"("companyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "FiscalDocument_saleId_idx" ON "FiscalDocument"("saleId");

-- CreateIndex
CREATE INDEX "FiscalDocument_serviceOrderId_idx" ON "FiscalDocument"("serviceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDocument_companyId_type_series_number_key" ON "FiscalDocument"("companyId", "type", "series", "number");

-- AddForeignKey
ALTER TABLE "FiscalConfig" ADD CONSTRAINT "FiscalConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDocument" ADD CONSTRAINT "FiscalDocument_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "FiscalConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FiscalConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FiscalConfig"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "FiscalDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FiscalDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FiscalDocument"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

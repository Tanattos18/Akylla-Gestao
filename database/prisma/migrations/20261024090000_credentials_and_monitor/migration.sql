-- Transformação 2026-10-23 (continuação): logins das entregas com senha
-- cifrada + auditoria imutável de acesso, e monitor de sites (só leitura:
-- o worker faz GET/HEAD). Só adiciona colunas e tabelas.

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "CredentialAction" AS ENUM ('CREATE', 'UPDATE', 'REVEAL', 'ARCHIVE');

-- AlterTable
ALTER TABLE "ClientDelivery" ADD COLUMN     "monitorCheckedAt" TIMESTAMP(3),
ADD COLUMN     "monitorDownSince" TIMESTAMP(3),
ADD COLUMN     "monitorEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monitorHttpStatus" INTEGER,
ADD COLUMN     "monitorResponseMs" INTEGER,
ADD COLUMN     "monitorStatus" "SiteStatus";

-- CreateTable
CREATE TABLE "DeliveryCredential" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "username" TEXT,
    "secretEncrypted" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialAccessLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "CredentialAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteCheck" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "responseMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryCredential_companyId_deliveryId_idx" ON "DeliveryCredential"("companyId", "deliveryId");

-- CreateIndex
CREATE INDEX "CredentialAccessLog_companyId_credentialId_createdAt_idx" ON "CredentialAccessLog"("companyId", "credentialId", "createdAt");

-- CreateIndex
CREATE INDEX "SiteCheck_companyId_deliveryId_checkedAt_idx" ON "SiteCheck"("companyId", "deliveryId", "checkedAt");

-- CreateIndex
CREATE INDEX "SiteCheck_checkedAt_idx" ON "SiteCheck"("checkedAt");

-- AddForeignKey
ALTER TABLE "DeliveryCredential" ADD CONSTRAINT "DeliveryCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCredential" ADD CONSTRAINT "DeliveryCredential_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ClientDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCredential" ADD CONSTRAINT "DeliveryCredential_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccessLog" ADD CONSTRAINT "CredentialAccessLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccessLog" ADD CONSTRAINT "CredentialAccessLog_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "DeliveryCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccessLog" ADD CONSTRAINT "CredentialAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteCheck" ADD CONSTRAINT "SiteCheck_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteCheck" ADD CONSTRAINT "SiteCheck_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ClientDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (ADR-0001)
ALTER TABLE "DeliveryCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeliveryCredential" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DeliveryCredential"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- RLS (ADR-0001)
ALTER TABLE "CredentialAccessLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CredentialAccessLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CredentialAccessLog"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- RLS (ADR-0001)
ALTER TABLE "SiteCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteCheck" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SiteCheck"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

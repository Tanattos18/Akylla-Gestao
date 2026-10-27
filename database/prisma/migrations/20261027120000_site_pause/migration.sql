-- 2026-10-27: controle de pausa dos sites vendidos (pausar, ativar, inativar,
-- prazo combinado), histórico imutável das ações, chave pública do script de
-- status e textos editáveis. Pausa automática DESLIGADA por padrão. Só adiciona.

-- CreateEnum
CREATE TYPE "BillingAction" AS ENUM ('ACTIVATE', 'PAUSE', 'DEACTIVATE', 'REACTIVATE', 'AUTO_PAUSE', 'AUTO_RESUME', 'GRACE');

-- AlterTable
ALTER TABLE "ClientDelivery" ADD COLUMN     "pausedForDebt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicKey" TEXT,
ADD COLUMN     "showWarningBanner" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "autoPauseDays" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "autoPauseEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingTextAgreement" TEXT,
ADD COLUMN     "billingTextBefore" TEXT,
ADD COLUMN     "billingTextOverdue" TEXT,
ADD COLUMN     "siteSuspendedText" TEXT,
ADD COLUMN     "siteWarningText" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "graceNote" TEXT,
ADD COLUMN     "graceUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BillingActionLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "subscriptionId" TEXT,
    "action" "BillingAction" NOT NULL,
    "fromStatus" "DeliveryStatus",
    "toStatus" "DeliveryStatus",
    "reason" TEXT,
    "graceUntil" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingActionLog_companyId_deliveryId_createdAt_idx" ON "BillingActionLog"("companyId", "deliveryId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingActionLog_companyId_subscriptionId_createdAt_idx" ON "BillingActionLog"("companyId", "subscriptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientDelivery_publicKey_key" ON "ClientDelivery"("publicKey");

-- AddForeignKey
ALTER TABLE "BillingActionLog" ADD CONSTRAINT "BillingActionLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingActionLog" ADD CONSTRAINT "BillingActionLog_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ClientDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingActionLog" ADD CONSTRAINT "BillingActionLog_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingActionLog" ADD CONSTRAINT "BillingActionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (ADR-0001)
ALTER TABLE "BillingActionLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BillingActionLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BillingActionLog"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

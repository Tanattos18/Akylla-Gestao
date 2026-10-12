-- AlterTable
ALTER TABLE "TenantPlan" ADD COLUMN     "clientLimit" INTEGER,
ADD COLUMN     "productLimit" INTEGER,
ADD COLUMN     "userLimit" INTEGER;

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "gateway" TEXT,
ADD COLUMN     "gatewaySubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscription_gatewaySubscriptionId_key" ON "TenantSubscription"("gatewaySubscriptionId");

-- Define limites nos planos seed existentes (decisao D1/D2 da Etapa 11)
UPDATE "TenantPlan" SET "userLimit" = 3, "clientLimit" = 200, "productLimit" = 100 WHERE "nameKey" = 'essencial';
UPDATE "TenantPlan" SET "userLimit" = 10, "clientLimit" = 1000, "productLimit" = 500 WHERE "nameKey" = 'profissional';
UPDATE "TenantPlan" SET "userLimit" = NULL, "clientLimit" = NULL, "productLimit" = NULL WHERE "nameKey" = 'completo';

-- Fase 8 — cobrança do SaaS: teste grátis, isenção, suspensão, ciclo anual e
-- pagamentos registrados pelo dono da plataforma. DML em tabelas com RLS FORCE.
SET LOCAL app.rls_bypass = 'on';

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PlatformPaymentMethod" AS ENUM ('PIX', 'BOLETO', 'CARD', 'MERCADO_PAGO', 'OTHER');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "billingExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TenantPlan" ADD COLUMN     "priceYearly" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY';

-- CreateTable
CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "cycle" "BillingCycle" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PlatformPaymentMethod" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformPayment_companyId_createdAt_idx" ON "PlatformPayment"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS na tabela nova (regra do AGENTS.md)
ALTER TABLE "PlatformPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlatformPayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PlatformPayment"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- Preços aprovados pelo proprietário (2026-10-18): anual = 10 mensalidades
-- (2 meses grátis). Descrições alinhadas ao site: todos os planos têm todos
-- os recursos; muda o tamanho da operação.
UPDATE "TenantPlan" SET "priceMonthly" = 79.90, "priceYearly" = 799.00,
  "description" = 'Para quem está começando ou trabalha sozinho: até 3 usuários, 200 clientes e 100 produtos'
  WHERE "nameKey" = 'essencial';
UPDATE "TenantPlan" SET "priceMonthly" = 149.90, "priceYearly" = 1499.00,
  "description" = 'Para negócios com equipe e movimento diário: até 10 usuários, 1.000 clientes e 500 produtos'
  WHERE "nameKey" = 'profissional';
UPDATE "TenantPlan" SET "priceMonthly" = 249.90, "priceYearly" = 2499.00,
  "description" = 'Para quem não quer se preocupar com limites: usuários, clientes e produtos ilimitados'
  WHERE "nameKey" = 'completo';

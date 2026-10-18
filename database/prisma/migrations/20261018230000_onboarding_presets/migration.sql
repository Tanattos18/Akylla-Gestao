-- Fase 4 — perfis de onboarding (aditiva) + dados de referência
-- DML em tabela com RLS FORCE (Company): liga o bypass só nesta transação
-- (regra do AGENTS.md).
SET LOCAL app.rls_bypass = 'on';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "segment" TEXT;

-- CreateTable
CREATE TABLE "OnboardingPreset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "defaultModules" "BusinessModule"[],
    "defaultFiscalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingPreset_slug_key" ON "OnboardingPreset"("slug");


-- Empresas existentes já estão configuradas: não forçar o onboarding
UPDATE "Company" SET "onboardingCompletedAt" = "createdAt" WHERE "onboardingCompletedAt" IS NULL;

-- Catálogo global de perfis (Fase 4)
INSERT INTO "OnboardingPreset" ("id", "slug", "name", "description", "defaultModules", "defaultFiscalEnabled", "sortOrder") VALUES
  ('preset_comercio', 'COMERCIO', 'Comércio', 'Lojas, mercadinhos, adegas, papelarias e conveniência: PDV, estoque, crediário, comissão de vendedor e nota fiscal.', ARRAY['FISCAL', 'COMMISSIONS', 'CREDIT', 'WHATSAPP']::"BusinessModule"[], true, 1),
  ('preset_servicos', 'SERVICOS', 'Serviços', 'Salões, clínicas, oficinas e assistências: agenda, catálogo de serviços, ordem de serviço, comissão e lembretes no WhatsApp.', ARRAY['SERVICES', 'APPOINTMENTS', 'SERVICE_ORDERS', 'WHATSAPP', 'COMMISSIONS']::"BusinessModule"[], false, 2),
  ('preset_hibrido', 'HIBRIDO', 'Comércio e serviços', 'Pet shops, oficinas com loja e estúdios que vendem produtos: tudo de serviços + crediário e comissões.', ARRAY['SERVICES', 'APPOINTMENTS', 'SERVICE_ORDERS', 'COMMISSIONS', 'CREDIT', 'WHATSAPP']::"BusinessModule"[], false, 3),
  ('preset_personalizado', 'PERSONALIZADO', 'Personalizado', 'Escolha você mesmo quais módulos usar em Configurações.', ARRAY[]::"BusinessModule"[], false, 4)
ON CONFLICT ("slug") DO NOTHING;

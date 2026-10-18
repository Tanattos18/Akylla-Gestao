-- Fase 8b — kits de módulos (Básico, Intermediário, Avançado), preço por
-- módulo e combos personalizados. Valores SUGERIDOS: o dono edita no painel.
SET LOCAL app.rls_bypass = 'on';

-- AlterTable
ALTER TABLE "PlatformPayment" ADD COLUMN     "extraModules" "BusinessModule"[] DEFAULT ARRAY[]::"BusinessModule"[];

-- AlterTable
ALTER TABLE "TenantPlan" ADD COLUMN     "includedModules" "BusinessModule"[] DEFAULT ARRAY[]::"BusinessModule"[],
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "extraModules" "BusinessModule"[] DEFAULT ARRAY[]::"BusinessModule"[];

-- CreateTable
CREATE TABLE "ModuleOffer" (
    "module" "BusinessModule" NOT NULL,
    "description" TEXT NOT NULL,
    "priceMonthly" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleOffer_pkey" PRIMARY KEY ("module")
);


-- Kits: mesmos ids/limites; nomes e módulos incluídos (o núcleo — PDV,
-- estoque, caixa, financeiro, clientes e relatórios — vale para todos)
UPDATE "TenantPlan" SET "name" = 'Básico', "sortOrder" = 1,
  "includedModules" = ARRAY['WHATSAPP','CREDIT']::"BusinessModule"[],
  "description" = 'Núcleo (PDV, estoque, caixa, financeiro, clientes e relatórios) + WhatsApp e Crediário. Até 3 usuários, 200 clientes e 100 produtos'
  WHERE "nameKey" = 'essencial';
UPDATE "TenantPlan" SET "name" = 'Intermediário', "sortOrder" = 2,
  "includedModules" = ARRAY['WHATSAPP','CREDIT','SERVICES','APPOINTMENTS','COMMISSIONS']::"BusinessModule"[],
  "description" = 'Tudo do Básico + Serviços, Agenda e Comissões. Até 10 usuários, 1.000 clientes e 500 produtos'
  WHERE "nameKey" = 'profissional';
UPDATE "TenantPlan" SET "name" = 'Avançado', "sortOrder" = 3,
  "includedModules" = ARRAY['WHATSAPP','CREDIT','SERVICES','APPOINTMENTS','COMMISSIONS','SERVICE_ORDERS','FISCAL','SUBSCRIPTIONS','PETS']::"BusinessModule"[],
  "description" = 'Todos os módulos, incluindo Ordem de serviço e Nota fiscal. Usuários, clientes e produtos ilimitados'
  WHERE "nameKey" = 'completo';

-- Preço mensal de cada módulo avulso (combo = kit + módulos avulsos)
INSERT INTO "ModuleOffer" ("module", "description", "priceMonthly", "sortOrder", "updatedAt") VALUES
  ('WHATSAPP', 'Lembretes e mensagens pelo WhatsApp oficial', 29.90, 1, CURRENT_TIMESTAMP),
  ('CREDIT', 'Crediário: venda a prazo com parcelas e limite por cliente', 19.90, 2, CURRENT_TIMESTAMP),
  ('SERVICES', 'Catálogo de serviços com preço e duração', 9.90, 3, CURRENT_TIMESTAMP),
  ('APPOINTMENTS', 'Agenda com conflito de horário e visão semana/mês', 19.90, 4, CURRENT_TIMESTAMP),
  ('COMMISSIONS', 'Comissões por profissional, produto ou categoria', 19.90, 5, CURRENT_TIMESTAMP),
  ('SERVICE_ORDERS', 'Ordem de serviço com orçamento, fotos e anexos', 29.90, 6, CURRENT_TIMESTAMP),
  ('FISCAL', 'Nota fiscal (NFC-e, NF-e, NFS-e) por integradora; custo por nota à parte', 39.90, 7, CURRENT_TIMESTAMP),
  ('SUBSCRIPTIONS', 'Planos recorrentes e assinaturas de clientes', 19.90, 8, CURRENT_TIMESTAMP),
  ('PETS', 'Ficha de pets vinculada ao cliente', 9.90, 9, CURRENT_TIMESTAMP)
ON CONFLICT ("module") DO NOTHING;

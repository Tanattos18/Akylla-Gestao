-- Retira o módulo PETS do produto (2026-10-19): o Akylla Gestão é um
-- sistema de gestão empresarial, sem funções específicas de pet shop.
--
-- Não apaga dados de negócio: a tabela "Pet" e "Appointment"."petId"
-- continuam no banco como LEGADO (somente leitura, fora da API e das telas;
-- entram na exportação de dados da empresa e na anonimização LGPD).
-- Remove só configuração: a chave do módulo, o preço avulso e o valor
-- 'PETS' do enum "BusinessModule".
SET LOCAL app.rls_bypass = 'on';

DELETE FROM "CompanyModule" WHERE "module" = 'PETS';
DELETE FROM "ModuleOffer" WHERE "module" = 'PETS';
UPDATE "TenantPlan" SET "includedModules" = array_remove("includedModules", 'PETS'::"BusinessModule");
UPDATE "TenantSubscription" SET "extraModules" = array_remove("extraModules", 'PETS'::"BusinessModule");
UPDATE "PlatformPayment" SET "extraModules" = array_remove("extraModules", 'PETS'::"BusinessModule");
UPDATE "OnboardingPreset" SET "defaultModules" = array_remove("defaultModules", 'PETS'::"BusinessModule");
UPDATE "OnboardingPreset"
SET "description" = 'Oficinas com loja, estúdios, clínicas e assistências que também vendem produtos: tudo de serviços + crediário e comissões.'
WHERE "slug" = 'HIBRIDO';

-- Recria o enum sem 'PETS'
ALTER TYPE "BusinessModule" RENAME TO "BusinessModule_old";
CREATE TYPE "BusinessModule" AS ENUM ('APPOINTMENTS', 'SERVICES', 'WHATSAPP', 'SUBSCRIPTIONS', 'COMMISSIONS', 'CREDIT', 'SERVICE_ORDERS', 'FISCAL');

ALTER TABLE "CompanyModule" ALTER COLUMN "module" TYPE "BusinessModule" USING ("module"::text::"BusinessModule");
ALTER TABLE "ModuleOffer" ALTER COLUMN "module" TYPE "BusinessModule" USING ("module"::text::"BusinessModule");
ALTER TABLE "OnboardingPreset" ALTER COLUMN "defaultModules" TYPE "BusinessModule"[] USING ("defaultModules"::text[]::"BusinessModule"[]);

ALTER TABLE "TenantPlan" ALTER COLUMN "includedModules" DROP DEFAULT;
ALTER TABLE "TenantPlan" ALTER COLUMN "includedModules" TYPE "BusinessModule"[] USING ("includedModules"::text[]::"BusinessModule"[]);
ALTER TABLE "TenantPlan" ALTER COLUMN "includedModules" SET DEFAULT ARRAY[]::"BusinessModule"[];

ALTER TABLE "TenantSubscription" ALTER COLUMN "extraModules" DROP DEFAULT;
ALTER TABLE "TenantSubscription" ALTER COLUMN "extraModules" TYPE "BusinessModule"[] USING ("extraModules"::text[]::"BusinessModule"[]);
ALTER TABLE "TenantSubscription" ALTER COLUMN "extraModules" SET DEFAULT ARRAY[]::"BusinessModule"[];

ALTER TABLE "PlatformPayment" ALTER COLUMN "extraModules" DROP DEFAULT;
ALTER TABLE "PlatformPayment" ALTER COLUMN "extraModules" TYPE "BusinessModule"[] USING ("extraModules"::text[]::"BusinessModule"[]);
ALTER TABLE "PlatformPayment" ALTER COLUMN "extraModules" SET DEFAULT ARRAY[]::"BusinessModule"[];

DROP TYPE "BusinessModule_old";

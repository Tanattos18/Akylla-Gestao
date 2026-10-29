-- 2026-10-29: módulo ADS (gestão de anúncios) no catálogo de módulos avulsos
-- e liberado para a empresa da plataforma (slug "akylla-gestao"). Separada
-- da migration anterior porque o valor novo do enum só pode ser usado depois
-- do commit do ALTER TYPE ... ADD VALUE. Valor SUGERIDO: o dono edita no painel.
SET LOCAL app.rls_bypass = 'on';

INSERT INTO "ModuleOffer" ("module", "description", "priceMonthly", "sortOrder", "updatedAt") VALUES
  ('ADS', 'Gestão de anúncios: campanhas dos clientes, métricas e importação do Gerenciador de Anúncios', 49.90, 9, CURRENT_TIMESTAMP)
ON CONFLICT ("module") DO NOTHING;

-- Empresa da plataforma: módulo ativo e, se houver kit contratado, ADS como avulso
INSERT INTO "CompanyModule" ("id", "companyId", "module", "status", "createdAt", "updatedAt")
SELECT 'cmads_' || md5(c."id"), c."id", 'ADS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" c
WHERE c."slug" = 'akylla-gestao'
ON CONFLICT ("companyId", "module") DO UPDATE SET "status" = 'ACTIVE', "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "TenantSubscription" ts
SET "extraModules" = array_append(ts."extraModules", 'ADS'::"BusinessModule")
FROM "Company" c
WHERE ts."companyId" = c."id"
  AND c."slug" = 'akylla-gestao'
  AND NOT ('ADS'::"BusinessModule" = ANY(ts."extraModules"));

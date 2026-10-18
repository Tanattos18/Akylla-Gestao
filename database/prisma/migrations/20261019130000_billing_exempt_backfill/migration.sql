-- Fase 8 (auditoria): isenção explícita para empresas criadas pela CLI
-- (bootstrap do dono) e para as empresas de demonstração (slug demo-*).
-- Antes dependia de "sem assinatura e sem teste", que se perderia ao abrir
-- um checkout. DML em tabela com RLS FORCE.
SET LOCAL app.rls_bypass = 'on';

UPDATE "Company" c SET "billingExempt" = true
WHERE c."billingExempt" = false
  AND c."status" <> 'PENDING_VERIFICATION'
  AND (
    c."slug" LIKE 'demo-%'
    OR (c."trialEndsAt" IS NULL AND NOT EXISTS (SELECT 1 FROM "TenantSubscription" s WHERE s."companyId" = c."id"))
  );

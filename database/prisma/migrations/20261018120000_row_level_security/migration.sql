-- Fase 1 · 1E — RLS nativa do PostgreSQL (defesa em profundidade, ADR-0001)
--
-- Regra por linha: visível/gravável só quando, na transação corrente,
--   app.company_id = companyId da linha   (rota autenticada da API), ou
--   app.rls_bypass = 'on'                 (processo de sistema/rota pública).
-- Sem nenhum dos dois → nenhuma linha (fail-closed no banco).
--
-- FORCE: a política vale também para o dono das tabelas (o role da
-- aplicação). Roles com BYPASSRLS ou superusuário continuam ignorando a RLS
-- — em produção, a aplicação NÃO deve usar um deles.
--
-- Migrations futuras com DML (UPDATE/INSERT/DELETE de dados) devem começar
-- com: SET LOCAL app.rls_bypass = 'on';

ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Appointment"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CashMovement"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "CashSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CashSession"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Category"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Client"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "CompanyModule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyModule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CompanyModule"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "FinancialEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialEntry" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "FinancialEntry"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "ImportBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportBatch" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ImportBatch"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "LegalConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LegalConsent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "LegalConsent"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Pet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pet" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Pet"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Product"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Sale"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Service"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StockMovement"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Subscription"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "SubscriptionPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubscriptionPlan" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SubscriptionPlan"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Supplier"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "TenantSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantSubscription"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "User"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "WhatsAppConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WhatsAppConfig"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "WhatsAppConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppConsent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WhatsAppConsent"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "WhatsAppMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppMessage" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WhatsAppMessage"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "WhatsAppTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WhatsAppTemplate"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

ALTER TABLE "WhatsAppWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WhatsAppWebhookEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WhatsAppWebhookEvent"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- Company: em rota autenticada, só a própria empresa
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Company"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "id" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "id" = current_setting('app.company_id', true));

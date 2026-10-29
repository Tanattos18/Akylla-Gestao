-- 2026-10-29: gestão de anúncios — fase A1 (base manual) e A2 (importar CSV)
-- do upgrade/PLANO_ANUNCIOS.md. Só adiciona: nenhuma coluna ou tabela é
-- removida. A verba dos anúncios é paga pelo cliente direto à plataforma;
-- aqui ficam só referências, métricas e o histórico.

-- CreateEnum
CREATE TYPE "AdPlatform" AS ENUM ('META', 'GOOGLE', 'TIKTOK', 'OTHER');

-- CreateEnum
CREATE TYPE "AdObjective" AS ENUM ('MESSAGES', 'TRAFFIC', 'LEADS', 'SALES', 'PROFILE_VISITS', 'AWARENESS');

-- CreateEnum
CREATE TYPE "AdCampaignStatus" AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'ACTIVE', 'PAUSED', 'FINISHED');

-- CreateEnum
CREATE TYPE "AdMetricSource" AS ENUM ('MANUAL', 'CSV', 'API');

-- CreateEnum
CREATE TYPE "AdAccountConnection" AS ENUM ('MANUAL', 'API');

-- CreateEnum
CREATE TYPE "AdLogAction" AS ENUM ('CREATE', 'UPDATE', 'STATUS', 'METRIC', 'METRIC_FIX', 'CSV_IMPORT');

-- AlterEnum
ALTER TYPE "BusinessModule" ADD VALUE 'ADS';

-- AlterEnum
ALTER TYPE "DigitalProductType" ADD VALUE 'ADS_MANAGEMENT';

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "platform" "AdPlatform" NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "connection" "AdAccountConnection" NOT NULL DEFAULT 'MANUAL',
    "tokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "adAccountId" TEXT,
    "deliveryId" TEXT,
    "subscriptionId" TEXT,
    "platform" "AdPlatform" NOT NULL,
    "objective" "AdObjective" NOT NULL,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "promotedItem" TEXT NOT NULL,
    "targetUrl" TEXT,
    "utmCampaign" TEXT NOT NULL,
    "audienceNotes" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "totalBudget" DECIMAL(12,2),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "externalCampaignId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMetricDaily" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "AdMetricSource" NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "results" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdMetricDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaignLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "action" "AdLogAction" NOT NULL,
    "detail" JSONB,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCampaignLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdAccount_companyId_clientId_idx" ON "AdAccount"("companyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_companyId_platform_externalAccountId_key" ON "AdAccount"("companyId", "platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "AdCampaign_companyId_status_idx" ON "AdCampaign"("companyId", "status");

-- CreateIndex
CREATE INDEX "AdCampaign_companyId_clientId_idx" ON "AdCampaign"("companyId", "clientId");

-- CreateIndex
CREATE INDEX "AdCampaign_companyId_deliveryId_idx" ON "AdCampaign"("companyId", "deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_companyId_utmCampaign_key" ON "AdCampaign"("companyId", "utmCampaign");

-- CreateIndex
CREATE INDEX "AdMetricDaily_companyId_date_idx" ON "AdMetricDaily"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdMetricDaily_campaignId_date_source_key" ON "AdMetricDaily"("campaignId", "date", "source");

-- CreateIndex
CREATE INDEX "AdCampaignLog_companyId_campaignId_createdAt_idx" ON "AdCampaignLog"("companyId", "campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ClientDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetricDaily" ADD CONSTRAINT "AdMetricDaily_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMetricDaily" ADD CONSTRAINT "AdMetricDaily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaignLog" ADD CONSTRAINT "AdCampaignLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaignLog" ADD CONSTRAINT "AdCampaignLog_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaignLog" ADD CONSTRAINT "AdCampaignLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- RLS (ADR-0001)
ALTER TABLE "AdAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AdAccount"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- RLS (ADR-0001)
ALTER TABLE "AdCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdCampaign" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AdCampaign"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- RLS (ADR-0001)
ALTER TABLE "AdMetricDaily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdMetricDaily" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AdMetricDaily"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- RLS (ADR-0001)
ALTER TABLE "AdCampaignLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdCampaignLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AdCampaignLog"
  USING (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "companyId" = current_setting('app.company_id', true));

-- Histórico imutável: nenhuma linha do log de campanha pode ser alterada
CREATE FUNCTION "ad_campaign_log_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdCampaignLog é imutável: registre um novo lançamento';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AdCampaignLog_no_update"
  BEFORE UPDATE ON "AdCampaignLog"
  FOR EACH ROW EXECUTE FUNCTION "ad_campaign_log_immutable"();

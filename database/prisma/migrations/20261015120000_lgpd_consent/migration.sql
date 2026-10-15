-- CreateEnum
CREATE TYPE "LegalConsentType" AS ENUM ('TERMS', 'PRIVACY', 'DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "LegalConsentRole" AS ENUM ('USER', 'CLIENT');

-- CreateTable
CREATE TABLE "LegalConsent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "role" "LegalConsentRole" NOT NULL,
    "type" "LegalConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "LegalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalConsent_companyId_acceptedAt_idx" ON "LegalConsent"("companyId", "acceptedAt");

-- CreateIndex
CREATE INDEX "LegalConsent_userId_idx" ON "LegalConsent"("userId");

-- CreateIndex
CREATE INDEX "LegalConsent_clientId_idx" ON "LegalConsent"("clientId");

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalConsent" ADD CONSTRAINT "LegalConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

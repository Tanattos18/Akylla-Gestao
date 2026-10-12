-- CreateEnum
CREATE TYPE "BusinessModule" AS ENUM ('PETS', 'APPOINTMENTS', 'SERVICES', 'WHATSAPP', 'SUBSCRIPTIONS');

-- CreateEnum
CREATE TYPE "CompanyModuleStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "CompanyModule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "module" "BusinessModule" NOT NULL,
    "status" "CompanyModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyModule_companyId_idx" ON "CompanyModule"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyModule_companyId_module_key" ON "CompanyModule"("companyId", "module");

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

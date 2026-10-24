-- 2026-10-24: chave Pix da empresa para as mensagens de cobrança e origem
-- CONTRACT_BILLING das mensagens de WhatsApp. Só adiciona.

-- AlterEnum
ALTER TYPE "WhatsAppMessageOrigin" ADD VALUE 'CONTRACT_BILLING';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "pixKey" TEXT;


-- Auditoria (bloco 4): parcela de crediário já paga e devolvida no
-- cancelamento da venda fica REFUNDED — não pode ser estornada de novo
-- (antes o dinheiro saía do caixa duas vezes).
ALTER TYPE "CreditInstallmentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';
ALTER TABLE "CreditInstallment" ADD COLUMN "refundedAt" TIMESTAMP(3);

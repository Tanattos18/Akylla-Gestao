-- Fase 7 · 7.1 — dados da empresa para o comprovante (aditiva; Company já tem RLS)
ALTER TABLE "Company" ADD COLUMN "address" TEXT,
ADD COLUMN "document" TEXT,
ADD COLUMN "phone" TEXT;

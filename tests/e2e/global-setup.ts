import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

/**
 * Cria uma empresa nova por execução, com administrador e senha aleatória
 * (nunca gravada). Os testes leem E2E_EMAIL/E2E_PASSWORD do ambiente.
 * Processo de sistema: conecta ignorando o RLS (regra do AGENTS.md).
 */
export default async function globalSetup(): Promise<void> {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL não definida para o E2E");
  const url = new URL(raw);
  url.searchParams.set("options", "-c app.rls_bypass=on");
  const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });

  const stamp = Date.now().toString(36);
  const email = `e2e-${stamp}@exemplo.test`;
  const password = randomBytes(18).toString("base64url");
  try {
    await prisma.company.create({
      data: {
        name: `Loja E2E ${stamp}`,
        slug: `e2e-${stamp}`,
        onboardingCompletedAt: new Date(),
        users: {
          create: { name: "Admin E2E", email, passwordHash: await bcrypt.hash(password, 10), role: "ADMIN" },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
  process.env.E2E_EMAIL = email;
  process.env.E2E_PASSWORD = password;
  process.env.E2E_COMPANY = `Loja E2E ${stamp}`;
}

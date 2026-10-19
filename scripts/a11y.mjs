#!/usr/bin/env node
/**
 * Auditoria de acessibilidade (Fase 5 · 5.4): abre as telas principais num
 * Chromium sem interface e roda o axe-core (WCAG 2.1 A/AA). Falha se houver
 * violação "serious" ou "critical".
 *
 * Pré-requisitos: web (3000) e API (3001) no ar e DATABASE_URL do mesmo
 * banco da API. Cria/atualiza uma empresa de auditoria com senha aleatória
 * por execução (não fica gravada em lugar nenhum).
 *
 * Uso: npm run test:a11y   (A11Y_BASE_URL, padrão http://localhost:3000)
 */
import { randomBytes } from "node:crypto";
import { URL } from "node:url";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import "dotenv/config";

const BASE_URL = process.env.A11Y_BASE_URL ?? "http://localhost:3000";
const BLOCKING = new Set(["serious", "critical"]);

const PUBLIC_PAGES = ["/login", "/cadastro", "/redefinir-senha", "/para/comercio", "/termos", "/privacidade"];
const APP_PAGES = [
  "/",
  "/dashboard",
  "/onboarding",
  "/configuracoes",
  "/pdv",
  "/vendas",
  "/caixa",
  "/financeiro",
  "/produtos",
  "/produtos/novo",
  "/categorias",
  "/fornecedores",
  "/clientes",
  "/servicos",
  "/agenda",
  "/profissionais",
  "/comissoes",
  "/comissoes/regras",
  "/crediario",
  "/os",
  "/os/nova",
  "/fiscal",
  "/relatorios",
  "/whatsapp",
  "/assinaturas",
  "/usuarios",
  "/faturamento",
  "/planos",
  "/importacoes",
];

function systemUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL não definida");
  const url = new URL(raw);
  // Script de sistema: ignora o RLS (mesma regra do worker/CLI)
  url.searchParams.set("options", "-c app.rls_bypass=on");
  return url.toString();
}

async function ensureAuditAccount() {
  const prisma = new PrismaClient({ datasources: { db: { url: systemUrl() } } });
  const email = "auditoria-a11y@exemplo.test";
  const password = randomBytes(18).toString("base64url");
  try {
    const company = await prisma.company.upsert({
      where: { slug: "auditoria-a11y" },
      create: { name: "Auditoria de acessibilidade", slug: "auditoria-a11y", onboardingCompletedAt: new Date() },
      update: { status: "ACTIVE" },
    });
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { companyId_email: { companyId: company.id, email } },
      create: { companyId: company.id, name: "Auditoria", email, passwordHash, role: "ADMIN" },
      update: { passwordHash, role: "ADMIN", status: "ACTIVE" },
    });
    return { email, password };
  } finally {
    await prisma.$disconnect();
  }
}

function describe(violation) {
  const targets = violation.nodes
    .slice(0, 3)
    .map((node) => node.target.join(" "))
    .join(" | ");
  return `  [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length}x) → ${targets}`;
}

async function audit(page, path) {
  await page.goto(new URL(path, BASE_URL).toString(), { waitUntil: "networkidle" });
  // Telas cliente: espera o conteúdo principal sair do "Carregando..."
  await page.waitForTimeout(500);
  // O axe calcula errado o fundo de elementos "sticky" (a barra do topo é
  // escura, mas ele lê o fundo da página). Só a posição muda; as cores não.
  await page.addStyleTag({ content: "header { position: static !important; }" });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations;
}

async function main() {
  const account = await ensureAuditAccount();
  const browser = await chromium.launch(
    process.env.A11Y_BROWSER_CHANNEL ? { channel: process.env.A11Y_BROWSER_CHANNEL } : {},
  );
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  let blocking = 0;
  let total = 0;

  try {
    for (const path of PUBLIC_PAGES) {
      const violations = await audit(page, path);
      total += violations.length;
      blocking += violations.filter((v) => BLOCKING.has(v.impact)).length;
      console.log(`${violations.length ? "✖" : "✔"} ${path}`);
      violations.forEach((v) => console.log(describe(v)));
    }

    const login = await context.request.post(new URL("/api/auth/login", BASE_URL).toString(), {
      data: account,
    });
    if (!login.ok()) throw new Error(`Login da auditoria falhou: HTTP ${login.status()}`);

    for (const path of APP_PAGES) {
      const violations = await audit(page, path);
      total += violations.length;
      blocking += violations.filter((v) => BLOCKING.has(v.impact)).length;
      console.log(`${violations.length ? "✖" : "✔"} ${path}`);
      violations.forEach((v) => console.log(describe(v)));
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${total} violação(ões) no total; ${blocking} grave(s)/crítica(s).`);
  if (blocking > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

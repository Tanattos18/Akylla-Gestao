#!/usr/bin/env node
/**
 * Script para configurar ambiente de desenvolvimento local
 * Uso: npm run setup:dev
 */

import { execSync } from "node:child_process";
import { existsSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envExample = resolve(rootDir, ".env.example");
const envFile = resolve(rootDir, ".env");

console.log("🔧 Configurando ambiente de desenvolvimento...\n");

if (!existsSync(envFile)) {
  if (!existsSync(envExample)) {
    console.error("❌ Arquivo .env.example não encontrado");
    process.exit(1);
  }
  copyFileSync(envExample, envFile);
  console.log("✅ Arquivo .env criado a partir de .env.example");
} else {
  console.log("ℹ️  Arquivo .env já existe, pulando...");
}

console.log("\n📦 Instalando dependências...");
try {
  execSync("npm ci", { stdio: "inherit", cwd: rootDir });
  console.log("✅ Dependências instaladas");
} catch {
  console.error("❌ Falha ao instalar dependências");
  process.exit(1);
}

console.log("\n🗄️  Gerando Prisma Client...");
try {
  execSync("npm run db:generate", { stdio: "inherit", cwd: rootDir });
  console.log("✅ Prisma Client gerado");
} catch {
  console.error("❌ Falha ao gerar Prisma Client");
  process.exit(1);
}

console.log("\n🔄 Aplicando migrations...");
try {
  execSync("npm run db:migrate", { stdio: "inherit", cwd: rootDir });
  console.log("✅ Migrations aplicadas");
} catch {
  console.error("❌ Falha ao aplicar migrations");
  process.exit(1);
}

console.log("\n🌱 Criando seed de demonstração...");
try {
  execSync("npm run bootstrap:admin", { stdio: "inherit", cwd: rootDir });
  console.log("✅ Seed criado (empresa + admin)");
} catch {
  console.error("⚠️  Seed pode já existir (bootstrap:admin é idempotente)");
}

console.log("\n✨ Ambiente pronto!");
console.log("   Execute: npm run dev:api  (terminal 1)");
console.log("   Execute: npm run dev:web  (terminal 2)");
console.log("   Execute: npm run dev:worker (terminal 3, opcional)");
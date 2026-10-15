#!/usr/bin/env node
/**
 * Gate de consistência de migrations (N1 — 3.2).
 * Verifica se as migrations versionadas refletem o schema Prisma atual.
 * Um diff não-vazio indica drift: o schema mudou sem migration correspondente
 * (ou a migration não foi aplicada) — falha a verificação.
 *
 * Uso: node scripts/check-migrations.mjs
 * Exit code 0 = sem drift; 1 = há drift entre migrations e schema.
 */

import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = "database/prisma/schema.prisma";
const migrationsDir = "database/prisma/migrations";

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    console.error(`Falha ao executar ${cmd}:`, error.stderr?.toString?.() ?? error.message);
    process.exit(1);
  }
}

console.log("🔍 Verificando consistência entre migrations e schema...");
const diff = run("npx", [
  "prisma",
  "migrate",
  "diff",
  "--from-migrations",
  migrationsDir,
  "--to-schema-datamodel",
  schema,
  "--script",
]);

if (diff.trim().length > 0) {
  console.error("❌ Drift detectado entre migrations e schema Prisma:");
  console.error(diff.trim());
  console.error("\nGere uma migration com `npm run db:migrate -- --name <nome>` antes de prosseguir.");
  process.exit(1);
}

console.log("✅ Migrations e schema estão consistentes.");

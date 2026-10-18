#!/usr/bin/env node
/**
 * Gate de consistência de migrations (N1 — 3.2; corrigido na Fase 1 · 1G).
 * Verifica se as migrations versionadas refletem o schema Prisma atual.
 * Um diff não-vazio indica drift: o schema mudou sem migration correspondente.
 *
 * Uso: node scripts/check-migrations.mjs   (requer DATABASE_URL)
 * Exit code 0 = sem drift; 1 = drift ou falha.
 *
 * `migrate diff --from-migrations` exige um banco "shadow" descartável, onde
 * o Prisma aplica as migrations do zero. O script cria `<banco>_shadow` no
 * mesmo servidor (role com CREATEDB), compara com `--exit-code` e o remove.
 * A versão anterior não passava o shadow e usava `--script` (cuja saída
 * nunca é vazia), então falhava sempre.
 */

import "dotenv/config";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schema = "database/prisma/schema.prisma";
const migrationsDir = "database/prisma/migrations";
const prismaCli = join(rootDir, "node_modules", "prisma", "build", "index.js");

function prisma(args, input) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: rootDir,
    encoding: "utf8",
    input,
    stdio: [input ? "pipe" : "ignore", "pipe", "pipe"],
  });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL não definida.");
  process.exit(1);
}

const base = new URL(databaseUrl);
const shadowName = `${decodeURIComponent(base.pathname.slice(1)) || "postgres"}_shadow`;
const shadow = new URL(base);
shadow.pathname = `/${shadowName}`;
const maintenance = new URL(base);
maintenance.pathname = "/postgres";
maintenance.searchParams.delete("schema");

function sql(statement) {
  return prisma(["db", "execute", "--url", maintenance.toString(), "--stdin"], statement);
}

console.log("🔍 Verificando consistência entre migrations e schema...");
sql(`DROP DATABASE IF EXISTS "${shadowName}";`);
const created = sql(`CREATE DATABASE "${shadowName}";`);
if (created.status !== 0) {
  console.error("❌ Não foi possível criar o banco shadow (o role precisa de CREATEDB):");
  console.error((created.stderr || created.stdout).trim());
  process.exit(1);
}

let exitCode = 1;
try {
  const diff = prisma([
    "migrate",
    "diff",
    "--from-migrations",
    migrationsDir,
    "--to-schema-datamodel",
    schema,
    "--shadow-database-url",
    shadow.toString(),
    "--exit-code",
  ]);
  if (diff.status === 0) {
    console.log("✅ Migrations e schema estão consistentes.");
    exitCode = 0;
  } else if (diff.status === 2) {
    console.error("❌ Drift detectado entre migrations e schema Prisma:");
    console.error(diff.stdout.trim());
    console.error("\nGere uma migration com `npm run db:migrate -- --name <nome>` antes de prosseguir.");
  } else {
    console.error("❌ Falha ao comparar migrations e schema:");
    console.error((diff.stderr || diff.stdout).trim());
  }
} finally {
  sql(`DROP DATABASE IF EXISTS "${shadowName}";`);
}
process.exit(exitCode);

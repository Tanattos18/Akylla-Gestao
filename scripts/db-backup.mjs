#!/usr/bin/env node
/**
 * Backup e restauração do banco de dados (N1 — L8).
 *
 * Uso:
 *   npm run db:backup                # gera um dump (formato custom) em backup/
 *   npm run db:backup -- --retain=30 # define retenção em dias (padrão 30)
 *   npm run db:restore -- <arquivo>  # restaura o dump no banco apontado por DATABASE_URL
 *   npm run db:restore:test          # gera dump, restaura em banco efêmero e valida
 *
 * Regras:
 *   - Nunca grava valores sensíveis em arquivos versionados (o dump fica em
 *     backup/, ignorado pelo .gitignore).
 *   - Requer o binário pg_dump / pg_restore no PATH (ou PG_DUMP / PG_RESTORE).
 *   - O dump usa formato custom (-Fc) e compressão 6.
 */

import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backupDir = resolve(rootDir, "backup");
const args = process.argv.slice(2);
const command = args[0];

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL não definida. Configure o .env antes de rodar o script.");
    process.exit(1);
  }
  return url;
}

function run(cmd, argsList) {
  try {
    return execFileSync(cmd, argsList, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    console.error(`Falha ao executar ${cmd}:`, error.stderr?.toString?.() ?? error.message);
    process.exit(1);
  }
}

function dumpFileFor(date = new Date()) {
  const stamp = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return join(backupDir, `akylla_${stamp}.dump`);
}

function purgeOld(retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 3600_000;
  for (const file of readdirSync(backupDir)) {
    if (!file.endsWith(".dump")) continue;
    const full = join(backupDir, file);
    if (statSync(full).mtimeMs < cutoff) {
      unlinkSync(full);
      console.log(`🗑️  Retenção: removido ${file}`);
    }
  }
}

const commands = {
  backup: () => {
    const url = requireDatabaseUrl();
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

    const retain = Number.parseInt(
      args[args.indexOf("--retain") + 1] ?? "30",
      10,
    );
    const pgDump = process.env.PG_DUMP ?? "pg_dump";
    const file = dumpFileFor();

    console.log(`🔄 Gerando backup em ${file}...`);
    run(pgDump, [url, "--format=custom", "--compress=6", "--file", file]);
    console.log("✅ Backup gerado.");
    purgeOld(Number.isFinite(retain) ? retain : 30);
  },

  restore: () => {
    const url = requireDatabaseUrl();
    const file = args[1];
    if (!file || !existsSync(file)) {
      console.error("Informe o arquivo de dump: npm run db:restore -- <arquivo>");
      process.exit(1);
    }
    const pgRestore = process.env.PG_RESTORE ?? "pg_restore";
    console.log(`🔄 Restaurando ${file}...`);
    run(pgRestore, ["--dbname", url, "--no-owner", "--no-privileges", file]);
    console.log("✅ Restauração concluída.");
  },

  "restore:test": () => {
    const url = requireDatabaseUrl();
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

    const pgDump = process.env.PG_DUMP ?? "pg_dump";
    const pgRestore = process.env.PG_RESTORE ?? "pg_restore";
    const file = dumpFileFor();
    const ephemeralUrl = url.replace(/\/([^/?]+)(\?|$)/, "/akylla_restore_test$2");

    console.log(`🔄 Gerando backup em ${file}...`);
    run(pgDump, [url, "--format=custom", "--compress=6", "--file", file]);

    console.log("🧪 Restaurando em banco efêmero para validar...");
    try {
      run("createdb", ["akylla_restore_test"]);
    } catch {
      // banco pode já existir — seguimos
    }
    run(pgRestore, ["--dbname", ephemeralUrl, "--no-owner", "--no-privileges", file]);

    console.log("🧪 Validando schema com Prisma...");
    execSync("npm run db:validate", { stdio: "inherit", cwd: rootDir });

    console.log("🧹 Removendo banco efêmero...");
    try {
      run("dropdb", ["akylla_restore_test"]);
    } catch {
      // best effort
    }
    console.log("✅ Restore testado com sucesso.");
  },

  help: () => {
    console.log(`
Uso: npm run db:backup|db:restore|db:restore:test

  db:backup                - gera dump custom + retenção (padrão 30 dias)
  db:backup -- --retain=7  - retenção de 7 dias
  db:restore -- <arquivo>  - restaura um dump no banco de DATABASE_URL
  db:restore:test          - gera dump, restaura em banco efêmero e valida
`);
  },
};

if (commands[command]) {
  commands[command]();
} else {
  commands.help();
  process.exit(1);
}

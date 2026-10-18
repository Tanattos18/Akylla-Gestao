#!/usr/bin/env node
/**
 * Backup e restauração do banco de dados (N1 — L8 · Fase 1 §1.1).
 *
 * Uso:
 *   npm run db:backup                   # dump + retenção + restore testado em banco efêmero
 *   npm run db:backup -- --retain=7     # retenção em dias (padrão RETENTION_DAYS ou 30)
 *   npm run db:backup -- --skip-verify  # só o dump (sem restore de teste)
 *   npm run db:restore-test [-- <arq>]  # só o teste de restore (padrão: dump mais recente)
 *   npm run db:restore -- <arquivo>     # restaura o dump no banco de DATABASE_URL
 *
 * Variáveis de ambiente:
 *   DATABASE_URL     banco de origem (formato Prisma; parâmetros só do Prisma são removidos)
 *   BACKUP_DIR       diretório dos dumps (padrão: backup/, ignorado pelo Git)
 *   RETENTION_DAYS   dias de retenção (padrão 30)
 *   RESTORE_TEST_DB  nome do banco efêmero (padrão akylla_restore_test)
 *   PG_BIN           diretório dos binários do PostgreSQL (opcional; no Windows
 *                    detecta C:\Program Files\PostgreSQL\<versão>\bin)
 *
 * Regras:
 *   - A senha nunca vai na linha de comando: é passada por PGPASSWORD.
 *   - Validação do restore: contagem de linhas de todas as tabelas igual à
 *     origem, mesmas migrations aplicadas e `prisma migrate diff` sem
 *     diferenças entre o banco restaurado e o schema.prisma.
 *   - O banco efêmero é sempre removido, com sucesso ou falha.
 *   - Log em <BACKUP_DIR>/backup.log; exit code != 0 em qualquer falha.
 */

import "dotenv/config";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { URL, fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = join(rootDir, "database", "prisma", "schema.prisma");
const backupDir = process.env.BACKUP_DIR
  ? isAbsolute(process.env.BACKUP_DIR)
    ? process.env.BACKUP_DIR
    : resolve(rootDir, process.env.BACKUP_DIR)
  : resolve(rootDir, "backup");
const restoreDbName = process.env.RESTORE_TEST_DB ?? "akylla_restore_test";
const args = process.argv.slice(2);
const command = args[0];

/** Parâmetros de query que só o Prisma entende (o libpq rejeita). */
const PRISMA_ONLY_PARAMS = [
  "schema",
  "connection_limit",
  "pool_timeout",
  "pgbouncer",
  "statement_cache_size",
  "socket_timeout",
];

class BackupError extends Error {}

function log(message) {
  console.log(message);
  try {
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    appendFileSync(join(backupDir, "backup.log"), `${new Date().toISOString()} ${message}\n`);
  } catch {
    // log em arquivo é best effort; o console já registrou
  }
}

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new BackupError("DATABASE_URL não definida. Configure o .env antes de rodar o script.");
  }
  return url;
}

/**
 * Converte a URL do Prisma em parâmetros libpq: remove a senha (vai por
 * PGPASSWORD) e os parâmetros exclusivos do Prisma.
 */
function toLibpq(prismaUrl, database) {
  const url = new URL(prismaUrl);
  const password = decodeURIComponent(url.password);
  url.password = "";
  if (database) url.pathname = `/${database}`;
  for (const param of PRISMA_ONLY_PARAMS) url.searchParams.delete(param);
  return { conn: url.toString(), password, database: decodeURIComponent(url.pathname.slice(1)) };
}

/** URL no formato Prisma apontando para outro banco (mantém a senha). */
function prismaUrlFor(prismaUrl, database) {
  const url = new URL(prismaUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function pgBinDir() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  if (process.platform !== "win32") return null;
  const base = "C:\\Program Files\\PostgreSQL";
  if (!existsSync(base)) return null;
  const versions = readdirSync(base)
    .filter((v) => /^\d+$/.test(v) && existsSync(join(base, v, "bin", "pg_dump.exe")))
    .sort((a, b) => Number(b) - Number(a));
  return versions.length > 0 ? join(base, versions[0], "bin") : null;
}

function tool(name) {
  const dir = pgBinDir();
  if (!dir) return name;
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  return join(dir, exe);
}

function run(cmd, argsList, { password, allowFail = false } = {}) {
  const result = spawnSync(cmd, argsList, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...(password ? { PGPASSWORD: password } : {}) },
    cwd: rootDir,
  });
  if (result.error) {
    throw new BackupError(`Falha ao executar ${cmd}: ${result.error.message}`);
  }
  if (result.status !== 0 && !allowFail) {
    const stderr = (result.stderr ?? "").trim().split("\n").slice(-5).join("\n");
    throw new BackupError(`${cmd} terminou com código ${result.status}: ${stderr}`);
  }
  return result;
}

function psql(target, sql) {
  const result = run(tool("psql"), ["--no-psqlrc", "-tAX", "-v", "ON_ERROR_STOP=1", "-c", sql, target.conn], {
    password: target.password,
  });
  return result.stdout.trim();
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dumpFileFor(date = new Date()) {
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
  let file = join(backupDir, `akylla_${stamp}.dump`);
  // Dois backups no mesmo minuto não se sobrescrevem
  for (let i = 2; existsSync(file); i += 1) {
    file = join(backupDir, `akylla_${stamp}_${i}.dump`);
  }
  return file;
}

function parseRetention() {
  const inline = args.find((a) => a.startsWith("--retain="));
  const index = args.indexOf("--retain");
  const raw = inline
    ? inline.split("=")[1]
    : index >= 0
      ? args[index + 1]
      : process.env.RETENTION_DAYS ?? "30";
  const days = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(days) || days < 1) {
    throw new BackupError(`Retenção inválida: "${raw}" (use um inteiro >= 1).`);
  }
  return days;
}

function purgeOld(retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 3600_000;
  for (const file of readdirSync(backupDir)) {
    if (!file.endsWith(".dump")) continue;
    const full = join(backupDir, file);
    if (statSync(full).mtimeMs < cutoff) {
      unlinkSync(full);
      log(`🗑️  Retenção (${retentionDays} dias): removido ${file}`);
    }
  }
}

function latestDump() {
  if (!existsSync(backupDir)) return null;
  const dumps = readdirSync(backupDir)
    .filter((f) => f.endsWith(".dump"))
    .map((f) => ({ f, t: statSync(join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return dumps.length > 0 ? join(backupDir, dumps[0].f) : null;
}

function dump(source) {
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const file = dumpFileFor();
  log(`🔄 Gerando backup de "${source.database}" em ${file}...`);
  run(tool("pg_dump"), [source.conn, "--format=custom", "--compress=6", "--no-owner", "--file", file], {
    password: source.password,
  });
  log(`✅ Backup gerado (${statSync(file).size} bytes).`);
  return file;
}

const COUNT_SQL = `
  SELECT string_agg(format('%s=%s', table_name,
    (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text),
    ';' ORDER BY table_name)
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;

const MIGRATIONS_SQL = `SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;

function verifyRestore(file, prismaSourceUrl) {
  const source = toLibpq(prismaSourceUrl);
  if (source.database === restoreDbName) {
    throw new BackupError(`O banco efêmero (${restoreDbName}) não pode ser o banco de origem.`);
  }
  const target = toLibpq(prismaSourceUrl, restoreDbName);
  const maintenance = toLibpq(prismaSourceUrl, "postgres");
  const dropArgs = ["--if-exists", `--maintenance-db=${maintenance.conn}`, restoreDbName];

  log(`🧪 Restaurando ${file} no banco efêmero "${restoreDbName}"...`);
  run(tool("dropdb"), dropArgs, { password: maintenance.password });
  run(tool("createdb"), [`--maintenance-db=${maintenance.conn}`, restoreDbName], {
    password: maintenance.password,
  });
  try {
    run(tool("pg_restore"), ["--dbname", target.conn, "--no-owner", "--no-privileges", "--exit-on-error", file], {
      password: target.password,
    });

    log("🧪 Conferindo contagem de linhas e migrations...");
    const sourceCounts = psql(source, COUNT_SQL);
    const restoredCounts = psql(target, COUNT_SQL);
    if (!restoredCounts || sourceCounts !== restoredCounts) {
      throw new BackupError("Contagem de linhas do banco restaurado difere da origem.");
    }
    const sourceMigrations = psql(source, MIGRATIONS_SQL);
    const restoredMigrations = psql(target, MIGRATIONS_SQL);
    if (sourceMigrations !== restoredMigrations) {
      throw new BackupError(
        `Migrations divergentes: origem=${sourceMigrations}, restaurado=${restoredMigrations}.`,
      );
    }

    log("🧪 Validando schema restaurado contra schema.prisma (prisma migrate diff)...");
    // Chama o CLI do Prisma pelo próprio Node: evita shell (caminhos com
    // espaço no Windows) e a restrição de spawn de .cmd.
    const prismaCli = join(rootDir, "node_modules", "prisma", "build", "index.js");
    const diff = spawnSync(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "diff",
        "--from-url",
        prismaUrlFor(prismaSourceUrl, restoreDbName),
        "--to-schema-datamodel",
        schemaPath,
        "--exit-code",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: rootDir },
    );
    if (diff.status !== 0) {
      throw new BackupError(
        diff.status === 2
          ? "Schema restaurado difere do schema.prisma (prisma migrate diff)."
          : `prisma migrate diff falhou (código ${diff.status}): ${(diff.stderr ?? diff.error?.message ?? "").trim().split("\n").slice(-3).join(" ")}`,
      );
    }
    const tables = restoredCounts.split(";").length;
    log(`✅ Restore testado com sucesso: ${tables} tabelas, ${restoredMigrations} migrations.`);
  } finally {
    try {
      run(tool("dropdb"), dropArgs, { password: maintenance.password });
      log(`🧹 Banco efêmero "${restoreDbName}" removido.`);
    } catch (error) {
      log(`⚠️  Não foi possível remover "${restoreDbName}": ${error.message}`);
    }
  }
}

const commands = {
  backup: () => {
    const url = requireDatabaseUrl();
    const retention = parseRetention();
    const file = dump(toLibpq(url));
    purgeOld(retention);
    if (!args.includes("--skip-verify")) verifyRestore(file, url);
  },

  "restore-test": () => {
    const url = requireDatabaseUrl();
    const file = args[1] && !args[1].startsWith("--") ? resolve(args[1]) : latestDump();
    if (!file || !existsSync(file)) {
      throw new BackupError("Nenhum dump encontrado. Rode npm run db:backup ou informe o arquivo.");
    }
    verifyRestore(file, url);
  },

  restore: () => {
    const url = requireDatabaseUrl();
    const file = args[1];
    if (!file || !existsSync(file)) {
      throw new BackupError("Informe o arquivo de dump: npm run db:restore -- <arquivo>");
    }
    const target = toLibpq(url);
    log(`🔄 Restaurando ${file} em "${target.database}"...`);
    run(tool("pg_restore"), ["--dbname", target.conn, "--no-owner", "--no-privileges", "--exit-on-error", file], {
      password: target.password,
    });
    log("✅ Restauração concluída.");
  },

  help: () => {
    console.log(`
Uso: npm run db:backup | db:restore-test | db:restore

  db:backup                  - dump custom + retenção + restore testado em banco efêmero
  db:backup -- --retain=7    - retenção de 7 dias (padrão RETENTION_DAYS ou 30)
  db:backup -- --skip-verify - só o dump
  db:restore-test [-- <arq>] - só o teste de restore (padrão: dump mais recente)
  db:restore -- <arquivo>    - restaura um dump no banco de DATABASE_URL
`);
  },
};

// "restore:test" mantido por compatibilidade com o nome anterior
const aliases = { "restore:test": "restore-test" };
const handler = commands[aliases[command] ?? command];

if (!handler) {
  commands.help();
  process.exit(1);
}

try {
  handler();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log(`❌ ${message}`);
  process.exit(1);
}

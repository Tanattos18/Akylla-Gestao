import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Fase 1 §1.1 — backup automatizado com restore testado.
 *
 * Roda o script real (scripts/db-backup.mjs) contra o banco de teste. Exige
 * os binários do PostgreSQL (pg_dump/pg_restore/psql/createdb/dropdb) na
 * mesma versão major do servidor; sem eles a suíte é pulada com aviso.
 */

const rootDir = resolve(__dirname, "..", "..");
const script = join(rootDir, "scripts", "db-backup.mjs");
const RESTORE_DB = "akylla_restore_vitest";

let backupDir: string;
let prisma: PrismaClient;

function pgDumpCandidate(): string {
  if (process.env.PG_BIN) return join(process.env.PG_BIN, "pg_dump");
  const base = "C:\\Program Files\\PostgreSQL";
  if (process.platform === "win32" && existsSync(base)) {
    const versions = readdirSync(base)
      .filter((v) => /^\d+$/.test(v))
      .sort((a, b) => Number(b) - Number(a));
    if (versions[0]) return join(base, versions[0], "bin", "pg_dump.exe");
  }
  return "pg_dump";
}

function pgDumpMajor(): number | null {
  const result = spawnSync(pgDumpCandidate(), ["--version"], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const match = /(\d+)\.\d+/.exec(result.stdout);
  return match ? Number(match[1]) : null;
}

function runScript(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: "utf8",
    cwd: rootDir,
    env: {
      ...process.env,
      BACKUP_DIR: backupDir,
      RESTORE_TEST_DB: RESTORE_DB,
      ...extraEnv,
    },
    timeout: 120_000,
  });
}

async function databaseExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM pg_database WHERE datname = ${name}`;
  return Number(rows[0]?.n ?? 0) > 0;
}

const toolMajor = pgDumpMajor();
let serverMajor = 0;

beforeAll(async () => {
  backupDir = mkdtempSync(join(tmpdir(), "akylla-backup-"));
  prisma = new PrismaClient();
  const rows = await prisma.$queryRaw<{ v: string }[]>`SELECT current_setting('server_version_num') AS v`;
  serverMajor = Math.floor(Number(rows[0]?.v ?? 0) / 10000);
  if (toolMajor === null || toolMajor < serverMajor) {
    console.warn(
      `[backup.test] pulado: pg_dump ${toolMajor ?? "ausente"} incompatível com o servidor ${serverMajor}.`,
    );
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(backupDir, { recursive: true, force: true });
});

function toolsReady(): boolean {
  return toolMajor !== null && toolMajor >= serverMajor;
}

describe("Backup do banco (scripts/db-backup.mjs)", () => {
  it("db:backup gera dump nomeado, restaura em banco efêmero, valida e remove o efêmero", async (ctx) => {
    if (!toolsReady()) ctx.skip();

    const result = runScript(["backup"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);

    const dumps = readdirSync(backupDir).filter((f) => f.endsWith(".dump"));
    expect(dumps).toHaveLength(1);
    expect(dumps[0]).toMatch(/^akylla_\d{4}-\d{2}-\d{2}_\d{4}\.dump$/);

    const log = readFileSync(join(backupDir, "backup.log"), "utf8");
    expect(log).toContain("Backup gerado");
    expect(log).toContain("Restore testado com sucesso");
    expect(await databaseExists(RESTORE_DB)).toBe(false);
  });

  it("não expõe a senha do banco no log", (ctx) => {
    if (!toolsReady()) ctx.skip();

    const password = decodeURIComponent(new URL(process.env.DATABASE_URL ?? "").password);
    const log = readFileSync(join(backupDir, "backup.log"), "utf8");
    if (password) expect(log).not.toContain(password);
  });

  it("dois backups no mesmo minuto não se sobrescrevem", (ctx) => {
    if (!toolsReady()) ctx.skip();

    const result = runScript(["backup", "--skip-verify"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readdirSync(backupDir).filter((f) => f.endsWith(".dump")).length).toBeGreaterThanOrEqual(2);
  });

  it("retenção remove dumps mais antigos que --retain e preserva os recentes", (ctx) => {
    if (!toolsReady()) ctx.skip();

    const old = join(backupDir, "akylla_2000-01-01_0000.dump");
    writeFileSync(old, "antigo");
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600_000);
    utimesSync(old, tenDaysAgo, tenDaysAgo);
    const before = readdirSync(backupDir).filter((f) => f.endsWith(".dump")).length;

    const result = runScript(["backup", "--skip-verify", "--retain=7"]);
    expect(result.status, result.stdout + result.stderr).toBe(0);

    expect(existsSync(old)).toBe(false);
    // removeu 1 antigo e criou 1 novo
    expect(readdirSync(backupDir).filter((f) => f.endsWith(".dump")).length).toBe(before);
  });

  it("db:restore-test com dump corrompido falha (exit != 0) e remove o banco efêmero", async (ctx) => {
    if (!toolsReady()) ctx.skip();

    const corrupt = join(backupDir, "corrompido.dump");
    writeFileSync(corrupt, "isto não é um dump do pg_dump");

    const result = runScript(["restore-test", corrupt]);
    expect(result.status).not.toBe(0);
    expect(readFileSync(join(backupDir, "backup.log"), "utf8")).toContain("❌");
    expect(await databaseExists(RESTORE_DB)).toBe(false);
  });

  it("recusa retenção inválida", () => {
    const result = runScript(["backup", "--retain=0"]);
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("Retenção inválida");
  });

  it("falha com mensagem clara sem DATABASE_URL", () => {
    const result = runScript(["backup"], { DATABASE_URL: "" });
    expect(result.status).not.toBe(0);
    expect(result.stdout).toContain("DATABASE_URL não definida");
  });
});

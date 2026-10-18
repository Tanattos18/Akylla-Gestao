import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { createTestApp, resetDatabase } from "../helpers/app";
import type { PrismaService } from "../../apps/api/src/prisma/prisma.module";
import { TenantContext, withTenantContext } from "../../apps/api/src/common/tenant/tenant-context.service";
import { TenantContextInterceptor } from "../../apps/api/src/common/tenant/tenant-context.interceptor";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { defer, lastValueFrom } from "rxjs";
import { systemDatabaseUrl } from "../../apps/api/src/common/tenant/rls.extension";

/**
 * Fase 1 · 1E — RLS nativa do PostgreSQL. Prova a camada de BANCO de forma
 * independente do guard ORM: conexões "cruas" (sem extensão) e SQL bruto.
 */

let app: INestApplication;
let prisma: PrismaService;
let tenantContext: TenantContext;
let raw: PrismaClient;
let system: PrismaClient;
let companyA: string;
let companyB: string;

const TENANT_TABLES = [
  "Appointment", "CashMovement", "CashSession", "Category", "Client", "CompanyModule",
  "FinancialEntry", "ImportBatch", "LegalConsent", "Pet", "Product", "Sale", "Service",
  "StockMovement", "Subscription", "SubscriptionPlan", "Supplier", "TenantSubscription", "User",
  "WhatsAppConfig", "WhatsAppConsent", "WhatsAppMessage", "WhatsAppTemplate", "WhatsAppWebhookEvent",
  "Company",
];

/**
 * Executa como uma requisição da empresa. O `await` precisa acontecer DENTRO
 * do contexto: PrismaPromise é preguiçosa (só roda no `then`), como numa
 * rota real, onde o handler aguarda dentro do TenantContextInterceptor.
 */
function asTenant<T>(companyId: string, fn: () => PromiseLike<T>): Promise<T> {
  return withTenantContext(tenantContext, companyId, fn, "teste");
}

beforeAll(async () => {
  ({ app, prisma } = await createTestApp());
  tenantContext = app.get(TenantContext);
  raw = new PrismaClient();
  system = new PrismaClient({ datasources: { db: { url: systemDatabaseUrl(process.env.DATABASE_URL as string) } } });
  await resetDatabase(prisma);

  const a = await prisma.company.create({ data: { name: "Empresa A RLS", slug: "rls-a" } });
  const b = await prisma.company.create({ data: { name: "Empresa B RLS", slug: "rls-b" } });
  companyA = a.id;
  companyB = b.id;
  await prisma.client.createMany({
    data: [
      { companyId: companyA, name: "Cliente A1", nameKey: "cliente a1" },
      { companyId: companyA, name: "Cliente A2", nameKey: "cliente a2" },
      { companyId: companyB, name: "Cliente B1", nameKey: "cliente b1" },
    ],
  });
});

afterAll(async () => {
  await raw.$disconnect();
  await system.$disconnect();
  await app.close();
});

describe("Políticas no banco", () => {
  it("RLS habilitada e FORÇADA nas 25 tabelas (inclusive para o dono)", async () => {
    const rows = await system.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'`;
    const byName = new Map(rows.map((r) => [r.relname, r]));
    for (const table of TENANT_TABLES) {
      expect(byName.get(table), table).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true });
    }
    const policies = await system.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM pg_policies WHERE schemaname = 'public' AND policyname = 'tenant_isolation'`;
    expect(Number(policies[0]?.n)).toBe(TENANT_TABLES.length);
  });

  it("o role da aplicação não é superusuário nem tem BYPASSRLS (senão a RLS seria inerte)", async () => {
    const rows = await raw.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });
});

describe("Conexão sem contexto (fail-closed no banco)", () => {
  it("consulta sem app.company_id nem bypass retorna 0 linhas", async () => {
    const rows = await raw.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Client"`;
    expect(Number(rows[0]?.n)).toBe(0);
    expect(await raw.client.count()).toBe(0);
    expect(await raw.company.count()).toBe(0);
  });

  it("inserção sem contexto é recusada pela política", async () => {
    await expect(
      raw.client.create({ data: { companyId: companyA, name: "Intruso", nameKey: "intruso" } }),
    ).rejects.toThrow();
  });
});

describe("Contexto de empresa na transação", () => {
  it("com app.company_id = A, o SQL bruto vê só as linhas de A", async () => {
    const [, rows] = await raw.$transaction([
      raw.$executeRaw`SELECT set_config('app.company_id', ${companyA}, true)`,
      raw.$queryRaw<{ name: string }[]>`SELECT name FROM "Client" ORDER BY name`,
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Cliente A1", "Cliente A2"]);
  });

  it("com app.company_id = A, gravar linha da empresa B viola o WITH CHECK", async () => {
    await expect(
      raw.$transaction([
        raw.$executeRaw`SELECT set_config('app.company_id', ${companyA}, true)`,
        raw.$executeRaw`INSERT INTO "Client" (id, "companyId", name, "nameKey", "updatedAt") VALUES ('rls-x', ${companyB}, 'X', 'x', now())`,
      ]),
    ).rejects.toThrow(/row-level security|segurança no nível de linha/i);
  });

  it("o contexto é LOCAL à transação: não vaza para a próxima consulta da conexão", async () => {
    await raw.$transaction([
      raw.$executeRaw`SELECT set_config('app.company_id', ${companyA}, true)`,
      raw.$queryRaw`SELECT 1`,
    ]);
    expect(await raw.client.count()).toBe(0);
  });

  it("conexão de sistema (systemDatabaseUrl) vê todas as empresas", async () => {
    expect(await system.client.count()).toBe(3);
  });
});

describe("Aplicação (PrismaService + extensão RLS)", () => {
  it("em requisição da empresa A, SQL bruto sem filtro (que o guard ORM não vê) só enxerga A", async () => {
    const rows = await asTenant(companyA, () =>
      prisma.$queryRaw<{ companyId: string }[]>`SELECT "companyId" FROM "Client"`,
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.companyId))).toEqual(new Set([companyA]));
  });

  it("em requisição da empresa B, Company só mostra a própria empresa", async () => {
    const rows = await asTenant(companyB, () => prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Company"`);
    expect(rows.map((r) => r.id)).toEqual([companyB]);
  });

  it("transação interativa recebe o contexto no início (SQL bruto dentro dela)", async () => {
    const count = await asTenant(companyB, () =>
      prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Client"`;
        return Number(rows[0]?.n);
      }),
    );
    expect(count).toBe(1);
  });

  it("transação em lote recebe o contexto e devolve só os resultados pedidos", async () => {
    const result = await asTenant(companyA, () =>
      prisma.$transaction([prisma.client.count(), prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM "Client"`]),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(2);
    expect(Number(result[1][0]?.n)).toBe(2);
  });

  it("caminho HTTP: handler chamado via TenantContextInterceptor consulta com o contexto da sessão", async () => {
    const interceptor = new TenantContextInterceptor(tenantContext);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ auth: { companyId: companyB, userId: "u", role: "ADMIN", sessionId: "s" } }) }),
    } as unknown as ExecutionContext;
    // Como o Nest: o handler só roda quando o observable é assinado
    const next: CallHandler = {
      handle: () =>
        defer(async () => {
          const rows = await prisma.$queryRaw<{ setting: string | null; n: bigint }[]>`
            SELECT current_setting('app.company_id', true) AS setting, (SELECT count(*) FROM "Client")::bigint AS n`;
          return rows[0];
        }),
    };
    const result = (await lastValueFrom(interceptor.intercept(context, next))) as { setting: string; n: bigint };
    expect(result.setting).toBe(companyB);
    expect(Number(result.n)).toBe(1);
  });

  it("sem contexto (rota pública/CLI), a aplicação usa bypass e enxerga tudo", async () => {
    expect(await prisma.client.count()).toBe(3);
  });

  it("atomicidade preservada: rollback de transação interativa não grava nada", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.client.create({ data: { companyId: companyA, name: "Fantasma", nameKey: "fantasma" } });
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await prisma.client.count({ where: { nameKey: "fantasma" } })).toBe(0);
  });

  it("atomicidade preservada: falha no meio de transação em lote desfaz o lote inteiro", async () => {
    await expect(
      prisma.$transaction([
        prisma.client.create({ data: { companyId: companyA, name: "Lote", nameKey: "lote" } }),
        prisma.client.create({ data: { id: "duplicado", companyId: companyA, name: "Dup", nameKey: "dup" } }),
        prisma.client.create({ data: { id: "duplicado", companyId: companyA, name: "Dup", nameKey: "dup" } }),
      ]),
    ).rejects.toThrow();
    expect(await prisma.client.count({ where: { nameKey: { in: ["lote", "dup"] } } })).toBe(0);
  });
});

import { Prisma } from "@prisma/client";
import type { TenantContext } from "./tenant-context.service";

/**
 * RLS nativa do PostgreSQL — lado da aplicação (Fase 1 · 1E; ADR-0001).
 * Referência: prisma/prisma-client-extensions › row-level-security
 * (Apache-2.0), indicada em upgrade/REFERENCIAS_GIT.md.
 *
 * O banco (migration `20261018120000_row_level_security`) só mostra/aceita
 * linhas quando, NA TRANSAÇÃO corrente:
 *   - `app.company_id` = companyId da linha (rota autenticada), ou
 *   - `app.rls_bypass` = 'on' (processo de sistema / rota pública).
 * Conexão sem nenhum dos dois não vê nada.
 *
 * Esta extensão garante o contexto em TODA consulta:
 *   - fora de transação: executa `[set_config(...), consulta]` numa
 *     transação em lote (padrão do exemplo oficial);
 *   - dentro de transação: não re-embrulha (preserva a atomicidade); o
 *     contexto já foi definido no início dela por `withRlsTransactions`.
 *
 * Detecção de "dentro de transação": `__internalParams.transaction`
 * (Prisma 5.22). Não é API pública — `tests/integration/rls.test.ts` cobre
 * a atomicidade para detectar regressão ao atualizar o Prisma.
 */

export const RLS_COMPANY_SETTING = "app.company_id";
export const RLS_BYPASS_SETTING = "app.rls_bypass";

interface RawCapable {
  $executeRaw(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Prisma.PrismaPromise<number>;
}

/** Statement que define o contexto RLS da transação corrente. */
export function rlsContextStatement(client: RawCapable, tenantContext: TenantContext) {
  const ctx = tenantContext.get();
  if (ctx) {
    return client.$executeRaw`SELECT set_config('app.company_id', ${ctx.companyId}, true), set_config('app.rls_bypass', 'off', true)`;
  }
  return client.$executeRaw`SELECT set_config('app.rls_bypass', 'on', true)`;
}

function isInsideTransaction(params: unknown): boolean {
  const internal = (params as { __internalParams?: { transaction?: unknown } }).__internalParams;
  return Boolean(internal?.transaction);
}

export function rlsExtension(tenantContext: TenantContext) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: "rls-context",
      query: {
        async $allOperations(params) {
          const { args, query } = params;
          if (isInsideTransaction(params)) {
            return query(args);
          }
          const [, result] = await client.$transaction([
            rlsContextStatement(client, tenantContext),
            query(args),
          ]);
          return result;
        },
      },
    }),
  );
}

type TransactionFn = (...args: unknown[]) => Promise<unknown>;

/**
 * Faz `$transaction` (interativa ou em lote) começar definindo o contexto
 * RLS — as consultas de dentro não passam pelo embrulho da extensão.
 */
export function withRlsTransactions<T extends object>(client: T, tenantContext: TenantContext): T {
  const target = client as unknown as { $transaction: TransactionFn } & RawCapable;
  const original = target.$transaction.bind(target);
  target.$transaction = (async (arg: unknown, options?: unknown) => {
    if (typeof arg === "function") {
      const callback = arg as (tx: RawCapable) => Promise<unknown>;
      return original(async (tx: RawCapable) => {
        await rlsContextStatement(tx, tenantContext);
        return callback(tx);
      }, options);
    }
    const items = arg as Prisma.PrismaPromise<unknown>[];
    const results = (await original([rlsContextStatement(target, tenantContext), ...items], options)) as unknown[];
    return results.slice(1);
  }) as TransactionFn;
  return client;
}

/**
 * Conexão de SISTEMA (worker, CLI, scripts): `app.rls_bypass=on` fixo na
 * sessão via parâmetro `options` da URL. Use só fora do tratamento de
 * requisições de usuário.
 */
export function systemDatabaseUrl(databaseUrl: string): string {
  // Sem URL, devolve como veio: o Prisma reporta a falta de DATABASE_URL
  if (!databaseUrl) return databaseUrl;
  const url = new URL(databaseUrl);
  const current = url.searchParams.get("options");
  const flag = "-c app.rls_bypass=on";
  url.searchParams.set("options", current ? `${current} ${flag}` : flag);
  return url.toString();
}
